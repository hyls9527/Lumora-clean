//! Crash telemetry: persist Rust panics so the crash rate can be measured.
//!
//! A panic anywhere on a Tauri worker thread is caught by the runtime and
//! surfaced to the frontend as a command error — the process usually stays
//! alive, so nothing in the OS-level crash reporting would ever see it. That
//! makes "crash rate < 0.1%" unmeasurable without a hook: this module installs
//! a panic hook that appends one JSON line per panic to `crash.log` in the
//! app log directory and then chains to the previous hook (so the default
//! stderr output is preserved).
//!
//! The file is capped: once it exceeds `MAX_LOG_BYTES` the oldest half is
//! dropped, so a crash loop can never fill the user's disk.

use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

/// Directory that receives `crash.log` (the app log dir, resolved at setup).
static CRASH_DIR: OnceLock<PathBuf> = OnceLock::new();

/// Panics recorded in this process — the in-memory half of the crash rate.
static PANIC_COUNT: OnceLock<std::sync::atomic::AtomicU64> = OnceLock::new();

/// Rotate once the log grows past this size (1 MiB).
const MAX_LOG_BYTES: u64 = 1024 * 1024;

fn panic_count() -> &'static std::sync::atomic::AtomicU64 {
    PANIC_COUNT.get_or_init(|| std::sync::atomic::AtomicU64::new(0))
}

/// Point the crash log at `dir` and install the panic hook (idempotent).
///
/// Must be called before any worker thread can panic; the hook itself never
/// panics or unwinds, so a failure to write the log is silently ignored.
pub fn init(dir: &Path) -> PathBuf {
    let _ = CRASH_DIR.set(dir.to_path_buf());
    let path = dir.join("crash.log");
    let prev = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        panic_count().fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        append_entry(info);
        prev(info);
    }));
    path
}

/// Number of panics recorded since this process started.
pub fn count() -> u64 {
    panic_count().load(std::sync::atomic::Ordering::Relaxed)
}

/// Path of the crash log, if `init` has run.
pub fn path() -> Option<PathBuf> {
    CRASH_DIR.get().map(|d| d.join("crash.log"))
}

/// Serialise one panic record and append it, trimming the file when needed.
fn append_entry(info: &std::panic::PanicHookInfo<'_>) {
    let Some(dir) = CRASH_DIR.get() else {
        return;
    };
    let _ = std::fs::create_dir_all(dir);
    let entry = serde_json::json!({
        "ts": chrono::Utc::now().to_rfc3339(),
        "thread": std::thread::current().name().unwrap_or("<unnamed>"),
        "location": info.location().map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column())),
        "message": payload_message(info.payload()),
    });
    write_entry(dir, &entry.to_string());
}

fn write_entry(dir: &Path, line: &str) {
    let path = dir.join("crash.log");
    if let Ok(meta) = std::fs::metadata(&path) {
        if meta.len() > MAX_LOG_BYTES {
            trim(&path);
        }
    }
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
    {
        let _ = writeln!(f, "{line}");
    }
}

/// Keep the newest half of an oversized log.
fn trim(path: &Path) {
    let Ok(content) = std::fs::read(path) else {
        return;
    };
    let cut = content.len() / 2;
    // Cut on a line boundary so the remaining file stays valid JSON-lines.
    let start = content[cut..]
        .iter()
        .position(|b| *b == b'\n')
        .map(|i| cut + i + 1)
        .unwrap_or(cut);
    let _ = std::fs::write(path, &content[start..]);
}

/// Extract a readable message from a panic payload.
fn payload_message(payload: &(dyn std::any::Any + Send)) -> String {
    if let Some(s) = payload.downcast_ref::<&str>() {
        (*s).to_string()
    } else if let Some(s) = payload.downcast_ref::<String>() {
        s.clone()
    } else {
        "<non-string panic payload>".to_string()
    }
}

/// Crash statistics for the frontend diagnostics surface.
#[derive(serde::Serialize)]
pub struct CrashStats {
    pub panics: u64,
    pub log_path: Option<String>,
}

/// Panics recorded in this process plus the crash log location.
#[tauri::command]
pub fn get_crash_stats() -> CrashStats {
    CrashStats {
        panics: count(),
        log_path: path().map(|p| p.to_string_lossy().to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The panic hook, its directory and its counter are process-global, so
    /// tests that exercise them must not run concurrently: two tests each
    /// calling `init` with their own temp dir would otherwise fight over the
    /// single `OnceLock` and assert against each other's writes.
    static SERIAL: std::sync::Mutex<()> = std::sync::Mutex::new(());

    /// The file-name helper must stay stable — operators and the delivery
    /// report both reference `crash.log`.
    #[test]
    fn init_points_at_crash_log_in_given_dir() {
        let dir = tempfile::tempdir().unwrap();
        let path = init(dir.path());
        assert_eq!(path.file_name().unwrap(), "crash.log");
        assert_eq!(path, dir.path().join("crash.log"));
    }

    #[test]
    fn payload_message_reads_str_and_string_payloads() {
        // No shared state: no guard needed.
        let s: &str = "boom";
        assert_eq!(payload_message(&s), "boom");
        let owned = String::from("owned boom");
        assert_eq!(payload_message(&owned), "owned boom");
        let num = 42u32;
        assert_eq!(payload_message(&num), "<non-string panic payload>");
    }

    /// A panic must leave exactly one parseable JSON line behind: this is the
    /// data the crash-rate metric is computed from.
    ///
    /// Serialized against every other test that touches the global hook: the
    /// counter and the log directory are process-wide, and `init` only honours
    /// the first directory it sees.
    #[test]
    fn panic_writes_json_line_and_increments_count() {
        let _guard = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
        let dir = tempfile::tempdir().unwrap();
        init(dir.path());
        let before = count();
        let result = std::panic::catch_unwind(|| panic!("boom-{}", 7));
        assert!(result.is_err());
        // Deliberately not `before + 1`: the hook is process-wide, so a panic
        // on any other test thread also advances the counter. What must hold
        // is that our panic was observed.
        assert!(count() > before, "panic hook did not count our panic");

        let content = std::fs::read_to_string(crate::crash_log::path().unwrap()).unwrap();
        // `rfind` is the clippy-clean way to get the last matching line:
        // `.last()` and `.filter().next_back()` both trip pedantic lints.
        let line = content
            .lines()
            .rfind(|l| l.contains("boom-7"))
            .expect("panicking thread wrote no crash.log line");
        let v: serde_json::Value = serde_json::from_str(line).unwrap();
        assert_eq!(v["message"], "boom-7");
        assert!(v["ts"].as_str().unwrap().contains('T'));
        assert!(v["location"].as_str().unwrap().contains("crash_log.rs"));
    }

    /// Rotation is pure file logic, so it is tested through the private
    /// helpers with an explicit path instead of the process-global directory —
    /// that keeps this test independent of whichever test called `init` first.
    #[test]
    fn oversized_log_is_trimmed_to_newest_half() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("crash.log");
        // Build the filler from MAX_LOG_BYTES instead of hand-counting: the
        // first version wrote 400 x ~1 KiB = ~400 KiB and asserted it was over
        // a 1 MiB limit, which could never hold.
        // Target ~2x the limit so the assertion cannot sit on a rounding edge.
        let line_bytes = 1024usize;
        let lines = ((MAX_LOG_BYTES as usize * 2) / line_bytes) + 8;
        let filler = "x".repeat(line_bytes - 64);
        let mut body = String::new();
        for i in 0..lines {
            body.push_str(&format!("{{\"n\":{i},\"pad\":\"{filler}\"}}\n"));
        }
        std::fs::write(&path, &body).unwrap();
        assert!(
            std::fs::metadata(&path).unwrap().len() > MAX_LOG_BYTES,
            "filler of {} bytes must exceed the {MAX_LOG_BYTES}-byte rotation limit",
            body.len()
        );

        write_entry(dir.path(), "{\"n\":\"after-trim\"}");

        let after = std::fs::read_to_string(&path).unwrap();
        // Trimmed to roughly the newest half, and strictly smaller than before.
        assert!(after.len() < body.len());
        assert!(after.len() <= MAX_LOG_BYTES as usize);
        // Every surviving line must still be valid JSON (line-boundary cut).
        for line in after.lines() {
            serde_json::from_str::<serde_json::Value>(line).unwrap();
        }
        assert!(after.contains("after-trim"));
    }
}
