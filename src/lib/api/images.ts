import { invoke } from "@tauri-apps/api/core";

export interface ImageRecord {
  id: number;
  file_path: string;
  file_hash: string;
  file_size_kb: number;
  width: number | null;
  height: number | null;
  format: string;
  created_at: string;
  rating: number;
  favorite: boolean;
  metadata_json: string | null;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export async function getImageCount(): Promise<number> {
  return invoke("get_image_count");
}

export async function getImages(
  limit: number,
  offset: number,
): Promise<ImageRecord[]> {
  return invoke("get_images", { limit, offset });
}

export async function importFolder(folderPath: string): Promise<ImportResult> {
  return invoke("import_folder", { folderPath });
}

export async function updateImageRating(imageId: number, rating: number): Promise<void> {
  return invoke("update_image_rating", { imageId, rating });
}

export async function toggleImageFavorite(imageId: number): Promise<void> {
  return invoke("toggle_image_favorite", { imageId });
}

export async function deleteImage(imageId: number): Promise<void> {
  return invoke("delete_image", { imageId });
}

export async function searchImages(query: string): Promise<ImageRecord[]> {
  return invoke("search_images", { query });
}
