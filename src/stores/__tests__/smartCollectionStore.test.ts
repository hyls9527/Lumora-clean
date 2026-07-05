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
});

beforeEach(() => {
  vi.clearAllMocks();
  useSmartCollectionStore.setState({
    collections: [],
    loading: false,
    error: null,
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

  it('sets error message on failure', async () => {
    mockInvoke.mockRejectedValue(new Error('load failed'));

    await useSmartCollectionStore.getState().load();

    expect(useSmartCollectionStore.getState().error).toBe('load failed');
    expect(useSmartCollectionStore.getState().loading).toBe(false);
  });
});
