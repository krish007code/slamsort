import { useEffect, useRef, useState } from 'react';
import { pickFolder } from '../files/picker';
import type { FolderPickerHost } from '../files/picker';
import { FolderEntry } from './FolderEntry';
import { useAi } from '../ai/useAi';
import { AiSetup } from '../ai/AiSetup';
import { HintPanel } from '../ai/HintPanel';
import { Court } from '../game/Court';
import { unlockSound } from '../game/sound';
import { useFileBuffer } from '../files/useFileBuffer';
import { Preview } from '../files/Preview';
import { FileEngine, inspectEntry, scan, validName } from '../files/engine';
import type { Entry, Journal, LocalDirectory, LocalFile } from '../files/engine';
import { acquireSession, openJournal } from '../storage/journal';
const SAMPLES = ['weekend-ideas.txt', 'coastline.jpg', 'invoice-october.pdf', 'brand-sketch.png', 'reading-list.txt', 'ticket.pdf', 'studio-notes.md', 'sunset.jpg'];
const DEFAULT_BINS = ['Documents', 'Pictures', 'Other'];
interface Item { name: string; handle?: LocalFile }
const samples = (): Item[] => SAMPLES.map(name => ({ name }));
const messageOf = (e: unknown) => e instanceof Error ? e.message : String(e);
export function App() {
  const ai = useAi();
  const [entered, setEntered] = useState(false);
  const [resetShot, setResetShot] = useState(0);
  const lastSuccess = useRef<Item | undefined>(undefined);
  const [hintOpen, setHintOpen] = useState(false);
  const [lastMiss, setLastMiss] = useState(false);
  const [mode, setMode] = useState<'demo' | 'local'>('demo');
  const [items, setItems] = useState<Item[]>(samples);
  const [skipped, setSkipped] = useState<Item[]>([]);
  const [bins, setBins] = useState(DEFAULT_BINS), [draft, setDraft] = useState(DEFAULT_BINS);
  const [duration, setDuration] = useState(120), [left, setLeft] = useState(120);
  const [score, setScore] = useState(0), [round, setRound] = useState(1);
  const [setup, setSetup] = useState(false), [result, setResult] = useState(false);
  const [manual, setManual] = useState(false), [inspect, setInspect] = useState(false), [hidden, setHidden] = useState(document.hidden);
  const [busy, setBusy] = useState(false), [flight, setFlight] = useState(false);
  const [sound, setSound] = useState(false), [fire, setFire] = useState(0), [destination, setDestination] = useState(0);
  const [notice, setNotice] = useState('Welcome to the Demo. These are fictional files. Land a basket to sort a sample.');
  const [dir, setDir] = useState<LocalDirectory>(), [path, setPath] = useState<string[]>([]);
  const [directories, setDirectories] = useState<string[]>([]);
  const [held, setHeld] = useState(false), [journal, setJournal] = useState<Journal>(), [entries, setEntries] = useState<Entry[]>([]);
  const [recovery, setRecovery] = useState<Record<string, string>>({});
  const lock = useRef(false); lock.current = held;
  const inFlight = useRef(false), io = useRef(false);
  const engine = useRef<FileEngine | undefined>(undefined);
  const current = items[0];
  const buffer = useFileBuffer(items, `${mode}:${path.join('/')}:${round}`, entered && !setup && !result);
  const [prepared, setPrepared] = useState(false);
  useEffect(() => { setPrepared(false); }, [current, mode]);
  const pending = entries.filter(e => !['complete', 'retained'].includes(e.status));
  const undone = new Set(entries.filter(e => e.status === 'complete' && e.undoOf).map(e => e.undoOf));
  const undoable = entries.filter(e => e.status === 'complete' && !e.undoOf && !e.undone && !undone.has(e.id)).sort((a, b) => b.at - a.at)[0];
  const reasons = [buffer.loading && 'preparing files', !!buffer.error && 'file read error', hintOpen && 'hint review', inspect && 'inspection', busy && 'file I/O', hidden && 'hidden tab', manual && 'manual pause', setup && 'setup', mode === 'local' && (!held || !journal) && 'storage / session lock', pending.length > 0 && mode === 'local' && 'recovery'].filter(Boolean);
  const paused = reasons.length > 0;
  const approvalBlocked = busy ? 'Opening your folder…' : !items.length ? 'Open a subfolder containing files before approving.' : ai.working ? 'Waiting for the Gemini proposal. You can approve when it finishes.' : mode === 'local' && !journal ? 'Local storage is not ready. Check the local session message below.' : mode === 'local' && !held ? 'Another SlamSort tab holds the file session. Close that tab to continue here.' : mode === 'local' && pending.length > 0 ? 'Review interrupted operations below before starting another round.' : '';
  const enabled = prepared && !!current && !setup && !result && left > 0 && !paused && !flight && (mode === 'demo' || (!!journal && held && pending.length === 0));
  useEffect(() => {
    const release = acquireSession(setHeld);
    let alive = true;
    void openJournal().then(async j => { const all = await j.all(); if (alive) { setJournal(j); setEntries(all); engine.current = new FileEngine(j, () => lock.current); } }).catch(e => { if (alive) setNotice(`Local moves disabled: journal unavailable. ${messageOf(e)}`); });
    const visibility = () => setHidden(document.hidden); document.addEventListener('visibilitychange', visibility);
    return () => { alive = false; release(); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  const expired = left <= 0;
  useEffect(() => {
    if (!entered || (!prepared && !flight) || paused || result || setup || !current || expired) return;
    const interval = window.setInterval(() => setLeft(t => Math.max(0, t - .1)), 100);
    return () => window.clearInterval(interval);
  }, [entered, prepared, flight, paused, result, setup, current, expired]);
  useEffect(() => { if (!flight && !busy && !setup && (left <= 0 || items.length === 0)) setResult(true); }, [left, items.length, flight, busy, setup]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select,button')) return;
      if (/^[1-5]$/.test(e.key)) { setDestination(Math.min(bins.length - 1, Number(e.key) - 1)); e.preventDefault(); }
      if (e.code === 'Space' && enabled) { setFire(n => n + 1); e.preventDefault(); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [enabled, bins.length]);
  async function refreshJournal() { if (journal) setEntries(await journal.all()); }
  async function settle(basket?: string) {
    // Phaser intentions are accepted once; files and points belong to this controller.
    if (!inFlight.current) return;
    inFlight.current = false;
    if (basket === undefined) { setLastMiss(true); setFlight(false); setNotice('Off the rim! Same file, another try. Nothing moved.'); return; }
    const category = basket === 'duplicates' ? 'Duplicates' : bins[Number(basket)];
    if (!category || !current) { setFlight(false); return; }
    io.current = true; setBusy(true);
    try {
      if (mode === 'local') {
        if (!dir || !engine.current) throw new Error('Local file engine unavailable.');
        await engine.current.move(dir, current.name, dir, category);
        await refreshJournal();
      }
      lastSuccess.current = current;
      setInspect(false); setScore(n => n + 1); setItems(queue => queue.slice(1));
      setNotice(mode === 'demo' ? `Sample basket! ${current.name} → ${category}. No real files changed.` : `Verified move: ${current.name} → ${category}. Undo is available.`);
    } catch (e) { setNotice(`No point awarded. ${messageOf(e)} Check the journal and both folders.`); await refreshJournal().catch(() => {}); }
    finally { io.current = false; setBusy(false); setFlight(false); }
  }
  async function chooseFolder() {
    if (io.current || inFlight.current) return;
    ai.invalidate(true); setHintOpen(false);
    io.current = true; setBusy(true);
    try {
      // Invoke on Window directly, within the button gesture, like the tested console script.
      const browser = window as unknown as FolderPickerHost;
      if (!window.isSecureContext || typeof browser.showDirectoryPicker !== 'function') {
        setNotice('This browser cannot move local files. Open this link in desktop Chrome, Chromium, or Edge, then select your folder. Practice mode works here.');
        return;
      }
      const selected = await pickFolder(browser);
      if (await selected.requestPermission({ mode: 'readwrite' }) !== 'granted') throw new Error('Write permission was not granted.');
      const found = await scan(selected);
      setEntered(true); lastSuccess.current = undefined;
      setDir(selected); setPath([selected.name]); setMode('local'); setItems(found.files.map(handle => ({ name: handle.name, handle }))); setSkipped([]); setDirectories(found.directories);
      setSetup(true); setResult(false); setInspect(false); setManual(false); setScore(0); setDraft(DEFAULT_BINS); setRound(1);
      setNotice(`Opened ${selected.name}: ${found.files.length} loose files. ${found.directories.length} folders deferred. Choose bins, then freeze this round.`);
    } catch (e) {
      const name = e instanceof DOMException ? e.name : '';
      setNotice(name === 'AbortError' ? 'No folder selected. Choose a folder when you are ready.'
        : name === 'SecurityError' ? 'The browser blocked this folder. Choose a normal test subfolder in desktop Chromium.'
        : 'Folder permission was not granted or the folder could not be opened. Select another test folder.');
    }
    finally { io.current = false; setBusy(false); }
  }
  function startRound() {
    if (approvalBlocked) { setNotice(approvalBlocked); return; }
    if (draft.length < 1 || draft.length > 5 || draft.some(n => !validName(n)) || new Set(draft.map(n => n.toLocaleLowerCase())).size !== draft.length) { setNotice('Use 1–5 distinct folder names, without slashes, reserved names or trailing dots/spaces.'); return; }
    lastSuccess.current = undefined;
    ai.freeze(draft); setHintOpen(false); setLastMiss(false);
    setBins([...draft]); setInspect(false); setDestination(0); setLeft(duration); setScore(0); setSetup(false); setResult(false); setManual(false); setNotice('Plan frozen for this round. Pull back from the ball, or choose a bin and Fire.');
  }
  function demo() {
    if (io.current || inFlight.current) return;
    ai.invalidate(true); setHintOpen(false); setLastMiss(false);
    setEntered(true); lastSuccess.current = undefined;
    setMode('demo'); setDir(undefined); setPath([]); setItems(samples()); setSkipped([]); setBins(DEFAULT_BINS); setDraft(DEFAULT_BINS); setDuration(120); setLeft(120); setScore(0); setSetup(false); setResult(false); setManual(false); setInspect(false); setRound(1); setDestination(0); setNotice('Demo reset. Sample files only; nothing on disk changes.');
  }
  async function refine(name: string) {
    if (!dir || io.current || inFlight.current) return;
    const proposal = ai.children[name];
    ai.invalidate(); setHintOpen(false);
    io.current = true; setBusy(true);
    try { const child = await dir.getDirectoryHandle(name); const found = await scan(child); setDir(child); setPath(p => [...p, name]); setItems(found.files.map(handle => ({ name: handle.name, handle }))); setSkipped([]); setDirectories(found.directories); setDraft(proposal?.labels ?? (setup ? draft : ['Keep', 'Reference', 'Archive'])); setInspect(false); setSetup(true); setResult(false); setRound(n => n + 1); setNotice(`Refine ${name}. ${proposal ? `Gemini draft: ${proposal.explanation}` : 'Review editable subfolder names before starting.'}`); }
    catch (e) { setNotice(messageOf(e)); }
    finally { io.current = false; setBusy(false); }
  }
  function configure() { ai.invalidate(); setHintOpen(false); setDraft([...bins]); setSetup(true); setResult(false); }
  async function rescan() {
    if (!dir || io.current || inFlight.current) return;
    io.current = true; setBusy(true);
    try {
      ai.invalidate(); setHintOpen(false);
      const found = await scan(dir);
      setItems(found.files.map(handle => ({ name: handle.name, handle })));
      setSkipped([]); setDirectories(found.directories); setDraft([...bins]);
      setSetup(true); setResult(false); setInspect(false);
      setNotice('Loose files refreshed from disk. Review the plan before restarting.');
    } catch (e) { setNotice(`Refresh stopped: ${messageOf(e)}`); }
    finally { io.current = false; setBusy(false); }
  }
  async function undo(retry = false) {
    if (!undoable || !engine.current || io.current || inFlight.current) return;
    io.current = true; setBusy(true);
    try {
      const restored = await engine.current.undo(undoable); await refreshJournal();
      if (dir && await dir.isSameEntry(restored.target!)) { const found = await scan(dir); const restoredItems = found.files.map(handle => ({ name: handle.name, handle }));
        if (retry) restoredItems.sort((a, b) => Number(b.name === restored.targetName) - Number(a.name === restored.targetName));
        setItems(restoredItems); setSkipped([]); }
      lastSuccess.current = undefined;
      if (retry) { setScore(n => Math.max(0, n - 1)); setResult(false); setPrepared(false); setResetShot(n => n + 1); if (left <= 0) setLeft(duration); }
      setNotice(`Undo verified. Restored as ${restored.targetName}; existing names were preserved.`);
    } catch (e) { setNotice(`Undo stopped: ${messageOf(e)}`); await refreshJournal().catch(() => {}); }
    finally { io.current = false; setBusy(false); }
  }
  async function reshoot() {
    if (io.current || busy) return;
    // Cancel the visual projectile before any basket intent can become a move.
    if (inFlight.current || lastMiss || !lastSuccess.current) {
      inFlight.current = false; setFlight(false); setPrepared(false);
      setResetShot(n => n + 1); setLastMiss(false); setResult(false);
      if (left <= 0) setLeft(duration);
      setNotice('Reshoot ready. Same file; no file operation performed.');
      return;
    }
    if (mode === 'local') { await undo(true); return; }
    const previous = lastSuccess.current; lastSuccess.current = undefined;
    setItems(queue => [previous, ...queue]); setScore(n => Math.max(0, n - 1));
    setResult(false); setPrepared(false); setResetShot(n => n + 1);
    if (left <= 0) setLeft(duration);
    setNotice('Previous sample returned to the launcher. Take the shot again.');
  }
  if (!entered) return <FolderEntry busy={busy} notice={notice} onChoose={() => void chooseFolder()} onDemo={demo} />;
  return <main className="shell session-shell">
    <header className="masthead">
      <a className="brand" href="#court"><span>◉</span> SlamSort</a>
      <span className="session-tag">A LITTLE COURT. A CLEANER FOLDER.</span>
      <div className="header-actions">
        <button className={mode === 'demo' ? 'active' : ''} disabled={busy || flight} onClick={demo}>Demo</button>
        <button className="primary" disabled={busy || flight} onClick={() => void chooseFolder()}>Open local folder</button>
        <button onClick={() => { if (!sound) unlockSound(); setSound(s => !s); }} aria-pressed={sound}>{sound ? '♪ On' : '♪ Off'}</button>
      </div>
    </header>
    <div className="session-privacy">Files remain on your device. Only prompts and excerpts you approve go to Google Vertex AI.
      <span>{ai.status.status}</span>
    </div>
    {mode === 'local' && setup && items.length === 0 && !busy && <section className="empty-folder" role="status">
      <p className="eyebrow">NO FILES IN THE LAUNCH QUEUE</p>
      <h2>{directories.length ? 'Choose a subfolder with files to play.' : 'Choose a folder with files to play.'}</h2>
      <p>The scan found 0 files directly inside this folder{directories.length ? ` and ${directories.length} subfolders` : ''}. Open one below, or select another folder. Your destination names are kept while you browse; approval appears when files are available.</p>
      <div className="buttons">{directories.filter(name=>!name.startsWith('.') && !['node_modules','vendor'].includes(name)).map(name=><button key={name} disabled={busy} onClick={()=>void refine(name)}>Open {name} →</button>)}<button className="primary" onClick={()=>void chooseFolder()}>Select another folder</button></div>
    </section>}
    {!setup && (buffer.loading || buffer.error) && items.length > 0 && <section className="file-loading" role="status" aria-live="polite">
      <div className="loading-machine" aria-hidden="true">▱ <span>→</span> ◉</div>
      <p className="eyebrow">GETTING THE COURT READY</p>
      <h2>{buffer.error ? 'File preparation needs attention' : 'Loading your first shots…'}</h2>
      <p>{buffer.error || 'Preparing local file previews. The timer and launcher stay paused until the starting buffer is ready.'}</p>
      {!buffer.error && <><progress max={Math.min(4,items.length)} value={buffer.count} /><strong>{buffer.count} / {Math.min(4,items.length)} files ready</strong><small>{items.length < 4 ? 'Fewer than four files: preparing every available file.' : 'Four files ready before the first shot. The next previews prepare while you play.'} Nothing uploads.</small></>}
      {buffer.error && <button className="primary" onClick={()=>void chooseFolder()}>Reopen a folder</button>}
    </section>}
    {setup && items.length > 0 && <section className="setup-card">
      <div>
        <p className="eyebrow">YOUR FOLDERS, YOUR CALL</p>
        <h2>Review 1–5 destinations.</h2>
        <p><strong>{items.length} files ready to prepare</strong> in {path.at(-1) ?? 'this folder'}. {directories.length} subfolders can be opened separately. Edit proposals freely. Approval freezes the round.</p>
        <AiSetup ai={ai} apply={setDraft} />
      </div>
      <div className="bin-inputs">
        {draft.map((name, i) => <label key={i}>BIN {i + 1}
          <input aria-label={`Category ${i + 1}`} value={name} maxLength={80}
            onChange={e => setDraft(v => v.map((s, j) => j === i ? e.target.value : s))} />
        </label>)}
        <div className="buttons">
          <button disabled={draft.length >= 5} onClick={() => setDraft(b => [...b, `Category ${b.length + 1}`])}>+ Bin</button>
          <button disabled={draft.length <= 1} onClick={() => setDraft(b => b.slice(0, -1))}>− Bin</button>
          <label>Seconds<input type="number" min={15} max={3600} value={duration}
            onChange={e => setDuration(Math.max(15, Math.min(3600, Number(e.target.value) || 120)))} /></label>
          <button className="primary" onClick={startRound} disabled={!!approvalBlocked} aria-describedby={approvalBlocked ? 'approval-blocked' : undefined}>Approve & play</button>
        </div>
        {approvalBlocked && <p id="approval-blocked" role="status">{approvalBlocked}</p>}
      </div>
    </section>}
    {!setup && !buffer.loading && !buffer.error && items.length > 0 && <section className="play-layout" aria-label="Sorting session">
      <aside className="file-card session-file">
        <div className="file-heading">
          <p className="eyebrow">{mode === 'demo' ? 'FICTIONAL SAMPLE' : 'LOCAL FILE'}</p>
          <span className="pill">{flight ? 'IN FLIGHT' : prepared ? 'READY TO SHOOT' : 'PAPER → BALL'}</span>
        </div>
        <h2 title={current?.name}>{current?.name ?? 'The bench is clear.'}</h2>
        {current && <>
          <Preview preparedFile={buffer.first} handle={current.handle} demoName={current.name} inspect={inspect} />
          <div className="buttons">
            <button disabled={busy || flight || hintOpen} aria-pressed={inspect} onClick={() => setInspect(v => !v)}>{inspect ? 'Close inspection' : 'Inspect / pause'}</button>
            <button disabled={busy || flight || setup || result || hintOpen} onClick={() => {
              setSkipped(v => [...v, current]); setItems(v => v.slice(1)); setInspect(false);
              setLastMiss(false); setNotice('File set aside unchanged. Resume remaining to return to skipped files.');
            }}>Skip unchanged</button>
          </div>
        </>}
        <div className="keyboard-control">
          <label htmlFor="destination">Destination · keys 1–{bins.length}</label>
          <div className="buttons">
            <select id="destination" value={destination} onChange={e => setDestination(Number(e.target.value))}>
              {bins.map((name, i) => <option value={i} key={i}>{i + 1} · {name}</option>)}
              <option value={-1}>Duplicates — kept</option>
            </select>
            <button className="primary" disabled={!enabled} onClick={() => setFire(n => n + 1)}>Fire ↗</button>
          </div>
          <small>Aim and release. After a basket, grab the ball within 1 second to correct its destination. Drop outside to retry. The left can keeps files in Duplicates.</small>
        </div>
        <div className="buttons">
          <button disabled={!current || busy || flight || setup || result} onClick={() => { ai.setHint(undefined); setHintOpen(true); }}>✦ Ask Gemini · review first</button>
          <button disabled={busy || flight || setup || result} onClick={configure}>Bins / timer / Gemini</button>
          {lastMiss && <button disabled={busy || flight} onClick={() => { setLastMiss(false); setNotice('Miss undone: same file, no point, no file operation. Aim again.'); }}>↶ Undo miss · retry unchanged</button>}
        </div>
        {mode === 'local' && <button className="sidebar-undo" disabled={!undoable || busy || flight || hintOpen || pending.length > 0 || !held}
          onClick={() => void undo(false)}>↶ Undo last verified move</button>}
      </aside>
      <section className="court-panel" id="court">
        <div className="court-heading">
          <div><span className="live-dot" /><strong>{mode === 'demo' ? 'DEMO COURT' : 'LOCAL FOLDER COURT'}</strong>
            <span className="round">ROUND {round} / {mode === 'demo' ? 'SAMPLE DATA · NO DISK CHANGES' : path.join(' / ')}</span>
          </div>
          <div className="stats">
            <span><b>{score}</b> baskets</span><span><b>{items.length + skipped.length}</b> remaining</span>
            <span className={left < 20 ? 'warning' : ''}><b>{Math.floor(Math.ceil(left) / 60)}:{String(Math.ceil(left) % 60).padStart(2, '0')}</b>{paused ? 'paused' : result ? 'ended' : 'on the clock'}</span>
          </div>
        </div>
        <div className="current-file-strip"><span>{flight ? 'PAPER IN FLIGHT' : 'THIS FILE → THIS PAPER BALL'}</span><strong>{current?.name ?? 'Round complete'}</strong></div>
        <Court reset={resetShot} labels={bins} fileKey={`${mode}:${path.join('/')}:${current?.name ?? 'done'}`} filename={current?.name ?? ''}
          onReady={setPrepared} enabled={enabled} paused={paused || result || setup} sound={sound} fire={fire} destination={destination}
          onShot={() => { if (!inFlight.current) { inFlight.current = true; setLastMiss(false); setFlight(true); } }}
          onSettle={basket => void settle(basket)} />
        <div className="court-caption">
          <button className="reshoot-button" disabled={busy || setup || hintOpen || (mode === 'local' && pending.length > 0)} onClick={() => void reshoot()}>↶ Reshoot</button>
          <span>PULL BACK ↙ · RELEASE ↗ · MISSES KEEP YOUR FILE</span>
          <button onClick={() => setManual(p => !p)} disabled={setup || result}>{manual ? '▶ Resume' : 'Ⅱ Pause'}</button>
        </div>
      </section>
    </section>}
    <div className="status" role="status">{notice}{paused && <small>Paused: {reasons.join(' + ')}</small>}</div>
    {hintOpen && current && <HintPanel key={`${mode}:${path.join('/')}:${current.name}`} ai={ai} name={current.name}
      handle={current.handle} labels={bins} onClose={() => setHintOpen(false)} />}
    {result && <section className="result-card">
      <p className="eyebrow">{items.length === 0 && skipped.length === 0 ? 'THAT’S A CLEAN SWEEP' : 'TAKE A BREATHER'}</p>
      <h2>{score} verified {mode === 'demo' ? 'sample ' : ''}baskets. {items.length + skipped.length} files to go.</h2>
      <p>{mode === 'demo' ? 'No real files changed.' : 'Completed moves are kept. Continue, refine a category, or stop here.'}</p>
      <div className="buttons">
        {(items.length > 0 || skipped.length > 0) && <button className="primary" onClick={() => {
          ai.freeze(bins); setItems(v => [...v, ...skipped]); setSkipped([]); setLeft(duration);
          setScore(0); setResult(false); setManual(false); setRound(n => n + 1);
        }}>Resume remaining</button>}
        <button disabled={busy || flight} onClick={configure}>Edit next round</button>
        {mode === 'demo' && <button onClick={demo}>Play again</button>}
      </div>
    </section>}
    {mode === 'local' && <section className="local-panel">
      <h2>Your local session</h2>
      <p>{held && journal ? 'Exclusive session locked · durable journal ready' : 'Local mutations disabled: exclusive Web Lock and IndexedDB required.'}
        {' '}· Copy → verify every byte → recheck → remove source. Not atomic; keep this folder idle in other apps.</p>
      <div className="buttons">
        <button disabled={busy || flight} onClick={() => void rescan()}>Refresh loose files / review plan</button>
        {bins.map(name => <button key={name} disabled={busy || flight || setup || pending.length > 0}
          onClick={() => void refine(name)}>Refine {name} {ai.children[name] ? '✦ draft ready' : '→'}</button>)}
      </div>
      <p>Refinement opens an editable next-level plan. Stop at any depth. Directories are deferred, never recursively deleted. The left trash can moves files into Duplicates; it never deletes them. You decide which files are duplicates; automatic detection is deferred.</p>
      <details><summary>Journal · {entries.length} operations</summary>
        {entries.slice().sort((a, b) => b.at - a.at).map(e => <p key={e.id}>{e.status} · {e.sourceName} → {e.category ? `${e.category}/` : ''}{e.targetName}{e.undoOf ? ' (undo)' : ''}{e.error ? ` · ${e.error}` : ''}</p>)}
      </details>
    </section>}
    {pending.length > 0 && <section className="recovery">
      <h2>Interrupted operations need review</h2>
      <p>No automatic retry or deletion. Inspect both folders manually and retain uncertain copies.</p>
      {pending.map(e => <article key={e.id}>
        <strong>{e.sourceName} → {e.category ?? ''}/{e.targetName}</strong><p>{e.error || e.status}</p>
        <div className="buttons">
          <button disabled={busy} onClick={() => void inspectEntry(e).then(s => setRecovery(r => ({ ...r, [e.id]: s })))}>Check both copies</button>
          <button disabled={!recovery[e.id] || !held || busy || flight} onClick={() => {
            if (journal) void journal.put({ ...e, status: 'retained' }).then(refreshJournal).catch(error => setNotice(messageOf(error)));
          }}>Acknowledge manual recovery · keep copies</button>
        </div><p>{recovery[e.id]}</p>
      </article>)}
    </section>}
    <footer><span>SLAMSORT / FILES STAY LOCAL · APPROVED AI CONTEXT GOES TO VERTEX</span><span>MANUAL PLAY ALWAYS AVAILABLE · AI BY CONSENT</span></footer>
  </main>;
}
