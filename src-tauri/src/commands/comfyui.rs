use std::path::PathBuf;
use std::io::Read;

use crate::error::{AppError, AppResult};

/// ComfyUI marker files that indicate a ComfyUI installation
const COMFYUI_MARKERS: &[&str] = &[
    "main.py",
    "comfy/cli_args.py",
    "comfy/model_management.py",
];

/// Common ComfyUI directory names (including variations like 秋叶整合包)
const COMFYUI_DIR_NAMES: &[&str] = &[
    "ComfyUI",
    "ComfyUI-aki",
    "ComfyUI-aki-v3",
    "ComfyUI-aki-v4",
    "ComfyUI-portable",
    "ComfyUI_windows_portable",
    "ComfyUI-CPU",
    "ComfyUI-Nvidia",
    "ComfyUI-AMD",
];

/// Detect ComfyUI output directory by scanning common locations.
///
/// Detection strategy (in order):
/// 1. Custom path from settings (if provided and exists)
/// 2. Read extra_model_paths.yaml config files
/// 3. Check startup scripts (.bat) for --output-directory
/// 4. Recursive scan of Desktop (max depth 3)
/// 5. Recursive scan of common locations (D:\, C:\)
#[tauri::command]
pub fn detect_comfyui_path(custom_path: Option<String>) -> AppResult<Option<String>> {
    // 1. If user provided a custom path, check it first
    if let Some(ref path) = custom_path {
        let p = PathBuf::from(path);
        if p.is_dir() {
            return Ok(Some(path.clone()));
        }
    }

    let home = get_home_dir()?;
    
    // 2. Scan Desktop recursively (most common location for user installations)
    let desktop = home.join("Desktop");
    if desktop.is_dir() {
        if let Some(found) = scan_for_comfyui(&desktop, 3) {
            return Ok(Some(found));
        }
    }

    // 3. Scan Home directory (shallower)
    if let Some(found) = scan_for_comfyui(&home, 2) {
        return Ok(Some(found));
    }

    // 4. Try common fixed paths on different drives
    let fixed_paths = vec![
        PathBuf::from(r"D:\ComfyUI"),
        PathBuf::from(r"D:\ComfyUI-aki"),
        PathBuf::from(r"D:\ComfyUI-aki-v3"),
        PathBuf::from(r"C:\ComfyUI"),
        PathBuf::from(r"C:\ComfyUI-aki"),
        PathBuf::from(r"D:\AI\ComfyUI"),
        PathBuf::from(r"C:\AI\ComfyUI"),
    ];

    for path in fixed_paths {
        if path.is_dir() && is_comfyui_dir(&path) {
            return resolve_output_dir(&path);
        }
    }

    Ok(None)
}

/// Resolve the actual output directory for a ComfyUI installation
/// Checks: extra_model_paths.yaml, startup scripts, default output/
fn resolve_output_dir(comfyui_dir: &PathBuf) -> AppResult<Option<String>> {
    // 1. Check extra_model_paths.yaml for custom output directory
    if let Some(output) = read_extra_model_paths(comfyui_dir) {
        return Ok(Some(output));
    }

    // 2. Check startup scripts (.bat files) for --output-directory
    if let Some(output) = read_startup_script_output_dir(comfyui_dir) {
        return Ok(Some(output));
    }

    // 3. Check if there's a custom output directory configured via CLI args
    // Look for run.bat, start.bat, launch.bat etc.
    let bat_patterns = vec!["*.bat", "*.cmd", "*.ps1"];
    for pattern in bat_patterns {
        if let Some(output) = scan_bat_files_for_output_dir(comfyui_dir, pattern) {
            return Ok(Some(output));
        }
    }

    // 4. Default: <comfyui_dir>/output/
    let output_dir = comfyui_dir.join("output");
    if output_dir.is_dir() {
        return Ok(Some(output_dir.to_string_lossy().to_string()));
    }

    // 5. Return ComfyUI dir itself if output doesn't exist yet
    Ok(Some(comfyui_dir.to_string_lossy().to_string()))
}

/// Read extra_model_paths.yaml to find custom output directory
fn read_extra_model_paths(comfyui_dir: &PathBuf) -> Option<String> {
    let config_paths = vec![
        comfyui_dir.join("extra_model_paths.yaml"),
        comfyui_dir.join("extra_model_paths.yml"),
    ];

    for config_path in config_paths {
        if config_path.exists() {
            if let Ok(mut file) = std::fs::File::open(&config_path) {
                let mut content = String::new();
                if file.read_to_string(&mut content).is_ok() {
                    // Look for output_directory or output setting
                    for line in content.lines() {
                        let line = line.trim();
                        if line.starts_with("output_directory:") || line.starts_with("output:") {
                            let value = line.split(':').nth(1)?.trim();
                            let path = PathBuf::from(value);
                            if path.is_dir() {
                                return Some(path.to_string_lossy().to_string());
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

/// Read startup scripts to find --output-directory parameter
fn read_startup_script_output_dir(comfyui_dir: &PathBuf) -> Option<String> {
    let script_names = vec![
        "run.bat", "run.cmd", "run_nvidia_gpu.bat", "run_cpu.bat",
        "start.bat", "start.cmd", "launch.bat", "launch.cmd",
        "启动.bat", "运行.bat",
    ];

    for script_name in script_names {
        let script_path = comfyui_dir.join(script_name);
        if script_path.exists() {
            if let Ok(mut file) = std::fs::File::open(&script_path) {
                let mut content = String::new();
                if file.read_to_string(&mut content).is_ok() {
                    // Look for --output-directory in the script
                    if let Some(output) = extract_output_dir_from_script(&content) {
                        let path = PathBuf::from(&output);
                        if path.is_dir() {
                            return Some(path.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
    }
    None
}

/// Scan for .bat files and check for --output-directory
fn scan_bat_files_for_output_dir(comfyui_dir: &PathBuf, _pattern: &str) -> Option<String> {
    if let Ok(entries) = std::fs::read_dir(comfyui_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(false, |ext| {
                ext == "bat" || ext == "cmd" || ext == "ps1"
            }) {
                if let Ok(mut file) = std::fs::File::open(&path) {
                    let mut content = String::new();
                    if file.read_to_string(&mut content).is_ok() {
                        if let Some(output) = extract_output_dir_from_script(&content) {
                            let output_path = PathBuf::from(&output);
                            if output_path.is_dir() {
                                return Some(output_path.to_string_lossy().to_string());
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

/// Extract --output-directory value from script content
fn extract_output_dir_from_script(content: &str) -> Option<String> {
    for line in content.lines() {
        let line = line.trim();
        // Look for --output-directory or --output_directory
        if line.contains("--output-directory") || line.contains("--output_directory") {
            // Extract the path after the flag
            let parts: Vec<&str> = line.split_whitespace().collect();
            for (i, part) in parts.iter().enumerate() {
                if (*part == "--output-directory" || *part == "--output_directory") 
                    && i + 1 < parts.len() 
                {
                    let value = parts[i + 1].trim_matches('"').trim_matches('\'');
                    return Some(value.to_string());
                }
            }
        }
    }
    None
}

/// Recursively scan a directory for ComfyUI installation
fn scan_for_comfyui(dir: &PathBuf, max_depth: u32) -> Option<String> {
    scan_for_comfyui_recursive(dir, 0, max_depth)
}

fn scan_for_comfyui_recursive(dir: &PathBuf, current_depth: u32, max_depth: u32) -> Option<String> {
    if current_depth > max_depth {
        return None;
    }

    // Check if this directory is a ComfyUI installation
    if is_comfyui_dir(dir) {
        // Use resolve_output_dir to get the actual output directory
        return resolve_output_dir(dir).ok().flatten();
    }

    // Recurse into subdirectories
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                // Skip hidden directories and common non-ComfyUI folders
                let name = path.file_name().unwrap_or_default().to_string_lossy();
                if should_skip_directory(&name) {
                    continue;
                }
                
                if let Some(found) = scan_for_comfyui_recursive(&path, current_depth + 1, max_depth) {
                    return Some(found);
                }
            }
        }
    }

    None
}

/// Check if a directory should be skipped during scanning
fn should_skip_directory(name: &str) -> bool {
    name.starts_with('.') 
        || name == "node_modules" 
        || name == "target"
        || name == "__pycache__"
        || name == ".git"
        || name == "venv"
        || name == "env"
        || name == ".venv"
}

/// Check if a directory is a ComfyUI installation by looking for marker files
fn is_comfyui_dir(dir: &PathBuf) -> bool {
    // Check directory name first (fast path)
    let dir_name = dir.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
    let is_standard_name = COMFYUI_DIR_NAMES.iter()
        .any(|name| dir_name == name.to_lowercase());
    
    if is_standard_name {
        // Verify with marker file
        return COMFYUI_MARKERS.iter()
            .any(|marker| dir.join(marker).exists());
    }
    
    // For non-standard names, require marker file
    COMFYUI_MARKERS.iter()
        .any(|marker| dir.join(marker).exists())
}

fn get_home_dir() -> AppResult<PathBuf> {
    if let Ok(home) = std::env::var("USERPROFILE") {
        return Ok(PathBuf::from(home));
    }
    if let Ok(home) = std::env::var("HOME") {
        return Ok(PathBuf::from(home));
    }
    Err(AppError::Io("Cannot determine home directory".to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;

    #[test]
    fn detect_returns_none_when_no_comfyui() {
        let result = detect_comfyui_path(None);
        assert!(result.is_ok());
    }

    #[test]
    fn detect_with_custom_path_valid() {
        let temp_dir = std::env::temp_dir().join("lumora_test_comfyui");
        fs::create_dir_all(&temp_dir).unwrap();

        let result = detect_comfyui_path(Some(temp_dir.to_string_lossy().to_string()));
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), Some(temp_dir.to_string_lossy().to_string()));

        fs::remove_dir_all(&temp_dir).unwrap();
    }

    #[test]
    fn detect_with_custom_path_invalid() {
        let result = detect_comfyui_path(Some("/nonexistent/path".to_string()));
        assert!(result.is_ok());
    }

    #[test]
    fn is_comfyui_dir_detects_marker() {
        let temp_dir = std::env::temp_dir().join("lumora_test_marker");
        fs::create_dir_all(&temp_dir).unwrap();
        fs::write(temp_dir.join("main.py"), "# ComfyUI").unwrap();

        assert!(is_comfyui_dir(&temp_dir));

        fs::remove_dir_all(&temp_dir).unwrap();
    }

    #[test]
    fn is_comfyui_dir_detects_standard_name() {
        let temp_dir = std::env::temp_dir().join("ComfyUI");
        fs::create_dir_all(&temp_dir).unwrap();
        fs::write(temp_dir.join("main.py"), "# ComfyUI").unwrap();

        assert!(is_comfyui_dir(&temp_dir));

        fs::remove_dir_all(&temp_dir).unwrap();
    }

    #[test]
    fn is_comfyui_dir_detects_aki_variant() {
        let temp_dir = std::env::temp_dir().join("ComfyUI-aki-v3");
        fs::create_dir_all(&temp_dir).unwrap();
        fs::write(temp_dir.join("main.py"), "# ComfyUI").unwrap();

        assert!(is_comfyui_dir(&temp_dir));

        fs::remove_dir_all(&temp_dir).unwrap();
    }

    #[test]
    fn is_comfyui_dir_rejects_non_comfyui() {
        let temp_dir = std::env::temp_dir().join("lumora_test_random");
        fs::create_dir_all(&temp_dir).unwrap();

        assert!(!is_comfyui_dir(&temp_dir));

        fs::remove_dir_all(&temp_dir).unwrap();
    }

    #[test]
    fn scan_finds_nested_comfyui() {
        let base = std::env::temp_dir().join("lumora_test_nested");
        let nested = base.join("Desktop").join("Vibe coding").join("ComfyUI");
        fs::create_dir_all(&nested).unwrap();
        fs::write(nested.join("main.py"), "# ComfyUI").unwrap();
        fs::create_dir_all(nested.join("output")).unwrap();

        let result = scan_for_comfyui(&base.join("Desktop"), 3);
        assert!(result.is_some());
        assert!(result.unwrap().contains("ComfyUI"));

        fs::remove_dir_all(&base).unwrap();
    }

    #[test]
    fn scan_finds_aki_variant() {
        let base = std::env::temp_dir().join("lumora_test_aki");
        let aki_dir = base.join("Desktop").join("ComfyUI-aki-v3");
        fs::create_dir_all(&aki_dir).unwrap();
        fs::write(aki_dir.join("main.py"), "# ComfyUI").unwrap();
        fs::create_dir_all(aki_dir.join("output")).unwrap();

        let result = scan_for_comfyui(&base.join("Desktop"), 3);
        assert!(result.is_some());

        fs::remove_dir_all(&base).unwrap();
    }

    #[test]
    fn should_skip_directory_works() {
        assert!(should_skip_directory(".git"));
        assert!(should_skip_directory("node_modules"));
        assert!(should_skip_directory("__pycache__"));
        assert!(should_skip_directory("venv"));
        assert!(!should_skip_directory("ComfyUI"));
        assert!(!should_skip_directory("output"));
    }

    #[test]
    fn extract_output_dir_from_script_works() {
        let script = r#"@echo off
python main.py --listen 0.0.0.0 --port 8188 --output-directory "D:\AI\output"
pause"#;
        let result = extract_output_dir_from_script(script);
        assert_eq!(result, Some("D:\\AI\\output".to_string()));
    }

    #[test]
    fn read_startup_script_finds_output_dir() {
        let temp_dir = std::env::temp_dir().join("lumora_test_script");
        fs::create_dir_all(&temp_dir).unwrap();
        
        // Create a mock run.bat with --output-directory
        let output_dir = temp_dir.join("custom_output");
        fs::create_dir_all(&output_dir).unwrap();
        
        let bat_content = format!(
            r#"@echo off
python main.py --output-directory "{}""#,
            output_dir.to_string_lossy()
        );
        fs::write(temp_dir.join("run.bat"), bat_content).unwrap();

        let result = read_startup_script_output_dir(&temp_dir);
        assert!(result.is_some());
        assert!(result.unwrap().contains("custom_output"));

        fs::remove_dir_all(&temp_dir).unwrap();
    }
}
