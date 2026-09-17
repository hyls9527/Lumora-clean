//! Latency benchmark harness for the "API P95 < 300 ms" acceptance gate.
//!
//! The harness runs inside the crate (unit-test only) so it exercises the real
//! query bodies and the real row/tag decoding instead of a hand-written copy of
//! the SQL. It is deliberately *not* compiled into release builds:
//! `#[cfg(test)]` keeps the shipped binary untouched.
//!
//! Usage:
//!   cargo test --lib perf_bench -- --ignored --nocapture
//!
//! Every scenario is measured against a 10k-image library — the size the
//! product targets (see docs/04-deploy/10k-semantic-bench.md) — with a warm-up
//! round so SQLite page cache and prepared-statement setup do not count as
//! user-visible latency.

use std::time::Instant;

use crate::db::DbHandle;

/// The acceptance budget for every scenario below.
pub(crate) const P95_BUDGET_MS: f64 = 300.0;

/// Library size the benchmark seeds.
pub(crate) const IMAGE_COUNT: usize = 10_000;

/// Measured rounds per scenario (after one warm-up round).
const ROUNDS: usize = 60;

#[derive(Debug, Clone)]
pub(crate) struct Latency {
    pub name: &'static str,
    pub p50_ms: f64,
    pub p95_ms: f64,
    pub p99_ms: f64,
    pub max_ms: f64,
}

impl Latency {
    /// True when this scenario meets the acceptance budget.
    pub fn passes(&self) -> bool {
        self.p95_ms < P95_BUDGET_MS
    }
}

/// Nearest-rank percentile (the definition the CI budget is phrased in).
///
/// Uses `ceil(n*p) - 1`: with 100 samples p95 is the 95th value, and with 60
/// samples (the benchmark's round count) p95 is the 57th. An interpolating
/// formula would report a slightly *lower* p95 than the observed sample and
/// quietly weaken the gate, so the rank is taken conservatively.
pub(crate) fn percentile(sorted: &[f64], p: f64) -> f64 {
    if sorted.is_empty() {
        return 0.0;
    }
    let rank = (sorted.len() as f64 * p).ceil() as usize;
    let idx = rank.saturating_sub(1).min(sorted.len() - 1);
    sorted[idx]
}

/// Run `op` `ROUNDS` times and summarise the latencies in milliseconds.
pub(crate) fn measure(name: &'static str, mut op: impl FnMut()) -> Latency {
    op(); // warm-up: page cache + statement preparation
    let mut samples = Vec::with_capacity(ROUNDS);
    for _ in 0..ROUNDS {
        let start = Instant::now();
        op();
        samples.push(start.elapsed().as_secs_f64() * 1000.0);
    }
    samples.sort_by(|a, b| a.partial_cmp(b).unwrap());
    Latency {
        name,
        p50_ms: percentile(&samples, 0.50),
        p95_ms: percentile(&samples, 0.95),
        p99_ms: percentile(&samples, 0.99),
        max_ms: *samples.last().unwrap_or(&0.0),
    }
}

/// Seed a realistic 10k library: varied paths/prompts/models, some rated,
/// some favourited, tagged, and CLIP-embedded so joined lookups are exercised.
pub(crate) fn seed_library(db: &DbHandle, count: usize) {
    let mut conn = db.conn().lock().unwrap();
    let tx = conn.transaction().unwrap();
    {
        let models = ["flux-dev", "sdxl", "sd15", "pony", "krea"];
        let mut img = tx
            .prepare(
                "INSERT INTO images
                 (id,file_path,file_hash,file_size_kb,width,height,format,created_at,
                  imported_at,rating,favorite,metadata_json)
                 VALUES (?1,?2,?3,?4,?5,?6,'png',?7,?8,?9,?10,?11)",
            )
            .unwrap();
        for i in 0..count {
            let model = models[i % models.len()];
            // Built with serde_json, not string formatting: the first version
            // used line-continuation backslashes inside the literal, which left
            // stray whitespace inside the JSON and made every metadata query fail
            // with "malformed JSON".
            let metadata = serde_json::json!({
                "prompt": format!("a cinematic portrait of subject {i} in neon rain"),
                "negative_prompt": "blurry, low quality",
                "model": model,
                "sampler": "DPM++ 2M",
                "seed": i * 7 + 1,
                "steps": 30,
                "cfg_scale": 7.5,
            })
            .to_string();
            img.execute(rusqlite::params![
                format!("img-{i:06}"),
                format!("/library/{}/frame_{i:06}.png", model),
                format!("hash{i:06}"),
                1024 + (i as i64 % 8192),
                1024,
                1024,
                format!("2026-0{}-{:02}T10:00:00", 1 + (i % 9), 1 + (i % 28)),
                format!("2026-0{}-{:02}T10:00:00", 1 + (i % 9), 1 + (i % 28)),
                (i % 6) as i64,
                if i % 5 == 0 { 1 } else { 0 },
                metadata,
            ])
            .unwrap();
        }

        // Tags: 20 tags, ~2 per image.
        let mut tag = tx
            .prepare("INSERT INTO tags (id,name,color) VALUES (?1,?2,'#888888')")
            .unwrap();
        for t in 0..20 {
            tag.execute(rusqlite::params![
                format!("tag-{t:02}"),
                format!("style-{t:02}")
            ])
            .unwrap();
        }
        let mut link = tx
            .prepare("INSERT OR IGNORE INTO image_tags (image_id,tag_id) VALUES (?1,?2)")
            .unwrap();
        for i in 0..count {
            for k in 0..2 {
                link.execute(rusqlite::params![
                    format!("img-{i:06}"),
                    format!("tag-{:02}", (i + k * 7) % 20)
                ])
                .unwrap();
            }
        }

        // CLIP embeddings for a third of the library (realistic partial index).
        let mut clip = tx
            .prepare(
                "INSERT INTO clip_embeddings (image_id,embedding,dimensions,status)
                 VALUES (?1,?2,512,'embedded')",
            )
            .unwrap();
        let vec_blob = vec![0u8; 512 * 4];
        for i in (0..count).step_by(3) {
            clip.execute(rusqlite::params![format!("img-{i:06}"), vec_blob])
                .unwrap();
        }
    }
    tx.commit().unwrap();
    // The FTS index is content-linked to `images`; rebuild so MATCH sees rows
    // inserted directly through SQL (the import path maintains it incrementally).
    conn.execute("INSERT INTO images_fts(images_fts) VALUES('rebuild')", [])
        .unwrap();
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::dashboard::get_dashboard_stats_inner;
    use crate::commands::images::{
        escape_fts5, list_images_filtered_inner, list_images_impl, search_images_inner, ImageFilter,
    };
    use crate::schema::types::{attach_tags, row_to_record};
    use rusqlite::params;

    fn bench_db() -> DbHandle {
        let db = DbHandle::open_memory().unwrap();
        seed_library(&db, IMAGE_COUNT);
        db
    }

    /// Percentile maths must be exact — a wrong index would let a failing
    /// library report a healthy P95.
    #[test]
    fn percentile_picks_expected_sample() {
        // 1..=100: nearest-rank p50 is the 50th value, p95 the 95th, p99 the 99th.
        let sorted: Vec<f64> = (1..=100).map(|v| v as f64).collect();
        assert_eq!(percentile(&sorted, 0.50), 50.0);
        assert_eq!(percentile(&sorted, 0.95), 95.0);
        assert_eq!(percentile(&sorted, 0.99), 99.0);

        // The benchmark samples 60 rounds: ceil(60*0.95) = 57th smallest.
        let sixty: Vec<f64> = (1..=60).map(|v| v as f64).collect();
        assert_eq!(percentile(&sixty, 0.95), 57.0);
        // Never interpolates below the observed sample.
        assert!(percentile(&sixty, 0.95) >= sixty[56]);

        assert_eq!(percentile(&[], 0.95), 0.0);
        // Single sample: every quantile is that sample.
        assert_eq!(percentile(&[7.0], 0.99), 7.0);
    }

    /// The real gate: every user-facing read path stays under the budget on a
    /// 10k library. Run with `--ignored --nocapture` and read the table.
    #[test]
    #[ignore = "latency benchmark: run explicitly with --ignored --nocapture"]
    fn api_p95_under_budget_on_10k_library() {
        let db = bench_db();
        let mut results: Vec<Latency> = Vec::new();

        results.push(measure("list_images(page 1, 40/page)", || {
            list_images_impl(&db, 1, 40).unwrap();
        }));
        results.push(measure("list_images(page 100, 40/page)", || {
            list_images_impl(&db, 100, 40).unwrap();
        }));
        results.push(measure("list_images_filtered(favorite+min4)", || {
            let filter = ImageFilter {
                rating_min: Some(4),
                favorite: Some(true),
                ..Default::default()
            };
            list_images_filtered_inner(&db, 1, 40, &filter).unwrap();
        }));
        results.push(measure("list_images_filtered(model=sdxl)", || {
            let filter = ImageFilter {
                model: Some("sdxl".to_string()),
                ..Default::default()
            };
            list_images_filtered_inner(&db, 1, 40, &filter).unwrap();
        }));
        results.push(measure("search_images(fts: neon rain)", || {
            search_images_inner(&db, "neon rain").unwrap();
        }));
        results.push(measure("search_images(fts: single rare token)", || {
            search_images_inner(&db, "subject 4242").unwrap();
        }));
        results.push(measure("search_images(fts: operator-only)", || {
            search_images_inner(&db, "-*():").unwrap();
        }));
        results.push(measure("get_dashboard_stats", || {
            let conn = db.conn().lock().unwrap();
            get_dashboard_stats_inner(&conn).unwrap();
        }));
        results.push(measure("get_images_by_ids(40, same page)", || {
            let ids: Vec<String> = (0..40).map(|i| format!("img-{i:06}")).collect();
            get_images_by_ids_impl(&db, &ids).unwrap();
        }));
        results.push(measure("list_tags", || {
            let conn = db.conn().lock().unwrap();
            let mut stmt = conn.prepare("SELECT * FROM tags").unwrap();
            let _rows: Vec<String> = stmt
                .query_map([], |r| r.get::<_, String>(0))
                .unwrap()
                .filter_map(Result::ok)
                .collect();
        }));

        println!("\n=== Lumora API latency (10k library, {ROUNDS} rounds) ===");
        println!(
            "{:<42} {:>9} {:>9} {:>9} {:>9}",
            "scenario", "p50(ms)", "p95(ms)", "p99(ms)", "max(ms)"
        );
        for r in &results {
            println!(
                "{:<42} {:>9.2} {:>9.2} {:>9.2} {:>9.2}   {}",
                r.name,
                r.p50_ms,
                r.p95_ms,
                r.p99_ms,
                r.max_ms,
                if r.passes() { "OK" } else { "OVER BUDGET" }
            );
        }
        let worst = results.iter().map(|r| r.p95_ms).fold(0.0_f64, f64::max);
        println!("worst P95: {worst:.2} ms (budget {P95_BUDGET_MS} ms)");

        let over: Vec<&Latency> = results.iter().filter(|r| !r.passes()).collect();
        assert!(
            over.is_empty(),
            "scenarios over the {} ms P95 budget: {:?}",
            P95_BUDGET_MS,
            over.iter().map(|r| (r.name, r.p95_ms)).collect::<Vec<_>>()
        );
    }

    /// Every scenario must at least return real data — a query that silently
    /// matches nothing would be fast and meaningless.
    #[test]
    #[ignore = "latency benchmark: run explicitly with --ignored --nocapture"]
    fn benchmark_scenarios_return_real_data() {
        let db = bench_db();
        assert_eq!(list_images_impl(&db, 1, 40).unwrap().items.len(), 40);
        assert!(!search_images_inner(&db, "neon rain").unwrap().is_empty());
        let conn = db.conn().lock().unwrap();
        let stats = get_dashboard_stats_inner(&conn).unwrap();
        assert_eq!(stats.total_images, IMAGE_COUNT as i64);
    }

    /// Helper mirroring the production lookup (kept here so the benchmark also
    /// covers the tag-join cost of a 40-id batch fetch).
    fn get_images_by_ids_impl(
        db: &DbHandle,
        ids: &[String],
    ) -> Result<Vec<crate::schema::types::ImageRecord>, crate::error::AppError> {
        let conn = db.conn().lock().map_err(|_| crate::error::AppError::Lock)?;
        let mut items = Vec::with_capacity(ids.len());
        for id in ids {
            let mut stmt = conn.prepare("SELECT * FROM images WHERE id = ?1 AND deleted = 0")?;
            let record = stmt.query_row(params![id], row_to_record).ok();
            if let Some(mut record) = record {
                attach_tags(&conn, std::slice::from_mut(&mut record))?;
                items.push(record);
            }
        }
        Ok(items)
    }

    /// Sanity: the FTS escape helper the benchmark relies on.
    #[test]
    fn escape_fts5_available_to_harness() {
        assert_eq!(escape_fts5("-*():"), "");
    }
}
