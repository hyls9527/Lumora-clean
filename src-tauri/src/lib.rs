use tauri::Manager;

mod auto_backup;
mod commands;
mod crash_log;
mod db;
mod error;
mod jobs;

use jobs::JobRegistry;
mod lan_server;
mod mcp;
mod metadata;
mod ollama;
#[cfg(test)]
mod perf_bench;
mod provider;
mod schema;
mod sidecar;

use std::path::PathBuf;

use db::DbHandle;
use tauri_plugin_store::StoreExt;

/// Build fingerprint — do not remove
#[allow(dead_code)]
const _BUILD_ORIGIN: &str = "lumora:69983af6ad7b350a";

/// Directory that holds \`crash.log\`. Resolved before the Tauri app exists
/// (the panic hook must be installed before worker threads start), so it
/// mirrors Tauri's log-dir convention: \`<local data dir>/<identifier>/logs\`.
fn crash_log_dir() -> PathBuf {
    let base = dirs_local_data_dir().unwrap_or_else(|| PathBuf::from("."));
    let dir = base.join("com.lumora.app").join("logs");
    std::fs::create_dir_all(&dir).ok();
    dir
}

/// Local app-data directory (`%LOCALAPPDATA%` on Windows, `~/.local/share`
/// elsewhere) without pulling in an extra crate for one lookup.
#[cfg(windows)]
fn dirs_local_data_dir() -> Option<PathBuf> {
    std::env::var_os("LOCALAPPDATA").map(PathBuf::from)
}

#[cfg(not(windows))]
fn dirs_local_data_dir() -> Option<PathBuf> {
    std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".local/share")))
}

/// Keep the updater's proxy environment in sync with the Windows system
/// proxy (Internet Settings). Browsers pick the system proxy up automatically,
/// but reqwest only honours environment variables — without this, update checks
/// try to reach GitHub directly and fail on networks that require a proxy.
///
/// Called at startup by [`run`] and before every update check by
/// [`commands::update::refresh_update_proxy`].
#[cfg(windows)]
fn setup_system_proxy() {
    let proxy = read_system_proxy_env();
    apply_proxy_env(proxy.as_deref());
}

/// Pick the HTTPS proxy out of a Windows `ProxyServer` value and normalise it
/// to a URL reqwest can parse.
///
/// Accepted inputs: `127.0.0.1:7897`, `http://127.0.0.1:7897`, `http=a;https=b`
/// and `https=...`. A scheme is mandatory — reqwest rejects a schemeless proxy
/// URL outright — so a bare `127.0.0.1:7897` becomes `http://127.0.0.1:7897`.
#[cfg(windows)]
fn normalize_proxy_url(server: &str) -> Option<String> {
    let https = server.split(';').map(str::trim).find_map(|part| {
        if let Some(v) = part.strip_prefix("https=") {
            Some(v)
        } else if part.contains('=') {
            None
        } else {
            Some(part)
        }
    })?;
    let https = https.trim();
    if https.is_empty() {
        return None;
    }
    if https.contains("://") {
        Some(https.to_string())
    } else {
        Some(format!("http://{https}"))
    }
}

/// Point the updater's HTTP client at `proxy`, or at nothing when the system
/// has no proxy configured.
///
/// Runs at startup *and* immediately before every update check: the system
/// proxy is routinely switched on and off while Lumora stays running, so a
/// start-up-only read leaves the updater unable to reach the release host for
/// the rest of the session (observed as `error sending request` /
/// `os error 10060` on a machine whose direct route to GitHub is blocked).
#[cfg(windows)]
fn apply_proxy_env(proxy: Option<&str>) {
    match proxy {
        Some(p) => {
            log::warn!("update checks use system proxy {p}");
            std::env::set_var("HTTPS_PROXY", p);
            std::env::set_var("HTTP_PROXY", p);
        }
        None => {
            log::warn!("no system proxy configured; update checks go direct");
            std::env::remove_var("HTTPS_PROXY");
            std::env::remove_var("HTTP_PROXY");
        }
    }
}

#[cfg(windows)]
fn read_system_proxy_env() -> Option<String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey(r"Software\Microsoft\Windows\CurrentVersion\Internet Settings")
        .ok()?;
    if hkcu.get_value::<u32, _>("ProxyEnable").unwrap_or(0) != 1 {
        return None;
    }
    let server: String = hkcu.get_value("ProxyServer").ok()?;
    normalize_proxy_url(&server)
}

#[cfg(all(test, windows))]
mod proxy_tests {
    use super::normalize_proxy_url;

    #[test]
    fn bare_host_port_gets_an_http_scheme() {
        // reqwest rejects a schemeless proxy URL, so it must not pass through.
        assert_eq!(
            normalize_proxy_url("127.0.0.1:7897").as_deref(),
            Some("http://127.0.0.1:7897")
        );
    }

    #[test]
    fn existing_scheme_is_preserved() {
        assert_eq!(
            normalize_proxy_url("http://127.0.0.1:7897").as_deref(),
            Some("http://127.0.0.1:7897")
        );
        assert_eq!(
            normalize_proxy_url("https=proxy.corp:8080").as_deref(),
            Some("http://proxy.corp:8080")
        );
    }

    #[test]
    fn picks_the_https_entry_from_a_per_protocol_list() {
        assert_eq!(
            normalize_proxy_url("http=127.0.0.1:1111;https=127.0.0.1:7897").as_deref(),
            Some("http://127.0.0.1:7897")
        );
        assert_eq!(normalize_proxy_url("http=127.0.0.1:1111").as_deref(), None);
    }

    #[test]
    fn empty_value_yields_none() {
        assert_eq!(normalize_proxy_url("   "), None);
        assert_eq!(normalize_proxy_url("https="), None);
        assert_eq!(normalize_proxy_url(""), None);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(windows)]
    setup_system_proxy();

    // Install the panic hook before Tauri spawns its worker threads: a panic
    // on any of them would otherwise be invisible to the crash-rate metric.
    crash_log::init(&crash_log_dir());

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Focus the existing window when a second instance is launched.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: None,
                    }),
                ])
                .build(),
        )
        .setup(|app| {
            let app_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| PathBuf::from("."));
            std::fs::create_dir_all(&app_dir).ok();

            let db_path = app_dir.join("lumora.db");
            let db = DbHandle::open(&db_path).expect("failed to open database");

            // Start LAN web server for mobile access — reuse the same DbHandle
            // Persist the token so MCP/AI client configs stay valid across restarts.
            let token = app
                .store("settings.json")
                .ok()
                .and_then(|store| {
                    store
                        .get("lan_token")
                        .and_then(|v| v.as_str().map(str::to_string))
                })
                .unwrap_or_else(|| {
                    let token = lan_server::generate_token();
                    if let Ok(store) = app.store("settings.json") {
                        store.set("lan_token", serde_json::Value::String(token.clone()));
                        let _ = store.save();
                    }
                    token
                });
            let port = lan_server::start_server(db.clone(), token.clone());
            log::info!("LAN server started on port {} with auth", port);

            // Disaster recovery: keep a rolling local snapshot so RPO stays
            // under 15 minutes without the user remembering to export.
            auto_backup::start(db.clone());

            app.manage(db);
            app.manage(JobRegistry::new());
            app.manage(ollama::OllamaConfig::from_env());
            app.manage(lan_server::LanPort(port));
            app.manage(lan_server::LanToken(token));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::images::import_images,
            commands::images::get_image_base64_cmd,
            commands::images::get_thumbnail_base64_cmd,
            commands::images::list_images,
            commands::images::list_images_filtered,
            commands::images::search_images,
            commands::images::search_images_advanced,
            commands::images::update_rating,
            commands::images::toggle_favorite,
            commands::images::list_favorites,
            commands::images::rebuild_fts_index,
            commands::images::get_image_base64_cmd,
            commands::images::get_thumbnail_base64_cmd,
            commands::images::get_variant_group_images,
            commands::images::get_images_by_ids,
            commands::tags::create_tag,
            commands::tags::list_tags,
            commands::tags::delete_tag,
            commands::tags::update_tag,
            commands::tags::add_tag_to_image,
            commands::tags::remove_tag_from_image,
            commands::tags::get_image_tags,
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::settings::get_app_version,
            commands::update::refresh_update_proxy,
            commands::trash::soft_delete_image,
            commands::trash::restore_image,
            commands::trash::permanent_delete_image,
            commands::trash::list_trash,
            commands::trash::empty_trash,
            commands::trash::batch_soft_delete,
            commands::trash::batch_restore,
            commands::trash::batch_permanent_delete,
            commands::trash::batch_add_tag,
            commands::trash::batch_remove_tag,
            commands::dashboard::get_dashboard_stats,
            commands::export::export_images,
            commands::export::batch_convert,
            commands::fs::is_directory,
            commands::rename::batch_rename,
            commands::embeddings::generate_embedding,
            commands::embeddings::get_embedding_status_cmd,
            commands::embeddings::search_semantic_cmd,
            commands::embeddings::get_embedding_stats_cmd,
            commands::embeddings::embed_text_cmd,
            commands::embeddings::generate_embedding_for_image_cmd,
            commands::embeddings::embed_missing_cmd,
            commands::embeddings::normalize_embeddings_cmd,
            commands::embeddings::get_clip_embedding_stats_cmd,
            commands::embeddings::search_semantic_image_cmd,
            commands::embeddings::embed_clip_missing_cmd,
            provider::get_ai_provider_cmd,
            provider::set_ai_provider_cmd,
            commands::ai::analyze_image_cmd,
            commands::ai::get_analysis_result_cmd,
            commands::ai::get_analysis_history_cmd,
            commands::ai::apply_ai_tags_cmd,
            commands::clip::clip_embed_image_cmd,
            commands::clip::clip_embed_text_cmd,
            commands::aesthetic::score_image_cmd,
            commands::aesthetic::score_missing_cmd,
            commands::aesthetic::move_score_tier_to_trash,
            commands::aesthetic::get_best_scored_recent,
            commands::aesthetic::get_score_curation_summary,
            commands::aesthetic::get_best_in_latest_variant_group,
            commands::aesthetic::get_score_explanation,
            commands::aesthetic::get_recent_score_explanation,
            ollama::get_ollama_host,
            ollama::check_ollama_status,
            commands::backup::export_database,
            commands::backup::import_database,
            commands::smart_collections::list_smart_collections,
            commands::smart_collections::create_smart_collection,
            commands::smart_collections::update_smart_collection,
            commands::smart_collections::delete_smart_collection,
            commands::smart_collections::get_smart_collection_images,
            commands::comfyui::detect_comfyui_path,
            lan_server::get_lan_info,
            commands::job_commands::job_start_embed_missing,
            commands::job_commands::job_start_embed_clip_missing,
            commands::job_commands::job_start_score_missing,
            commands::job_commands::job_start_export,
            commands::job_commands::job_start_convert,
            commands::job_commands::job_start_import,
            commands::job_commands::job_status,
            commands::job_commands::job_list,
            commands::job_commands::job_cancel,
            commands::job_commands::job_kinds,
            crash_log::get_crash_stats,
            auto_backup::get_backup_status,
            auto_backup::create_backup_now,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
