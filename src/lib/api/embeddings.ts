// Mock API — all functions return browser-only mock data

export interface EmbeddingStatus {
  imageId: string
  status: 'embedded' | 'pending' | 'error'
  dimensions?: number
  model?: string
  generatedAt?: string
  errorMessage?: string
}

export interface BatchGenerationState {
  batchId: string
  total: number
  current: number
  status: 'generating' | 'complete' | 'error' | 'cancelled'
}

export async function getEmbeddingStatus(_imageIds: string[]): Promise<EmbeddingStatus[]> {
  return []
}

export async function generateEmbeddings(_imageIds: string[]): Promise<{ batchId: string }> {
  return { batchId: `batch-${Date.now()}` }
}

export async function cancelEmbeddingGeneration(_batchId: string): Promise<void> {
  // Noop stub
}
