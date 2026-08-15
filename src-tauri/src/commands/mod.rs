pub mod aesthetic;
pub mod ai;
pub mod backup;
pub mod clip;
pub mod comfyui;
pub mod dashboard;
pub mod embeddings;
pub mod export;
pub mod fs;
pub mod images;
pub mod rename;
pub mod settings;
pub mod smart_collections;
pub mod tags;
pub mod trash;

use crate::error::{AppError, AppResult};

/// Resolve a Python sidecar script path (shared by CLIP and aesthetic
/// sidecars; dev mode uses the Python script directly).
pub(crate) fn sidecar_path_for(name: &str) -> AppResult<String> {
    // The working directory differs between `npm run tauri dev` (project
    // root) and `cargo test` (the src-tauri package dir). Try both layouts,
    // then fall back to the manifest-relative location.
    let mut candidates = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("src-tauri").join("sidecar").join(name));
        candidates.push(cwd.join("sidecar").join(name));
    }
    candidates.push(
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("sidecar")
            .join(name),
    );
    for candidate in candidates {
        if candidate.exists() {
            return Ok(candidate.to_string_lossy().to_string());
        }
    }
    Err(AppError::External(format!("Sidecar not found: {name}")))
}

/// Build a command that launches a Python sidecar script.
///
/// A `.py` file is not a Win32 executable, so `Command::new(script)` fails
/// with `os error 193` on Windows. Launch through the Python interpreter
/// instead (`LUMORA_PYTHON` override → `python` on PATH). Non-Windows builds
/// execute the script directly via its shebang.
#[cfg(windows)]
pub(crate) fn sidecar_command(name: &str) -> AppResult<std::process::Command> {
    let script = sidecar_path_for(name)?;
    let interpreter = std::env::var("LUMORA_PYTHON").unwrap_or_else(|_| "python".to_string());
    let mut cmd = std::process::Command::new(interpreter);
    cmd.arg(&script);
    Ok(cmd)
}

#[cfg(not(windows))]
pub(crate) fn sidecar_command(name: &str) -> AppResult<std::process::Command> {
    let script = sidecar_path_for(name)?;
    Ok(std::process::Command::new(&script))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sidecar_path_resolves_manifest_location() {
        let path = sidecar_path_for("clip_server.py").unwrap();
        assert!(path.ends_with("clip_server.py"));
        assert!(std::path::Path::new(&path).exists());
    }

    #[test]
    fn sidecar_path_reports_missing_script() {
        let err = sidecar_path_for("definitely-not-a-sidecar.py").unwrap_err();
        assert!(err.to_string().contains("Sidecar not found"));
    }

    #[test]
    fn sidecar_command_targets_the_script() {
        let cmd = sidecar_command("clip_server.py").unwrap();
        let args: Vec<String> = cmd
            .get_args()
            .map(|a| a.to_string_lossy().to_string())
            .collect();
        // Windows launches via the Python interpreter (python <script>);
        // Unix executes the script directly via its shebang. Either way,
        // the script path must appear in the program or its arguments.
        let program = cmd.get_program().to_string_lossy().to_string();
        let all: Vec<String> = std::iter::once(program).chain(args).collect();
        assert!(
            all.iter().any(|a| a.ends_with("clip_server.py")),
            "sidecar script missing from command: {all:?}"
        );
    }
}
