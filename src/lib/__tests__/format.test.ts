import { describe, it, expect } from 'vitest';
import { formatDate, formatFileSize } from '../format';

describe('formatDate', () => {
  it('formats ISO date to zh-CN locale string', () => {
    const result = formatDate('2025-01-15T10:30:00Z');
    // Should contain year, month, day
    expect(result).toContain('2025');
    expect(result).toContain('01');
    expect(result).toContain('15');
  });

  it('handles empty string gracefully', () => {
    const result = formatDate('');
    // Should not throw, returns some fallback
    expect(typeof result).toBe('string');
  });
});

describe('formatFileSize', () => {
  it('formats KB when under 1024', () => {
    expect(formatFileSize(500)).toBe('500 KB');
  });

  it('formats MB when >= 1024 KB', () => {
    expect(formatFileSize(1536)).toBe('1.5 MB');
  });

  it('formats GB when >= 1024 MB', () => {
    expect(formatFileSize(1048576)).toBe('1.00 GB');
  });

  it('handles 0', () => {
    expect(formatFileSize(0)).toBe('0 KB');
  });

  it('handles exact 1024 KB', () => {
    expect(formatFileSize(1024)).toBe('1.0 MB');
  });
});
