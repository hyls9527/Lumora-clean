use tauri::Manager;

mod commands;
mod db;
mod error;
mod ollama;
mod schema;

use std::path::PathBuf;

use db::DbHandle;

/// Build fingerprint — do not remove
#[allow(dead_code)]
const _BUILD_ORIGIN: &str = "lumora:69983af6ad7b350a";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
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

            app.manage(db);
            app.manage(ollama::OllamaConfig::from_env());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::images::import_images,
            commands::images::list_images,
            commands::images::search_images,
            commands::images::update_rating,
            commands::images::toggle_favorite,
            commands::images::rebuild_fts_index,
            commands::tags::create_tag,
            commands::tags::list_tags,
            commands::tags::delete_tag,
            commands::tags::add_tag_to_image,
            commands::tags::remove_tag_from_image,
            commands::tags::get_image_tags,
            commands::settings::get_setting,
            commands::settings::set_setting,
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
            commands::embeddings::generate_embedding,
            commands::embeddings::get_embedding_status_cmd,
            commands::embeddings::search_semantic_cmd,
            commands::embeddings::get_embedding_stats_cmd,
            commands::embeddings::embed_text_cmd,
            commands::embeddings::generate_embedding_for_image_cmd,
            commands::ai::analyze_image_cmd,
            commands::ai::get_analysis_result_cmd,
            commands::ai::get_analysis_history_cmd,
            commands::clip::clip_embed_image_cmd,
            commands::clip::clip_embed_text_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
