import type { Capability, ParsedIntent } from './types';

/**
 * Match a natural-language command against the registered capabilities.
 * First matching capability wins; capability order in the registry defines
 * priority (more specific patterns first).
 */
export function parseIntent(
  input: string,
  capabilities: Capability[],
): ParsedIntent | null {
  const text = input.trim();
  if (!text) return null;
  for (const cap of capabilities) {
    const m = cap.pattern.regex.exec(text);
    if (m) {
      const params = cap.pattern.extract(m);
      return {
        capabilityId: cap.id,
        params,
        preview: cap.pattern.preview(params),
      };
    }
  }
  return null;
}
