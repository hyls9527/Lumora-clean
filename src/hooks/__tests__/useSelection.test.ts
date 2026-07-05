import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSelection } from '../useSelection';
import type { ImageRecord } from '../../types/image';

const mockImages: ImageRecord[] = [
  {
    id: '1',
    filePath: '/a.png',
    fileName: 'a.png',
    fileSizeKb: 100,
    width: 100,
    height: 100,
    format: 'png' as const,
    createdAt: '2024-01-01',
    rating: 0,
    favorite: false,
    model: '',
    prompt: '',
    tags: [],
  },
  {
    id: '2',
    filePath: '/b.png',
    fileName: 'b.png',
    fileSizeKb: 200,
    width: 200,
    height: 200,
    format: 'png' as const,
    createdAt: '2024-01-02',
    rating: 3,
    favorite: true,
    model: 'SDXL',
    prompt: 'test',
    tags: ['tag1'],
  },
  {
    id: '3',
    filePath: '/c.png',
    fileName: 'c.png',
    fileSizeKb: 300,
    width: 300,
    height: 300,
    format: 'png' as const,
    createdAt: '2024-01-03',
    rating: 5,
    favorite: false,
    model: 'Flux',
    prompt: 'hello',
    tags: [],
  },
];

describe('useSelection', () => {
  describe('toggleSelect', () => {
    it('adds an id to the selection set', () => {
      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.toggleSelect('1');
      });

      expect(result.current.selectedIds.has('1')).toBe(true);
      expect(result.current.selectedIds.size).toBe(1);
    });

    it('removes an id when toggled again', () => {
      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.toggleSelect('1');
      });
      expect(result.current.selectedIds.has('1')).toBe(true);

      act(() => {
        result.current.toggleSelect('1');
      });
      expect(result.current.selectedIds.has('1')).toBe(false);
      expect(result.current.selectedIds.size).toBe(0);
    });

    it('supports multiple independent selections', () => {
      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.toggleSelect('1');
        result.current.toggleSelect('2');
        result.current.toggleSelect('3');
      });

      expect(result.current.selectedIds.size).toBe(3);
      expect(result.current.selectedIds.has('1')).toBe(true);
      expect(result.current.selectedIds.has('2')).toBe(true);
      expect(result.current.selectedIds.has('3')).toBe(true);
    });

    it('toggle only affects the target id', () => {
      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.toggleSelect('1');
        result.current.toggleSelect('2');
      });

      act(() => {
        result.current.toggleSelect('1');
      });

      expect(result.current.selectedIds.has('1')).toBe(false);
      expect(result.current.selectedIds.has('2')).toBe(true);
      expect(result.current.selectedIds.size).toBe(1);
    });
  });

  describe('selectAll', () => {
    it('selects all ids from the provided images array', () => {
      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.selectAll(mockImages);
      });

      expect(result.current.selectedIds.size).toBe(3);
      expect(result.current.selectedIds.has('1')).toBe(true);
      expect(result.current.selectedIds.has('2')).toBe(true);
      expect(result.current.selectedIds.has('3')).toBe(true);
    });

    it('replaces previous selection entirely', () => {
      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.toggleSelect('99');
      });
      expect(result.current.selectedIds.has('99')).toBe(true);

      act(() => {
        result.current.selectAll(mockImages);
      });

      expect(result.current.selectedIds.has('99')).toBe(false);
      expect(result.current.selectedIds.size).toBe(3);
    });

    it('handles empty images array', () => {
      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.toggleSelect('1');
      });

      act(() => {
        result.current.selectAll([]);
      });

      expect(result.current.selectedIds.size).toBe(0);
    });
  });

  describe('clearSelection', () => {
    it('empties the selection set', () => {
      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.toggleSelect('1');
        result.current.toggleSelect('2');
      });
      expect(result.current.selectedIds.size).toBe(2);

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selectedIds.size).toBe(0);
    });

    it('is safe to call when already empty', () => {
      const { result } = renderHook(() => useSelection());

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selectedIds.size).toBe(0);
    });
  });

  describe('initial state', () => {
    it('starts with an empty set', () => {
      const { result } = renderHook(() => useSelection());

      expect(result.current.selectedIds.size).toBe(0);
      expect(result.current.selectedIds).toBeInstanceOf(Set);
    });
  });

  describe('isolation between hook instances', () => {
    it('each renderHook instance has independent state', () => {
      const { result: hook1 } = renderHook(() => useSelection());
      const { result: hook2 } = renderHook(() => useSelection());

      act(() => {
        hook1.current.toggleSelect('1');
      });

      expect(hook1.current.selectedIds.has('1')).toBe(true);
      expect(hook2.current.selectedIds.has('1')).toBe(false);
    });
  });
});
