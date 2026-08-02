/**
 * Drag-and-drop path filtering.
 *
 * Dropped paths may be image files or folders (Tauri reports raw paths only).
 * Directories are resolved through the backend so dragging a folder imports it.
 */

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];

export function isImagePath(path: string): boolean {
  const lower = path.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** Keep image files and real directories; drop unsupported files. */
export async function filterDropPaths(
  paths: string[],
  isDirectory: (path: string) => Promise<boolean>,
): Promise<string[]> {
  const kept: string[] = [];
  for (const p of paths) {
    if (isImagePath(p)) {
      kept.push(p);
      continue;
    }
    if (await isDirectory(p)) kept.push(p);
  }
  return kept;
}

/** Parent directory of a path, or an empty string when there is none. */
export function parentDir(path: string): string {
  const parts = path.split(/[/\\]/);
  parts.pop();
  return parts.join('/');
}

/**
 * Derive the actual import targets from a set of dropped paths.
 *
 * Image files import their containing folder; directories import themselves.
 * A file at a drive root or in the filesystem root imports the file itself
 * instead (importing the root directory would scan the entire drive).
 * Results are deduplicated and preserve first-seen order.
 */
export function importTargetsFromDrop(paths: string[]): string[] {
  const targets: string[] = [];
  const seen = new Set<string>();
  for (const p of paths) {
    const raw = isImagePath(p) ? parentDir(p) : p;
    const normalized = raw.replace(/\\/g, '/');
    // A file with no parent, or whose parent is a drive/fs root, is imported
    // directly — importing the root would scan the entire drive.
    const target =
      isImagePath(p) && (!normalized || /^[A-Za-z]:$|^\/$/.test(normalized)) ? p : normalized;
    if (!target) continue;
    if (!seen.has(target)) {
      seen.add(target);
      targets.push(target);
    }
  }
  return targets;
}
