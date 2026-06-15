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
