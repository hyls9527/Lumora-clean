import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listSmartCollections,
  createSmartCollection,
  updateSmartCollection,
  deleteSmartCollection,
  getSmartCollectionImages,
  type SmartCollectionRule,
} from '../smartCollections';

vi.mock('../../tauri', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '../../tauri';
const mockInvoke = vi.mocked(invoke);

const rules: SmartCollectionRule[] = [
  { field: 'model', op: 'contains', value: 'flux' },
  { field: 'rating', op: 'gte', value: '4' },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('smart collection CRUD', () => {
  it('lists collections from the backend', async () => {
    const stored = [
      { id: 'sc1', name: 'Flux keepers', rules, createdAt: '2025-01-01', count: 12 },
    ];
    mockInvoke.mockResolvedValueOnce(stored);

    await expect(listSmartCollections()).resolves.toEqual(stored);
    expect(mockInvoke).toHaveBeenCalledWith('list_smart_collections');
  });

  it('creates a collection with its rules', async () => {
    const created = { id: 'sc2', name: 'New', rules, createdAt: '2025-01-02', count: 0 };
    mockInvoke.mockResolvedValueOnce(created);

    await expect(createSmartCollection('New', rules)).resolves.toEqual(created);
    expect(mockInvoke).toHaveBeenCalledWith('create_smart_collection', {
      name: 'New',
      rules,
    });
  });

  it('updates name and rules of an existing collection', async () => {
    const updated = { id: 'sc1', name: 'Renamed', rules, createdAt: '2025-01-01', count: 3 };
    mockInvoke.mockResolvedValueOnce(updated);

    await expect(updateSmartCollection('sc1', 'Renamed', rules)).resolves.toEqual(updated);
    expect(mockInvoke).toHaveBeenCalledWith('update_smart_collection', {
      id: 'sc1',
      name: 'Renamed',
      rules,
    });
  });

  it('deletes a collection by id', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    await deleteSmartCollection('sc1');

    expect(mockInvoke).toHaveBeenCalledWith('delete_smart_collection', { id: 'sc1' });
  });

  it('surfaces a create failure', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('name already taken'));

    await expect(createSmartCollection('New', [])).rejects.toThrow('name already taken');
  });
});

describe('getSmartCollectionImages', () => {
  it('maps raw Tauri records onto ImageRecord and keeps the total', async () => {
    mockInvoke.mockResolvedValueOnce({
      total: 42,
      items: [
        {
          id: 'img-1',
          filePath: 'C:/lib/fox.png',
          fileHash: 'h1',
          fileSizeKb: 128,
          width: 1024,
          height: 1024,
          format: 'png',
          createdAt: '2025-01-01',
          importedAt: '2025-01-01',
          deleted: false,
          deletedAt: null,
          rating: 5,
          favorite: true,
          metadataJson: JSON.stringify({ model: 'flux-dev', prompt: 'a fox', steps: 28 }),
          tags: ['keeper'],
        },
      ],
    });

    const result = await getSmartCollectionImages('sc1', 2, 40);

    expect(mockInvoke).toHaveBeenCalledWith('get_smart_collection_images', {
      id: 'sc1',
      page: 2,
      perPage: 40,
    });
    expect(result.total).toBe(42);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'img-1',
      fileName: 'fox.png',
      width: 1024,
      rating: 5,
      favorite: true,
      model: 'flux-dev',
      prompt: 'a fox',
      steps: 28,
      tags: ['keeper'],
    });
  });

  it('returns an empty page when nothing matches', async () => {
    mockInvoke.mockResolvedValueOnce({ items: [], total: 0 });

    await expect(getSmartCollectionImages('sc1', 1, 40)).resolves.toEqual({
      items: [],
      total: 0,
    });
  });
});
