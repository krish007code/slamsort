import type { Entry } from '../files/engine';

interface LocalSessionPanelProps {
  ready: boolean;
  disabled: boolean;
  entries: readonly Entry[];
  onRefresh: () => void;
}

export function LocalSessionPanel({ ready, disabled, entries, onRefresh }: LocalSessionPanelProps) {
  return <section className="local-panel">
    <h2>Your local session</h2>
    <p>{ready ? 'Exclusive session locked · durable journal ready' : 'Local mutations disabled: exclusive Web Lock and IndexedDB required.'}
      {' '}· Copy → verify every byte → recheck → remove source. Not atomic; keep this folder idle in other apps.</p>
    <div className="buttons">
      <button disabled={disabled} onClick={onRefresh}>Refresh loose files</button>
    </div>
    <p>Next-level destinations are prepared during play and applied automatically. Only folders used in this session are continued; singletons and unchanged groups finish. Use Finish session to stop. The left trash can moves files into Duplicates; it never deletes them. You decide which files are duplicates; automatic detection is deferred.</p>
    <details><summary>Journal · {entries.length} operations</summary>
      {entries.toSorted((a, b) => b.at - a.at).map(entry => <p key={entry.id}>
        {entry.status} · {entry.sourceName} → {entry.category ? `${entry.category}/` : ''}{entry.targetName}
        {entry.undoOf ? ' (undo)' : ''}{entry.error ? ` · ${entry.error}` : ''}
      </p>)}
    </details>
  </section>;
}
