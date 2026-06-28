/**
 * Batch operations API — delegates to real Tauri commands.
 */

import { invoke } from '../tauri';

/**
 * Batch soft-delete: move multiple images to trash.
 */
export async function batchSoftDelete(ids: string[]): Promise<number> {
  return invoke<number>('batch_soft_delete', { ids });
}

/**
 * Batch restore: restore multiple images from trash.
 */
export async function batchRestore(ids: string[]): Promise<number> {
  return invoke<number>('batch_restore', { ids });
}

/**
 * Batch permanent delete: permanently delete multiple images.
 */
export async function batchPermanentDelete(ids: string[]): Promise<number> {
  return invoke<number>('batch_permanent_delete', { ids });
}

/**
 * Batch add tag: add a tag to multiple images.
 */
export async function batchAddTag(imageIds: string[], tagId: string): Promise<number> {
  return invoke<number>('batch_add_tag', { imageIds, tagId });
}

/**
 * Batch remove tag: remove a tag from multiple images.
 */
export async function batchRemoveTag(imageIds: string[], tagId: string): Promise<number> {
  return invoke<number>('batch_remove_tag', { imageIds, tagId });
}
