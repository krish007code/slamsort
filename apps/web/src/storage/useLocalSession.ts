import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileEngine } from '../files/engine';
import type { Entry, Journal } from '../files/engine';
import { acquireSession, openJournal } from './journal';
import { journalState } from './journalState';

/** Own the lock, durable journal and engine for exactly one mounted session. */
export function useLocalSession(onError: (message: string) => void) {
  const [held, setHeld] = useState(false);
  const [journal, setJournal] = useState<Journal>();
  const [entries, setEntries] = useState<Entry[]>([]);
  const engine = useRef<FileEngine | undefined>(undefined);
  const mounted = useRef(false);
  const lockHeld = useRef(false);
  const reportError = useRef(onError);
  reportError.current = onError;

  useEffect(() => {
    mounted.current = true;
    let disposed = false;
    let opened: Journal | undefined;
    const release = acquireSession(value => {
      lockHeld.current = value;
      if (!disposed) setHeld(value);
    });

    void (async () => {
      try {
        opened = await openJournal();
        if (disposed) { opened.close?.(); return; }
        const all = await opened.all();
        if (disposed) return;
        engine.current = new FileEngine(opened, () => lockHeld.current);
        setJournal(opened);
        setEntries(all);
      } catch {
        opened?.close?.();
        if (!disposed) reportError.current('Local moves disabled: journal unavailable. Check browser storage permissions and reopen the page.');
      }
    })();

    return () => {
      disposed = true;
      mounted.current = false;
      lockHeld.current = false;
      engine.current = undefined;
      release();
      opened?.close?.();
    };
  }, []);

  const refreshJournal = useCallback(async () => {
    if (!journal) return;
    const all = await journal.all();
    if (mounted.current) setEntries(all);
  }, [journal]);
  const state = useMemo(() => journalState(entries), [entries]);

  return { held, journal, entries, engine, refreshJournal, ...state };
}
