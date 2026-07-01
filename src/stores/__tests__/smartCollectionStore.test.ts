import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock tauri — must match the import path used by smartCollectionStore
vi.mock('../../lib/tauri', () => ({
  invoke: vi.fn(),
  isTauriAvailable: false,
}));

import { useSmartCollectionStore } from '../smartCollectionStore';
import type { SmartCollection } from '../smartCollectionStore';
import * as tauri from '../../lib/tauri';

const mockInvoke = vi.mocked(tauri.invoke);

const makeCollection = (id: string, name: string): SmartCollection => ({
  id,
  name,
  rules: [{ field: 'rating', op: 'gte', value: 4 }],
  logic: 'AND',
});

beforeEach(() => {
  vi.clearAllMocks();
  useSmartCollectionStore.setState({
    collections: [],
    loading: false,
  });
});

describe('load', () => {
  it('loads collections from setting', async () => {
    const stored = [makeCollection('a', 'High Rating')];
    mockInvoke.mockResolvedValue(JSON.stringify(stored));

    await useSmartCollectionStore.getState().load();

    const s = useSmartCollectionStore.getState();
    expect(s.collections).toEqual(stored);
    expect(s.loading).toBe(false);
    expect(mockInvoke).toHaveBeenCalledWith('get_setting', { key: 'smart_collections' });
  });

  it('sets empty array when no setting exists', async () => {
    mockInvoke.mockResolvedValue(null);

    await useSmartCollectionStore.getState().load();

    expect(useSmartCollectionStore.getState().collections).toEqual([]);
    expect(useSmartCollectionStore.getState().loading).toBe(false);
  });

  it('sets loading to false on error', async () => {
    mockInvoke.mockRejectedValue(new Error('backend unavailable'));

    await useSmartCollectionStore.getState().load();

    expect(useSmartCollectionStore.getState().loading).toBe(false);
  });
});

describe('addCollection', () => {
  it('appends a new collection and persists', async () => {
    mockInvoke.mockResolvedValue(null);

    await useSmartCollectionStore.getState().addCollection(
      'My Collection',
      [{ field: 'model', op: 'contains', value: 'SDXL' }],
      'AND',
    );

    const s = useSmartCollectionStore.getState();
    expect(s.collections).toHaveLength(1);
    expect(s.collections[0].name).toBe('My Collection');
    expect(s.collections[0].rules).toEqual([{ field: 'model', op: 'contains', value: 'SDXL' }]);
    expect(s.collections[0].logic).toBe('AND');
    expect(s.collections[0].id).toBeDefined();
    expect(mockInvoke).toHaveBeenCalledWith('set_setting', {
      key: 'smart_collections',
      value: expect.any(String),
    });
  });

  it('preserves existing collections', async () => {
    const existing = makeCollection('existing', 'Existing');
    useSmartCollectionStore.setState({ collections: [existing] });
    mockInvoke.mockResolvedValue(null);

    await useSmartCollectionStore.getState().addCollection(
      'New One',
      [{ field: 'rating', op: 'gte', value: 4 }],
      'AND',
    );

    expect(useSmartCollectionStore.getState().collections).toHaveLength(2);
    expect(useSmartCollectionStore.getState().collections[0].id).toBe('existing');
    expect(useSmartCollectionStore.getState().collections[1].name).toBe('New One');
  });
});

describe('removeCollection', () => {
  it('removes a collection by id', async () => {
    const a = makeCollection('a', 'A');
    const b = makeCollection('b', 'B');
    useSmartCollectionStore.setState({ collections: [a, b] });
    mockInvoke.mockResolvedValue(null);

    await useSmartCollectionStore.getState().removeCollection('a');

    const s = useSmartCollectionStore.getState();
    expect(s.collections).toHaveLength(1);
    expect(s.collections[0].id).toBe('b');
    expect(mockInvoke).toHaveBeenCalledWith('set_setting', {
      key: 'smart_collections',
      value: expect.any(String),
    });
  });

  it('does nothing when id not found', async () => {
    useSmartCollectionStore.setState({ collections: [makeCollection('a', 'A')] });
    mockInvoke.mockResolvedValue(null);

    await useSmartCollectionStore.getState().removeCollection('nonexistent');

    expect(useSmartCollectionStore.getState().collections).toHaveLength(1);
  });
});

describe('updateCollection', () => {
  it('updates collection fields by id', async () => {
    const a = makeCollection('a', 'Old Name');
    useSmartCollectionStore.setState({ collections: [a] });
    mockInvoke.mockResolvedValue(null);

    await useSmartCollectionStore.getState().updateCollection('a', { name: 'New Name' });

    expect(useSmartCollectionStore.getState().collections[0].name).toBe('New Name');
    expect(useSmartCollectionStore.getState().collections[0].id).toBe('a');
    expect(mockInvoke).toHaveBeenCalledWith('set_setting', {
      key: 'smart_collections',
      value: expect.any(String),
    });
  });

  it('updates rules', async () => {
    const a = makeCollection('a', 'A');
    useSmartCollectionStore.setState({ collections: [a] });
    mockInvoke.mockResolvedValue(null);

    const newRules = [{ field: 'prompt' as const, op: 'contains' as const, value: 'landscape' }];
    await useSmartCollectionStore.getState().updateCollection('a', { rules: newRules });

    expect(useSmartCollectionStore.getState().collections[0].rules).toEqual(newRules);
  });

  it('does not modify other collections', async () => {
    const a = makeCollection('a', 'A');
    const b = makeCollection('b', 'B');
    useSmartCollectionStore.setState({ collections: [a, b] });
    mockInvoke.mockResolvedValue(null);

    await useSmartCollectionStore.getState().updateCollection('a', { name: 'Changed' });

    expect(useSmartCollectionStore.getState().collections[1].name).toBe('B');
  });
});
