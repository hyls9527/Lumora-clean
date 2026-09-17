import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isDirectory } from '../fs';

vi.mock('../../tauri', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '../../tauri';
const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('isDirectory', () => {
  it('asks the backend whether the path is a directory', async () => {
    mockInvoke.mockResolvedValueOnce(true);

    await expect(isDirectory('C:/lib')).resolves.toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith('is_directory', { path: 'C:/lib' });
  });

  it('returns false for a file path', async () => {
    mockInvoke.mockResolvedValueOnce(false);

    await expect(isDirectory('C:/lib/a.png')).resolves.toBe(false);
  });
});
