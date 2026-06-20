// Mock API — all functions return browser-only mock data
export type ImageRecord = {
  id: string
  file_path: string
  file_name: string
  width: number
  height: number
  file_size: number
  format: string
  tags: string[]
  rating: number
  favorite: boolean
  created_at: string
}

export async function getImageCount(): Promise<number> {
  return 200
}

export async function getImages(_limit = 50, _offset = 0): Promise<ImageRecord[]> {
  return []
}

export async function importFolder(_path: string): Promise<number> {
  return 0
}

export async function updateImageRating(_id: string, _rating: number): Promise<void> {}

export async function toggleImageFavorite(_id: string): Promise<boolean> {
  return false
}

export async function deleteImage(_id: string): Promise<void> {}

export async function searchImages(_query: string): Promise<ImageRecord[]> {
  return []
}

export async function openFolderDialog(): Promise<string | null> {
  return null
}
