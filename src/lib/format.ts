/**
 * Shared formatting utilities.
 * Single source of truth for date/file-size formatting across the app.
 */

/** Format an ISO timestamp to a zh-CN locale string (date + time). */
export function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** Format file size from KB to human-readable string (KB / MB / GB). */
export function formatFileSize(kb: number): string {
  if (kb < 1024) return `${kb} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}
