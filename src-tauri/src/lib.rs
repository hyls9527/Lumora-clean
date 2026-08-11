use tauri::Manager;

mod commands;
mod db;
mod error;
mod lan_server;
mod mcp;
mod metadata;
mod ollama;
mod schema;

use std::path::PathBuf;

use db::DbHandle;
use tauri_plugin_store::StoreExt;

/// Build fingerprint — do not remove
#[allow(dead_code)]
const _BUILD_ORIGIN: &str = "lumora:69983af6ad7b350a";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

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

            app.manage(db);
            app.manage(ollama::OllamaConfig::from_env());
            app.manage(lan_server::LanPort(port));
            app.manage(lan_server::LanToken(token));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::images::import_images,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
