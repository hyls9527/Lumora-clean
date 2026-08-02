import { describe, it, expect, vi } from 'vitest';
import { filterDropPaths, isImagePath, parentDir, importTargetsFromDrop } from '../dropPaths';

describe('isImagePath', () => {
  it('accepts supported image extensions case-insensitively', () => {
    expect(isImagePath('C:/pics/photo.PNG')).toBe(true);
    expect(isImagePath('/a/b.jpg')).toBe(true);
    expect(isImagePath('/a/b.webp')).toBe(true);
  });

  it('rejects unsupported extensions and extensionless paths', () => {
    expect(isImagePath('C:/pics/notes.txt')).toBe(false);
    expect(isImagePath('C:/pics/folder')).toBe(false);
    expect(isImagePath('C:/pics/archive.tar.gz')).toBe(false);
  });
});

describe('filterDropPaths', () => {
  it('keeps image files and real directories, drops other files', async () => {
    const isDir = vi.fn(async (p: string) => p === '/photos/2024');

    const result = await filterDropPaths(
      ['/photos/a.png', '/photos/2024', '/photos/readme.txt'],
      isDir,
    );

    expect(result).toEqual(['/photos/a.png', '/photos/2024']);
    expect(isDir).toHaveBeenCalledWith('/photos/2024');
    expect(isDir).not.toHaveBeenCalledWith('/photos/a.png');
  });

  it('returns empty array when nothing matches', async () => {
    const result = await filterDropPaths(['/a.txt', '/b.log'], async () => false);
    expect(result).toEqual([]);
  });

  it('preserves original order', async () => {
    const isDir = async () => true;
    const result = await filterDropPaths(['/dir', '/a.png', '/b.txt'], isDir);
    expect(result).toEqual(['/dir', '/a.png', '/b.txt']);
  });
});

describe('parentDir', () => {
  it('returns the parent of a nested path', () => {
    expect(parentDir('/photos/2024/a.png')).toBe('/photos/2024');
    expect(parentDir('C:\\photos\\a.png')).toBe('C:/photos');
  });

  it('returns empty string for a root-level path', () => {
    expect(parentDir('a.png')).toBe('');
    expect(parentDir('/a.png')).toBe('');
    expect(parentDir('C:\\a.png')).toBe('C:');
  });
});

describe('importTargetsFromDrop', () => {
  it('imports the containing folder for image files', () => {
    expect(importTargetsFromDrop(['/photos/2024/a.png', '/photos/2024/b.jpg'])).toEqual([
      '/photos/2024',
    ]);
  });

  it('imports directories as themselves', () => {
    expect(importTargetsFromDrop(['/photos/2024', '/photos/2025'])).toEqual([
      '/photos/2024',
      '/photos/2025',
    ]);
  });

  it('deduplicates mixed file and folder drops targeting the same folder', () => {
    expect(importTargetsFromDrop(['/photos', '/photos/a.png'])).toEqual(['/photos']);
  });

  it('deduplicates folders written with different separators', () => {
    expect(importTargetsFromDrop(['C:\\photos\\a.png', 'C:/photos/b.png'])).toEqual([
      'C:/photos',
    ]);
  });

  it('imports a root-level image file itself instead of its parent root', () => {
    expect(importTargetsFromDrop(['C:\\a.png'])).toEqual(['C:\\a.png']);
    expect(importTargetsFromDrop(['/a.png'])).toEqual(['/a.png']);
  });

  it('imports a root-level image file and a directory without duplicates', () => {
    expect(importTargetsFromDrop(['/a.png', '/dir/b.png', '/dir'])).toEqual([
      '/a.png',
      '/dir',
    ]);
  });
});
