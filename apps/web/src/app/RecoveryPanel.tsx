import { useState } from 'react';
import { inspectEntry } from '../files/engine';
import type { Entry, Journal } from '../files/engine';

interface RecoveryPanelProps {
  entries: readonly Entry[];
  journal: Journal | undefined;
  disabled: boolean;
  held: boolean;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}

export function RecoveryPanel({ entries, journal, disabled, held, onRefresh, onError }: RecoveryPanelProps) {
  const [checks, setChecks] = useState<Record<string, string>>({});
  const [working, setWorking] = useState(false);

  async function check(entry: Entry) {
    setWorking(true);
    try {
      const description = await inspectEntry(entry);
      setChecks(previous => ({ ...previous, [entry.id]: description }));
    } catch {
      onError('Could not inspect both copies. Keep them and renew folder access before trying again.');
    } finally { setWorking(false); }
  }

  async function acknowledge(entry: Entry) {
    if (!journal || !held || !checks[entry.id] || disabled || working) return;
    setWorking(true);
    try {
      // Acknowledgment changes journal state only; it never deletes either copy.
      await journal.put({ ...entry, status: 'retained' });
      await onRefresh();
    } catch {
      onError('Recovery acknowledgment could not be saved. Keep both copies and retry.');
    } finally { setWorking(false); }
  }

  return <section className="recovery">
    <h2>Interrupted operations need review</h2>
    <p>No automatic retry or deletion. Inspect both folders manually and retain uncertain copies.</p>
    {entries.map(entry => <article key={entry.id}>
      <strong>{entry.sourceName} → {entry.category ?? ''}/{entry.targetName}</strong>
      <p>{entry.error || entry.status}</p>
      <div className="buttons">
        <button disabled={disabled || working} onClick={() => void check(entry)}>Check both copies</button>
        <button disabled={!checks[entry.id] || !held || !journal || disabled || working}
          onClick={() => void acknowledge(entry)}>Acknowledge manual recovery · keep copies</button>
      </div>
      <p role="status">{checks[entry.id]}</p>
    </article>)}
  </section>;
}
