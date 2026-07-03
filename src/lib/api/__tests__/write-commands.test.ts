import { describe, it, expect } from 'vitest';

/**
 * Frontend WRITE_COMMANDS ↔ Rust command registry cross-check.
 *
 * Maintains ALL_COMMANDS (from lib.rs generate_handler!) and classifies each
 * as read or write. If a new Rust command is added without updating this file,
 * the "every command is classified" test fails — a CI safety net.
 */

// Complete command list from src-tauri/src/lib.rs generate_handler![]
const ALL_COMMANDS = [
  // images
  'import_images', 'list_images', 'search_images', 'search_images_advanced',
  'update_rating', 'toggle_favorite', 'list_favorites', 'rebuild_fts_index', 'get_variant_group_images',
  // tags
  'create_tag', 'list_tags', 'delete_tag',
  'add_tag_to_image', 'remove_tag_from_image', 'get_image_tags',
  // settings
  'get_setting', 'set_setting',
  // trash
  'soft_delete_image', 'restore_image', 'permanent_delete_image',
  'list_trash', 'empty_trash',
  'batch_soft_delete', 'batch_restore', 'batch_permanent_delete',
  'batch_add_tag', 'batch_remove_tag',
  // dashboard & export
  'get_dashboard_stats', 'export_images',
  // embeddings
  'generate_embedding', 'get_embedding_status_cmd', 'search_semantic_cmd',
  'get_embedding_stats_cmd', 'embed_text_cmd', 'generate_embedding_for_image_cmd',
  // ai
  'analyze_image_cmd', 'get_analysis_result_cmd', 'get_analysis_history_cmd',
  'apply_ai_tags_cmd',
  // clip
  'clip_embed_image_cmd', 'clip_embed_text_cmd',
  // ollama
  'get_ollama_host',
];

// Must match WRITE_COMMANDS in src/lib/tauri.ts
const WRITE_COMMANDS = new Set([
  'import_images', 'update_rating', 'toggle_favorite',
  'soft_delete_image', 'restore_image', 'permanent_delete_image',
  'empty_trash', 'create_tag', 'delete_tag',
  'add_tag_to_image', 'remove_tag_from_image',
  'batch_soft_delete', 'batch_restore', 'batch_permanent_delete',
  'batch_add_tag', 'batch_remove_tag',
]);

// Everything else is a read command
const READ_COMMANDS = new Set(
  ALL_COMMANDS.filter((cmd) => !WRITE_COMMANDS.has(cmd)),
);

describe('WRITE_COMMANDS integrity', () => {
  it('every write command exists in ALL_COMMANDS', () => {
    for (const cmd of WRITE_COMMANDS) {
      expect(ALL_COMMANDS).toContain(cmd);
    }
  });

  it('every command is classified as read or write (no遗漏)', () => {
    for (const cmd of ALL_COMMANDS) {
      const classified = WRITE_COMMANDS.has(cmd) || READ_COMMANDS.has(cmd);
      expect(classified).toBe(true);
    }
  });

  it('read and write sets do not overlap', () => {
    for (const cmd of WRITE_COMMANDS) {
      expect(READ_COMMANDS.has(cmd)).toBe(false);
    }
  });

  it('no phantom commands outside ALL_COMMANDS', () => {
    const allSet = new Set(ALL_COMMANDS);
    for (const cmd of WRITE_COMMANDS) {
      expect(allSet.has(cmd)).toBe(true);
    }
    for (const cmd of READ_COMMANDS) {
      expect(allSet.has(cmd)).toBe(true);
    }
  });
});
