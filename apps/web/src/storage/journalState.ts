import type { Entry } from '../files/engine';

/** A completed undo link is authoritative even if its bookkeeping write failed. */
export function journalState(entries: readonly Entry[]) {
  const undone = new Set(entries
    .filter(entry => entry.status === 'complete' && entry.undoOf)
    .map(entry => entry.undoOf));
  const pending = entries.filter(entry => entry.status !== 'complete' && entry.status !== 'retained');
  let undoable: Entry | undefined;

  for (const entry of entries) {
    if (entry.status !== 'complete' || entry.undoOf || entry.undone || undone.has(entry.id)) continue;
    if (!undoable || entry.at > undoable.at) undoable = entry;
  }

  return { pending, undoable };
}
