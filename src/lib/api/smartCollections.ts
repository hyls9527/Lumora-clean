import { invoke } from '../tauri';
import { toImageRecord, type TauriImageRecord } from './images';
import type { ImageRecord } from '../../types/image';

/** A single filter rule inside a smart collection. */
export interface SmartCollectionRule {
  field: 'model' | 'prompt' | 'rating' | 'score' | 'date' | 'format' | 'tag';
  op: 'equals' | 'contains' | 'gte' | 'lte' | 'in';
  value: string;
}

export interface SmartCollection {
  id: string;
  name: string;
  rules: SmartCollectionRule[];
  createdAt: string;
  /** Number of images currently matching all rules. */
  count: number;
}

interface TauriSmartCollection extends Omit<SmartCollection, 'createdAt'> {
  createdAt: string;
}

interface TauriPaginatedImages {
  items: TauriImageRecord[];
  total: number;
}

export async function listSmartCollections(): Promise<SmartCollection[]> {
  return invoke<TauriSmartCollection[]>('list_smart_collections');
}

export async function createSmartCollection(
  name: string,
  rules: SmartCollectionRule[],
): Promise<SmartCollection> {
  return invoke<TauriSmartCollection>('create_smart_collection', { name, rules });
}

export async function updateSmartCollection(
  id: string,
  name: string,
  rules: SmartCollectionRule[],
): Promise<SmartCollection> {
  return invoke<TauriSmartCollection>('update_smart_collection', { id, name, rules });
}

export async function deleteSmartCollection(id: string): Promise<void> {
  await invoke('delete_smart_collection', { id });
}

export async function getSmartCollectionImages(
  id: string,
  page: number,
  perPage: number,
): Promise<{ items: ImageRecord[]; total: number }> {
  const raw = await invoke<TauriPaginatedImages>('get_smart_collection_images', {
    id,
    page,
    perPage,
  });
  return {
    items: raw.items.map(toImageRecord),
    total: raw.total,
  };
}
