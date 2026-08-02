/**
 * Ordered registry of open modals.
 *
 * Only the topmost modal may react to Escape, so stacked modals
 * (e.g. DetailModal + VariantCompareModal + CommandPalette) don't all
 * close on a single keypress.
 */

const openModals = new Set<string>();
let seq = 0;

/** Register a modal as open and return its id. */
export function registerModal(): string {
  const id = `modal-${++seq}`;
  openModals.add(id);
  return id;
}

/** Unregister a modal (call on unmount / close). */
export function unregisterModal(id: string): void {
  openModals.delete(id);
}

/** True when the given modal id is the most recently registered one. */
export function isTopModal(id: string): boolean {
  if (openModals.size === 0) return false;
  let top: string | undefined;
  for (const m of openModals) top = m;
  return top === id;
}

/** Test-only: clear the registry between tests. */
export function resetModalStackForTests(): void {
  openModals.clear();
}
