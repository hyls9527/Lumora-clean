use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::process::Command;

use crate::db::DbHandle;
use crate::error::{AppError, AppResult};

/// Judgment tiers (product language: 夯 -> 拉).
pub const SCORE_LABEL_HANG: &str = "夯";
pub const SCORE_LABEL_WEN: &str = "稳";
pub const SCORE_LABEL_LA: &str = "拉";

/// Raw response from the aesthetic sidecar.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AestheticScoreResponse {
    #[serde(default)]
    pub hps_score: Option<f64>,
    #[serde(default)]
    pub hps_style: Option<String>,
    #[serde(default)]
    pub aesthetic_score: Option<f64>,
    #[serde(default)]
    pub scoring_model: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
}

/// Map an absolute 0-10 aesthetic score to the three-tier judgment.
/// No score => unscored (None): never fake a judgment.
pub fn map_score_label(aesthetic_score: Option<f64>) -> Option<&'static str> {
    let score = aesthetic_score?;
    if score >= 8.5 {
        Some(SCORE_LABEL_HANG)
    } else if score >= 6.0 {
        Some(SCORE_LABEL_WEN)
    } else {
        Some(SCORE_LABEL_LA)
    }
}

fn get_sidecar_path() -> AppResult<String> {
    // In development, use Python directly (same convention as CLIP sidecar).
    let sidecar_py = std::env::current_dir()
        .map_err(|e| AppError::External(format!("Failed to get current dir: {}", e)))?
        .join("src-tauri")
        .join("sidecar")
        .join("aesthetic_server.py");
    if sidecar_py.exists() {
        return Ok(sidecar_py.to_string_lossy().to_string());
    }
    Err(AppError::External(
        "Aesthetic sidecar not found".to_string(),
    ))
}

/// Run the sidecar for one image. The sidecar degrades gracefully: when no
/// scoring engine is usable it returns a JSON `error` field with exit code 0,
/// so callers can persist partial results or leave the image unscored.
pub fn score_image(image_path: &str, prompt: Option<&str>) -> AppResult<AestheticScoreResponse> {
    let sidecar_path = get_sidecar_path()?;
    let output = Command::new(&sidecar_path)
        .args(["score-image", image_path, prompt.unwrap_or("")])
        .output()
        .map_err(|e| AppError::External(format!("Failed to run aesthetic sidecar: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::External(format!(
            "Aesthetic sidecar failed: {}",
            stderr
        )));
    }

    serde_json::from_slice(&output.stdout)
        .map_err(|e| AppError::External(format!("Failed to parse aesthetic response: {}", e)))
}

/// Persist a scored response. The tier is derived from the absolute aesthetic
/// score; HPS v2 is stored raw for same-prompt comparisons and never fakes a
/// tier. A response with no usable score leaves the image unscored.
pub fn save_score(
    conn: &Connection,
    image_id: &str,
    response: &AestheticScoreResponse,
) -> Result<(), rusqlite::Error> {
    if response.aesthetic_score.is_none() && response.hps_score.is_none() {
        return Ok(());
    }
    let label = map_score_label(response.aesthetic_score);
    conn.execute(
        "UPDATE images
         SET hps_score = ?1, hps_style = ?2, aesthetic_score = ?3,
             scoring_model = ?4, scored_at = ?5, score_label = ?6
         WHERE id = ?7",
        params![
            response.hps_score,
            response.hps_style,
            response.aesthetic_score,
            response.scoring_model,
            chrono::Utc::now().to_rfc3339(),
            label,
            image_id,
        ],
    )?;
    Ok(())
}

/// Images that have never been judged (score_label IS NULL), oldest first.
fn list_missing_score_images_db(
    conn: &Connection,
    limit: i64,
) -> Result<Vec<(String, String, Option<String>)>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, file_path, json_extract(metadata_json, '$.prompt') AS prompt
         FROM images
         WHERE deleted = 0 AND score_label IS NULL
         ORDER BY imported_at ASC
         LIMIT ?1",
    )?;
    let rows = stmt.query_map(params![limit], |row| {
        Ok((row.get(0)?, row.get(1)?, row.get(2)?))
    })?;
    rows.collect()
}

/// Score a single image by id and persist the result.
#[tauri::command]
pub async fn score_image_cmd(
    db: tauri::State<'_, DbHandle>,
    image_id: String,
) -> AppResult<AestheticScoreResponse> {
    let (file_path, prompt) = {
        let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
        conn.query_row(
            "SELECT file_path, json_extract(metadata_json, '$.prompt')
             FROM images WHERE id = ?1 AND deleted = 0",
            params![image_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?)),
        )
        .map_err(|_| AppError::NotFound(format!("Image not found: {image_id}")))?
    };

    let response = score_image(&file_path, prompt.as_deref())?;
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    save_score(&conn, &image_id, &response)?;
    Ok(response)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScoreMissingResult {
    pub processed: i64,
    pub remaining: i64,
}

/// Score images that have no judgment yet, in batches (default 5, max 50).
/// Images whose sidecar call returns no usable score stay unscored and are
/// retried on the next invocation (model may be installed later).
#[tauri::command]
pub async fn score_missing_cmd(
    db: tauri::State<'_, DbHandle>,
    limit: Option<i64>,
) -> AppResult<ScoreMissingResult> {
    let batch = limit.unwrap_or(5).clamp(1, 50);
    let missing = {
        let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
        list_missing_score_images_db(&conn, batch)?
    };

    let mut processed = 0i64;
    for (image_id, file_path, prompt) in missing {
        match score_image(&file_path, prompt.as_deref()) {
            Ok(response) => {
                let usable = response.aesthetic_score.is_some() || response.hps_score.is_some();
                let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
                save_score(&conn, &image_id, &response)?;
                if usable {
                    processed += 1;
                }
            }
            Err(e) => {
                log::warn!("Failed to score image {image_id}: {e}");
            }
        }
    }

    let remaining = {
        let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
        list_missing_score_images_db(&conn, i64::MAX)?.len() as i64
    };
    Ok(ScoreMissingResult {
        processed,
        remaining,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> crate::db::DbHandle {
        crate::db::DbHandle::open_memory().unwrap()
    }

    fn insert_image(conn: &Connection, id: &str) {
        conn.execute(
            "INSERT INTO images (id,file_path,file_hash,file_size_kb,format,created_at)
             VALUES (?1, ?2, 'h', 1, 'png', '2025-01-01')",
            params![id, format!("/{id}.png")],
        )
        .unwrap();
    }

    type ScoreRow = (
        Option<f64>,
        Option<String>,
        Option<f64>,
        Option<String>,
        Option<String>,
    );

    #[test]
    fn map_score_label_tiers() {
        assert_eq!(map_score_label(Some(9.2)), Some(SCORE_LABEL_HANG));
        assert_eq!(map_score_label(Some(8.5)), Some(SCORE_LABEL_HANG));
        assert_eq!(map_score_label(Some(7.0)), Some(SCORE_LABEL_WEN));
        assert_eq!(map_score_label(Some(6.0)), Some(SCORE_LABEL_WEN));
        assert_eq!(map_score_label(Some(5.9)), Some(SCORE_LABEL_LA));
        assert_eq!(map_score_label(Some(0.0)), Some(SCORE_LABEL_LA));
        assert_eq!(map_score_label(None), None);
    }

    #[test]
    fn save_score_persists_fields_and_label() {
        let db = test_db();
        {
            let conn = db.conn().lock().unwrap();
            insert_image(&conn, "s1");
        }
        let response = AestheticScoreResponse {
            hps_score: Some(27.3),
            hps_style: Some("Animation".into()),
            aesthetic_score: Some(8.7),
            scoring_model: Some("test@v1".into()),
            error: None,
        };
        {
            let conn = db.conn().lock().unwrap();
            save_score(&conn, "s1", &response).unwrap();
        }
        let conn = db.conn().lock().unwrap();
        let row: ScoreRow = conn
            .query_row(
                "SELECT hps_score, hps_style, aesthetic_score, scoring_model, score_label
                 FROM images WHERE id = 's1'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
            )
            .unwrap();
        assert_eq!(row.0, Some(27.3));
        assert_eq!(row.1.as_deref(), Some("Animation"));
        assert_eq!(row.2, Some(8.7));
        assert_eq!(row.3.as_deref(), Some("test@v1"));
        assert_eq!(row.4.as_deref(), Some(SCORE_LABEL_HANG));
    }

    #[test]
    fn save_score_without_aesthetic_leaves_unscored() {
        let db = test_db();
        {
            let conn = db.conn().lock().unwrap();
            insert_image(&conn, "s2");
        }
        let response = AestheticScoreResponse {
            hps_score: Some(26.0),
            hps_style: Some("Photo".into()),
            aesthetic_score: None,
            scoring_model: Some("hpsv2:v2.0".into()),
            error: None,
        };
        {
            let conn = db.conn().lock().unwrap();
            save_score(&conn, "s2", &response).unwrap();
        }
        let conn = db.conn().lock().unwrap();
        let (aesthetic, label): (Option<f64>, Option<String>) = conn
            .query_row(
                "SELECT aesthetic_score, score_label FROM images WHERE id = 's2'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(aesthetic, None);
        assert_eq!(label, None);
    }

    #[test]
    fn save_score_with_no_usable_score_is_noop() {
        let db = test_db();
        {
            let conn = db.conn().lock().unwrap();
            insert_image(&conn, "s3");
        }
        let response = AestheticScoreResponse {
            hps_score: None,
            hps_style: None,
            aesthetic_score: None,
            scoring_model: None,
            error: Some("no engine available".into()),
        };
        {
            let conn = db.conn().lock().unwrap();
            save_score(&conn, "s3", &response).unwrap();
        }
        let conn = db.conn().lock().unwrap();
        let label: Option<String> = conn
            .query_row("SELECT score_label FROM images WHERE id = 's3'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(label, None);
    }

    #[test]
    fn missing_score_list_only_returns_unscored_images() {
        let db = test_db();
        {
            let conn = db.conn().lock().unwrap();
            insert_image(&conn, "m1");
            insert_image(&conn, "m2");
            conn.execute("UPDATE images SET score_label = '夯' WHERE id = 'm2'", [])
                .unwrap();
        }
        let conn = db.conn().lock().unwrap();
        let missing = list_missing_score_images_db(&conn, 10).unwrap();
        assert_eq!(missing.len(), 1);
        assert_eq!(missing[0].0, "m1");
    }
}
