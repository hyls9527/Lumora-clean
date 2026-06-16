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

// Direct window.__TAURI__ access — avoids importing @tauri-apps/api/core entirely
// which crashes in browser mode due to missing window.__TAURI_INTERNALS__
async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const tauri = (window as any).__TAURI__;
  if (!tauri?.core?.invoke) {
    throw new Error("Tauri runtime not available");
  }
  return tauri.core.invoke(cmd, args);
}

export async function getImageCount(): Promise<number> {
  return tauriInvoke("get_image_count");
}

export async function getImages(limit: number, offset: number): Promise<ImageRecord[]> {
  return tauriInvoke("get_images", { limit, offset });
}

export async function importFolder(folderPath: string): Promise<ImportResult> {
  return tauriInvoke("import_folder", { folderPath });
}

export async function updateImageRating(imageId: number, rating: number): Promise<void> {
  return tauriInvoke("update_image_rating", { imageId, rating });
}

export async function toggleImageFavorite(imageId: number): Promise<void> {
  return tauriInvoke("toggle_image_favorite", { imageId });
}

export async function deleteImage(imageId: number): Promise<void> {
  return tauriInvoke("delete_image", { imageId });
}

export async function searchImages(query: string): Promise<ImageRecord[]> {
  return tauriInvoke("search_images", { query });
}

export async function openFolderDialog(): Promise<ImportResult> {
  return tauriInvoke("open_folder_dialog");
}
