import type { RoutePath } from '../../routes';

/**
 * AI-native control layer types.
 * Every app feature can be invoked by natural language through a registered
 * capability; the UI previews the parsed intent before executing it.
 */

export interface AiDeps {
  navigate: (path: RoutePath) => void;
}

export interface IntentPattern {
  /** Natural-language pattern (Chinese-first). */
  regex: RegExp;
  extract: (m: RegExpMatchArray) => Record<string, unknown>;
  /** Human-readable preview shown before execution. */
  preview: (params: Record<string, unknown>) => string;
}

export interface Capability {
  id: string;
  /** Display name (Chinese). */
  name: string;
  pattern: IntentPattern;
  execute: (
    params: Record<string, unknown>,
    deps: AiDeps,
  ) => Promise<string>;
}

export interface ParsedIntent {
  capabilityId: string;
  params: Record<string, unknown>;
  preview: string;
}
