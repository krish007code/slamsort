import { validName } from '../files/engine.ts';

export const MIN_BINS = 1;
export const MAX_BINS = 5;
export const DEFAULT_DURATION = 120;

export function validBins(labels: readonly string[]): boolean {
  return labels.length >= MIN_BINS && labels.length <= MAX_BINS
    && labels.every(validName)
    && new Set(labels.map(label => label.toLowerCase())).size === labels.length;
}

interface ApprovalState {
  busy: boolean;
  itemCount: number;
  working: boolean;
  local: boolean;
  journalReady: boolean;
  held: boolean;
  pendingCount: number;
}

/** Setup and its action share one ordered explanation of what blocks approval. */
export function approvalBlocker(state: ApprovalState): string {
  if (state.busy) return 'Opening your folder…';
  if (!state.itemCount) return 'Open a subfolder containing files before approving.';
  if (state.working) return 'Waiting for the Gemini proposal. You can approve when it finishes.';
  if (!state.local) return '';
  if (!state.journalReady) return 'Local storage is not ready. Check the local session message below.';
  if (!state.held) return 'Another SlamSort tab holds the file session. Close that tab to continue here.';
  if (state.pendingCount) return 'Review interrupted operations below before starting another round.';
  return '';
}

export function roundDuration(value: number): number {
  return Number.isFinite(value) && value !== 0
    ? Math.max(15, Math.min(3600, value))
    : DEFAULT_DURATION;
}
