import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { create } from 'zustand';
import { createJobStore, POLL_INTERVAL_MS, type JobStoreDeps } from '../jobStore';
import type { JobStatus } from '../../lib/api/jobs';

function job(over: Partial<JobStatus> = {}): JobStatus {
  return {
    id: 1,
    kind: 'embed_missing',
    state: 'running',
    processed: 0,
    total: 100,
    failed: 0,
    message: null,
    startedAtMs: 0,
    updatedAtMs: 0,
    cancelRequested: false,
    ...over,
  };
}

/** A store wired to controllable deps, so tests can drive list/status replies. */
function makeStore() {
  const deps: JobStoreDeps = {
    startEmbedMissing: vi.fn().mockResolvedValue({ id: 1, kind: 'embed_missing', isNew: true }),
    startEmbedClipMissing: vi
      .fn()
      .mockResolvedValue({ id: 2, kind: 'embed_clip_missing', isNew: true }),
    startScoreMissing: vi.fn().mockResolvedValue({ id: 3, kind: 'score_missing', isNew: true }),
    getStatus: vi.fn().mockResolvedValue(job()),
    list: vi.fn().mockResolvedValue([job()]),
    cancel: vi.fn().mockResolvedValue(true),
  };
  const useStore = create(createJobStore(deps));
  return { deps, useStore };
}

describe('jobStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with nothing running', () => {
    const { useStore } = makeStore();
    expect(useStore.getState().active).toEqual([]);
    expect(useStore.getState().recent).toEqual([]);
    expect(useStore.getState().error).toBeNull();
  });

  it('shows the job as active as soon as it is started', async () => {
    const { deps, useStore } = makeStore();

    await useStore.getState().startEmbedMissing();

    expect(deps.startEmbedMissing).toHaveBeenCalledTimes(1);
    expect(deps.getStatus).toHaveBeenCalledWith(1);
    expect(useStore.getState().active.map((j) => j.id)).toEqual([1]);
    useStore.getState().reset();
  });

  it('surfaces a failure to start instead of showing a phantom job', async () => {
    const { deps, useStore } = makeStore();
    vi.mocked(deps.startEmbedMissing).mockRejectedValueOnce(new Error('backend down'));

    await useStore.getState().startEmbedMissing();

    expect(useStore.getState().error).toBe('backend down');
    expect(useStore.getState().active).toEqual([]);
  });

  it('moves a finished job out of active', async () => {
    const { deps, useStore } = makeStore();
    await useStore.getState().startEmbedMissing();

    vi.mocked(deps.list).mockResolvedValue([job({ state: 'completed', processed: 100 })]);
    await useStore.getState().refresh();

    expect(useStore.getState().active).toEqual([]);
    expect(useStore.getState().recent.map((j) => j.state)).toEqual(['completed']);
    useStore.getState().reset();
  });

  it('keeps a cancelled job visible so the user sees how it ended', async () => {
    const { deps, useStore } = makeStore();
    await useStore.getState().startEmbedMissing();

    vi.mocked(deps.list).mockResolvedValue([job({ state: 'cancelled', processed: 40 })]);
    await useStore.getState().refresh();

    const recent = useStore.getState().recent;
    expect(recent).toHaveLength(1);
    expect(recent[0].state).toBe('cancelled');
    // Partial progress must survive: it is what the user gets to keep.
    expect(recent[0].processed).toBe(40);
    useStore.getState().reset();
  });

  it('polls while a job is active and stops once none are', async () => {
    const { deps, useStore } = makeStore();
    await useStore.getState().startEmbedMissing();
    const callsAfterStart = vi.mocked(deps.list).mock.calls.length;

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    expect(vi.mocked(deps.list).mock.calls.length).toBeGreaterThan(callsAfterStart);

    // Job finished: the interval must stop, so an idle app makes no IPC calls.
    vi.mocked(deps.list).mockResolvedValue([job({ state: 'completed' })]);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2);
    const callsAtIdle = vi.mocked(deps.list).mock.calls.length;
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 5);
    expect(vi.mocked(deps.list).mock.calls.length).toBe(callsAtIdle);
    useStore.getState().reset();
  });

  it('reset stops polling and clears state', async () => {
    const { deps, useStore } = makeStore();
    await useStore.getState().startEmbedMissing();

    useStore.getState().reset();
    const callsAfterReset = vi.mocked(deps.list).mock.calls.length;

    expect(useStore.getState().active).toEqual([]);
    expect(useStore.getState().recent).toEqual([]);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    expect(vi.mocked(deps.list).mock.calls.length).toBe(callsAfterReset);
  });

  it('cancel requests the stop but keeps reporting the job as running', async () => {
    const { deps, useStore } = makeStore();
    await useStore.getState().startEmbedMissing();

    // The flag is set immediately; the worker stops at its next checkpoint, so a
    // job must not disappear from the UI the moment Cancel is pressed.
    vi.mocked(deps.list).mockResolvedValue([job({ cancelRequested: true })]);
    await useStore.getState().cancel(1);

    expect(deps.cancel).toHaveBeenCalledWith(1);
    expect(useStore.getState().active).toHaveLength(1);
    expect(useStore.getState().active[0].cancelRequested).toBe(true);
    useStore.getState().reset();
  });

  it('reports a failed poll so the user can retry', async () => {
    const { deps, useStore } = makeStore();
    await useStore.getState().startEmbedMissing();

    vi.mocked(deps.list).mockRejectedValue(new Error('ipc broken'));
    await useStore.getState().refresh();

    expect(useStore.getState().error).toBe('ipc broken');
    useStore.getState().reset();
  });
});