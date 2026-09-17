import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  startSession,
  currentSessionId,
  recordCrash,
  reliabilitySnapshot,
  resetReliability,
  installGlobalCrashHandlers,
} from '../reliability';

describe('reliability telemetry', () => {
  beforeEach(() => {
    resetReliability();
  });

  afterEach(() => {
    resetReliability();
    vi.restoreAllMocks();
  });

  it('counts a session start exactly once per page load', () => {
    startSession();
    startSession();
    startSession();
    expect(reliabilitySnapshot().sessions).toBe(1);
  });

  it('exposes the session id and reuses it across calls', () => {
    const id = startSession();
    expect(id).toBeTruthy();
    expect(currentSessionId()).toBe(id);
  });

  it('reports a zero crash rate before any crash happens', () => {
    startSession();
    const snap = reliabilitySnapshot();
    expect(snap.sessions).toBe(1);
    expect(snap.crashSessions).toBe(0);
    expect(snap.crashRatePct).toBe(0);
  });

  it('counts a crashing session once even when it crashes repeatedly', () => {
    startSession();
    recordCrash({ source: 'react', message: 'first' });
    recordCrash({ source: 'window', message: 'second' });
    recordCrash({ source: 'unhandledrejection', message: 'third' });

    const snap = reliabilitySnapshot();
    // Three crashes, but only one bad session — the rate must not inflate.
    expect(snap.crashSessions).toBe(1);
    expect(snap.crashRatePct).toBe(100);
    expect(snap.recentCrashes).toHaveLength(3);
    expect(snap.recentCrashes.map((c) => c.source)).toEqual([
      'react',
      'window',
      'unhandledrejection',
    ]);
  });

  it('computes the crash rate as crashed sessions over started sessions', () => {
    // 4 healthy page loads, then one that crashes. Sessions are identified by
    // sessionStorage (per page load), so clearing it starts a new session
    // while the localStorage counters keep accumulating.
    for (let i = 0; i < 4; i++) {
      sessionStorage.clear();
      startSession();
    }
    sessionStorage.clear();
    startSession();
    recordCrash({ source: 'react', message: 'boom' });

    const snap = reliabilitySnapshot();
    expect(snap.sessions).toBe(5);
    expect(snap.crashSessions).toBe(1);
    expect(snap.crashRatePct).toBe(20);
  });

  it('truncates a stored stack trace so storage cannot grow unbounded', () => {
    startSession();
    recordCrash({ source: 'react', message: 'boom', stack: 'x'.repeat(5000) });
    expect(reliabilitySnapshot().recentCrashes[0].stack).toHaveLength(2000);
  });

  it('keeps only the newest 50 crash entries', () => {
    startSession();
    for (let i = 0; i < 60; i++) {
      recordCrash({ source: 'window', message: `e${i}` });
    }
    const entries = reliabilitySnapshot().recentCrashes;
    expect(entries).toHaveLength(50);
    expect(entries[entries.length - 1].message).toBe('e59');
    expect(entries[0].message).toBe('e10');
  });

  it('ignores corrupt crash-log JSON instead of throwing', () => {
    startSession();
    localStorage.setItem('lumora.reliability.crashLog', '{not json');
    expect(reliabilitySnapshot().recentCrashes).toEqual([]);
  });

  it('installs window error and rejection listeners and removes them again', () => {
    startSession();
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const uninstall = installGlobalCrashHandlers();

    const added = addSpy.mock.calls.map((c) => c[0]);
    expect(added).toContain('error');
    expect(added).toContain('unhandledrejection');

    uninstall();
    const removed = removeSpy.mock.calls.map((c) => c[0]);
    expect(removed).toContain('error');
    expect(removed).toContain('unhandledrejection');
  });

  it('records an uncaught window error through the global handler', () => {
    startSession();
    const uninstall = installGlobalCrashHandlers();
    window.dispatchEvent(new ErrorEvent('error', { message: 'window blew up' }));
    uninstall();

    const crashes = reliabilitySnapshot().recentCrashes;
    expect(crashes).toHaveLength(1);
    expect(crashes[0]).toMatchObject({ source: 'window', message: 'window blew up' });
  });

  it('records an unhandled promise rejection through the global handler', () => {
    startSession();
    const uninstall = installGlobalCrashHandlers();
    const event = new Event('unhandledrejection') as Event & { reason?: unknown };
    event.reason = new Error('promise blew up');
    window.dispatchEvent(event);
    uninstall();

    const crashes = reliabilitySnapshot().recentCrashes;
    expect(crashes).toHaveLength(1);
    expect(crashes[0]).toMatchObject({
      source: 'unhandledrejection',
      message: 'promise blew up',
    });
  });
});
