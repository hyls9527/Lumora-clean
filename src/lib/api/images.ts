import { invoke } from '@tauri-apps/api/core';
import type { ImageRecord } from '../../stores/imageStore';

/** Tauri 返回的原始记录结构（camelCase，serde 重命名后） */
export interface TauriImageRecord {
  id: string;
  filePath: string;
  fileHash: string;
  fileSizeKb: number;
  width: number | null;
  height: number | null;
  format: string;
  createdAt: string;
  importedAt: string;
  deleted: boolean;
  deletedAt: string | null;
  rating: number;
  favorite: boolean;
  metadataJson: string | null;
}

interface TauriPaginatedResult {
  items: TauriImageRecord[];
  total: number;
  page: number;
  perPage: number;
}

/** 解析 metadata_json 中可选的 model / prompt / tags */
function parseMetadata(json: string | null): {
  model: string;
  prompt: string;
  tags: string[];
} {
  if (!json) return { model: '', prompt: '', tags: [] };
  try {
    const meta = JSON.parse(json);
    return {
      model: meta.model ?? '',
      prompt: meta.prompt ?? '',
      tags: Array.isArray(meta.tags) ? meta.tags : [],
    };
  } catch {
    return { model: '', prompt: '', tags: [] };
  }
}

/** 将 Tauri 记录转换为前端 ImageRecord */
function toImageRecord(raw: TauriImageRecord): ImageRecord {
  const { model, prompt, tags } = parseMetadata(raw.metadataJson);
  return {
    id: raw.id,
    filePath: raw.filePath,
    fileName: raw.filePath.split(/[/\\]/).pop() ?? raw.filePath,
    fileSizeKb: raw.fileSizeKb,
    width: raw.width ?? 0,
    height: raw.height ?? 0,
    format: raw.format as ImageRecord['format'],
    createdAt: raw.createdAt,
    rating: raw.rating,
    favorite: raw.favorite,
    deletedAt: raw.deletedAt ?? undefined,
    model,
    prompt,
    tags,
  };
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function importImages(
  folderPath: string,
): Promise<ImageRecord[]> {
  const raw = await invoke<TauriImageRecord[]>('import_images', {
    path: folderPath,
  });
  return raw.map(toImageRecord);
}

export async function listImages(
  page: number,
  perPage: number,
): Promise<{ items: ImageRecord[]; total: number }> {
  const raw = await invoke<TauriPaginatedResult>('list_images', {
    page,
    perPage,
  });
  return {
    items: raw.items.map(toImageRecord),
    total: raw.total,
  };
}

export async function searchImages(query: string): Promise<ImageRecord[]> {
  const raw = await invoke<TauriImageRecord[]>('search_images', { query });
  return raw.map(toImageRecord);
}

export async function updateRating(
  id: string,
  rating: number,
): Promise<void> {
  await invoke('update_rating', { id, rating });
}

export async function toggleFavorite(id: string): Promise<void> {
  await invoke('toggle_favorite', { id });
}

// ---------------------------------------------------------------------------
// Tag API
// ---------------------------------------------------------------------------

export interface TagRecord {
  id: string;
  name: string;
  color: string | null;
  createdAt: string;
}

export async function createTag(
  name: string,
  color: string | null,
): Promise<TagRecord> {
  return invoke<TagRecord>('create_tag', { name, color });
}

export async function listTags(): Promise<TagRecord[]> {
  return invoke<TagRecord[]>('list_tags');
}

export async function deleteTag(id: string): Promise<void> {
  await invoke('delete_tag', { id });
}

export async function addTagToImage(
  imageId: string,
  tagId: string,
): Promise<void> {
  await invoke('add_tag_to_image', { imageId, tagId });
}

export async function removeTagFromImage(
  imageId: string,
  tagId: string,
): Promise<void> {
  await invoke('remove_tag_from_image', { imageId, tagId });
}

export async function getImageTags(imageId: string): Promise<TagRecord[]> {
  return invoke<TagRecord[]>('get_image_tags', { imageId });
}

// ---------------------------------------------------------------------------
// Trash API
// ---------------------------------------------------------------------------

export async function softDeleteImage(id: string): Promise<void> {
  await invoke('soft_delete_image', { id });
}

export async function restoreImage(id: string): Promise<void> {
  await invoke('restore_image', { id });
}

export async function permanentDeleteImage(id: string): Promise<void> {
  await invoke('permanent_delete_image', { id });
}

export async function listTrash(
  page: number,
  perPage: number,
): Promise<{ items: ImageRecord[]; total: number }> {
  const raw = await invoke<TauriPaginatedResult>('list_trash', {
    page,
    perPage,
  });
  return {
    items: raw.items.map(toImageRecord),
    total: raw.total,
  };
}

export async function emptyTrash(): Promise<number> {
  return await invoke<number>('empty_trash');
}

// ---------------------------------------------------------------------------
// Dashboard API
// ---------------------------------------------------------------------------

export interface FormatCount {
  format: string;
  count: number;
}

export interface RatingCount {
  rating: number;
  count: number;
}

export interface TagCount {
  name: string;
  count: number;
}

export interface DashboardStats {
  totalImages: number;
  totalSizeKb: number;
  formatCounts: FormatCount[];
  ratingCounts: RatingCount[];
  topTags: TagCount[];
  recentImports: TauriImageRecord[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return invoke<DashboardStats>('get_dashboard_stats');
}

