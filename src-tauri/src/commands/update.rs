//! Update-check support that has to run on the Rust side.

/// Re-read the Windows system proxy and point the updater's HTTP client at it.
///
/// The auto-updater reads `HTTPS_PROXY` when it builds its client, and the
/// Windows system proxy is switched on and off while Lumora stays running.
/// Reading it once at startup therefore leaves the updater on a direct route
/// that cannot reach GitHub on proxied networks, so the frontend calls this
/// immediately before every check.
#[tauri::command]
pub fn refresh_update_proxy() -> Result<(), String> {
    #[cfg(windows)]
    crate::setup_system_proxy();
    Ok(())
}

#[cfg(test)]
mod tests {
    /// Exercises the command body; the pure proxy parsing is covered by
    /// `crate::proxy_tests`.
    #[test]
    fn command_succeeds() {
        assert!(super::refresh_update_proxy().is_ok());
    }
}
