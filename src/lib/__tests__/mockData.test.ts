import { describe, it, expect } from 'vitest';
import { invoke } from '../tauri';

/**
 * Browser (dev) mode must never resolve `null` for commands whose consumers
 * map over or destructure the result — that would crash the mock UI.
 */
describe('browser mock mode data contracts', () => {
  it('returns arrays for list-like commands', async () => {
    for (const cmd of [
      'search_images_advanced',
      'search_semantic_cmd',
      'get_variant_group_images',
      'embed_text_cmd',
      'clip_embed_image_cmd',
      'clip_embed_text_cmd',
    ]) {
      expect(await invoke(cmd), cmd).toEqual([]);
    }
  });

  it('returns object-shaped mocks for stats/lan/tag commands', async () => {
    expect(await invoke('get_embedding_stats_cmd')).toEqual({
      embedded: 0,
      pending: 0,
      error: 0,
      total: 0,
      missing: 0,
    });
    expect(await invoke('score_missing_cmd')).toEqual({
      processed: 0,
      remaining: 0,
    });
    expect(await invoke('get_lan_info')).toMatchObject({
      ip: expect.any(String),
      port: expect.any(Number),
      token: expect.any(String),
    });
    expect(await invoke('create_tag')).toMatchObject({ id: 'mock-tag' });
    expect(await invoke('apply_ai_tags_cmd')).toBe(0);
    expect(await invoke('export_database')).toBe('');
  });

  it('never returns null for read commands', async () => {
    const readCommands = [
      'list_images',
      'list_images_filtered',
      'list_trash',
      'list_tags',
      'search_images',
      'search_images_advanced',
      'get_image_tags',
      'list_favorites',
      'get_dashboard_stats',
      'get_embedding_stats_cmd',
      'get_embedding_status_cmd',
      'get_analysis_history_cmd',
      'get_lan_info',
      'get_variant_group_images',
      'search_semantic_cmd',
      'get_ollama_host',
      'check_ollama_status',
      'is_directory',
    ];
    for (const cmd of readCommands) {
      expect(await invoke(cmd), cmd).not.toBeNull();
    }
  });

  it('uses null only where it is a valid semantic value', async () => {
    expect(await invoke('get_analysis_result_cmd')).toBeNull();
    expect(await invoke('detect_comfyui_path')).toBeNull();
  });
});
