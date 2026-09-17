/**
 * Reliability telemetry (crash rate + session counter).
 *
 * "Crash rate < 0.1%" needs a denominator as well as a numerator: every
 * session start increments a launch counter, and every unhandled render /
 * window error records one crash against the *current* session. Both live in
 * localStorage so the rate survives restarts and can be read back by the
 * diagnostics surface or an operator script.
 *
 * Nothing here talks to the network or to a third party — the counters stay
 * on the user's machine, which is what a local-first desktop app should do.
 */

const SESSIONS_KEY = 'lumora.reliability.sessions';
const CRASH_SESSIONS_KEY = 'lumora.reliability.crashSessions';
const CURRENT_SESSION_KEY = 'lumora.reliability.sessionId';
const CRASH_LOG_KEY = 'lumora.reliability.crashLog';
const CRASH_COUNTED_KEY = 'lumora.reliability.counted';
/** Bounded so a crash loop can never grow storage without limit. */
const MAX_CRASH_ENTRIES = 50;

export interface CrashEntry {
  ts: string;
  source: 'react' | 'window' | 'unhandledrejection';
  message: string;
  stack?: string;
}

export interface ReliabilitySnapshot {
  /** Sessions started (denominator). */
  sessions: number;
  /** Sessions in which at least one crash was recorded (numerator). */
  crashSessions: number;
  /** crashSessions / sessions, as a percentage. */
  crashRatePct: number;
  sessionId: string | null;
  recentCrashes: CrashEntry[];
}

function readNumber(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    const n = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeNumber(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // storage unavailable (private mode / quota): telemetry is best-effort
  }
}

function readCrashes(): CrashEntry[] {
  try {
    const raw = localStorage.getItem(CRASH_LOG_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CrashEntry[]) : [];
  } catch {
    return [];
  }
}

/**
 * Count this session start. Idempotent per page load: a hot reload or a
 * second call does not inflate the denominator.
 */
export function startSession(): string {
  const existing = (() => {
    try {
      return sessionStorage.getItem(CURRENT_SESSION_KEY);
    } catch {
      return null;
    }
  })();
  if (existing) return existing;

  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    sessionStorage.setItem(CURRENT_SESSION_KEY, id);
  } catch {
    // no sessionStorage: the id still identifies this page load in memory
  }
  writeNumber(SESSIONS_KEY, readNumber(SESSIONS_KEY) + 1);
  return id;
}

/** The session id for this page load, or null when startSession never ran. */
export function currentSessionId(): string | null {
  try {
    return sessionStorage.getItem(CURRENT_SESSION_KEY);
  } catch {
    return null;
  }
}

/**
 * Record one crash. The first crash of a session also increments the crash
 * *session* counter — a session that crashed ten times is still one bad
 * session for the rate, and double counting would break the metric.
 */
export function recordCrash(entry: Omit<CrashEntry, 'ts'> & { ts?: string }): void {
  const full: CrashEntry = {
    ts: entry.ts ?? new Date().toISOString(),
    source: entry.source,
    message: entry.message,
    ...(entry.stack ? { stack: entry.stack.slice(0, 2000) } : {}),
  };

  const crashes = readCrashes();
  // An explicit per-session flag beats inferring "already counted" from
  // timestamps: two sessions inside the same second would otherwise collapse
  // into one, and the crash rate would read optimistically low.
  let isFirstOfSession = false;
  try {
    if (sessionStorage.getItem(CRASH_COUNTED_KEY) !== '1') {
      sessionStorage.setItem(CRASH_COUNTED_KEY, '1');
      isFirstOfSession = true;
    }
  } catch {
    isFirstOfSession = true;
  }
  crashes.push(full);
  try {
    localStorage.setItem(CRASH_LOG_KEY, JSON.stringify(crashes.slice(-MAX_CRASH_ENTRIES)));
  } catch {
    // ignore: see writeNumber
  }
  if (isFirstOfSession) {
    writeNumber(CRASH_SESSIONS_KEY, readNumber(CRASH_SESSIONS_KEY) + 1);
  }
}

/** Read the accumulated reliability counters. */
export function reliabilitySnapshot(): ReliabilitySnapshot {
  const sessions = readNumber(SESSIONS_KEY);
  const crashSessions = readNumber(CRASH_SESSIONS_KEY);
  return {
    sessions,
    crashSessions,
    crashRatePct: sessions > 0 ? (crashSessions / sessions) * 100 : 0,
    sessionId: currentSessionId(),
    recentCrashes: readCrashes(),
  };
}

/** Test/ops helper: clear all reliability counters. */
export function resetReliability(): void {
  try {
    localStorage.removeItem(SESSIONS_KEY);
    localStorage.removeItem(CRASH_SESSIONS_KEY);
    localStorage.removeItem(CRASH_LOG_KEY);
    sessionStorage.removeItem(CURRENT_SESSION_KEY);
    sessionStorage.removeItem(CRASH_COUNTED_KEY);
  } catch {
    // ignore
  }
}

/**
 * Install global error listeners. Returns the uninstall function.
 *
 * Only errors that actually break the UI land here: React render errors via
 * the ErrorBoundary, uncaught window errors and unhandled rejections.
 */
export function installGlobalCrashHandlers(): () => void {
  if (typeof window === 'undefined') return () => {};

  const onError = (event: ErrorEvent) => {
    recordCrash({
      source: 'window',
      message: event.message || 'unknown window error',
      stack: event.error instanceof Error ? event.error.stack : undefined,
    });
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    const reason: unknown = event.reason;
    recordCrash({
      source: 'unhandledrejection',
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}
