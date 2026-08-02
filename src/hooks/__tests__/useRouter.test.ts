import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGlobalShortcuts, useRouteCommands } from '../useRouter';
import { useCommandStore } from '../../stores/commandStore';

function pressShortcut(key: string, mod: 'ctrl' | 'meta') {
  window.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      ctrlKey: mod === 'ctrl',
      metaKey: mod === 'meta',
    }),
  );
}

beforeEach(() => {
  useCommandStore.setState({ isOpen: false, commands: [] });
});

describe('useGlobalShortcuts', () => {
  it('calls onRefresh for ⌘R instead of navigating when provided', () => {
    const navigate = vi.fn();
    const onRefresh = vi.fn();
    renderHook(() => useGlobalShortcuts(navigate, onRefresh));

    act(() => pressShortcut('r', 'meta'));

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('navigates to /gallery for ⌘R when no onRefresh is provided', () => {
    const navigate = vi.fn();
    renderHook(() => useGlobalShortcuts(navigate));

    act(() => pressShortcut('r', 'ctrl'));

    expect(navigate).toHaveBeenCalledWith('/gallery');
  });

  it('toggles the command palette for ⌘K', () => {
    renderHook(() => useGlobalShortcuts(vi.fn()));

    act(() => pressShortcut('k', 'meta'));

    expect(useCommandStore.getState().isOpen).toBe(true);
  });

  it('ignores plain keys without a modifier', () => {
    const navigate = vi.fn();
    const onRefresh = vi.fn();
    renderHook(() => useGlobalShortcuts(navigate, onRefresh));

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }));
    });

    expect(onRefresh).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('useRouteCommands', () => {
  it('registers an action-refresh command that calls onRefresh', () => {
    const navigate = vi.fn();
    const onRefresh = vi.fn();
    renderHook(() => useRouteCommands(navigate, onRefresh));

    const cmd = useCommandStore.getState().commands.find((c) => c.id === 'action-refresh');
    expect(cmd).toBeDefined();

    act(() => cmd!.action());

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('navigates to /gallery when refresh command has no onRefresh', () => {
    const navigate = vi.fn();
    renderHook(() => useRouteCommands(navigate));

    const cmd = useCommandStore.getState().commands.find((c) => c.id === 'action-refresh');
    expect(cmd).toBeDefined();

    act(() => cmd!.action());

    expect(navigate).toHaveBeenCalledWith('/gallery');
  });
});
