import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportDatabase, importDatabase } from '../backup';

vi.mock('../../tauri', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '../../tauri';
const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('backup API', () => {
  it('exports the database to the given destination and returns the path', async () => {
    mockInvoke.mockResolvedValueOnce('C:/backups/lumora-2025.db');

    await expect(exportDatabase('C:/backups/lumora-2025.db')).resolves.toBe(
      'C:/backups/lumora-2025.db',
    );
    expect(mockInvoke).toHaveBeenCalledWith('export_database', {
      destination: 'C:/backups/lumora-2025.db',
    });
  });

  it('imports a database from the given source and returns the path', async () => {
    mockInvoke.mockResolvedValueOnce('C:/backups/lumora-2025.db');

    await expect(importDatabase('C:/backups/lumora-2025.db')).resolves.toBe(
      'C:/backups/lumora-2025.db',
    );
    expect(mockInvoke).toHaveBeenCalledWith('import_database', {
      source: 'C:/backups/lumora-2025.db',
    });
  });

  it('surfaces a failed import', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('not a Lumora database'));

    await expect(importDatabase('C:/tmp/other.db')).rejects.toThrow('not a Lumora database');
  });
});
