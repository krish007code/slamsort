import { useEffect, useState } from 'react';
import type { AiController } from './useAi';
import type { FileHintRequest } from '@slamsort/shared';
import type { LocalFile } from '../files/engine';
async function localExcerpt(handle?: LocalFile): Promise<string> {
  if (!handle) return 'Weekend ideas\nA little more space. A little less clutter.';
  const file = await handle.getFile();
  if (/\.(txt|md|csv|json|log|css|html|js|ts)$/i.test(file.name)) return (await file.slice(0, 32000).text()).slice(0, 8000);
  if (/\.pdf$/i.test(file.name) && file.size < 25 * 1024 * 1024) {
    const pdf = await import('pdfjs-dist');
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url'); pdf.GlobalWorkerOptions.workerSrc = worker.default;
    const task = pdf.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    try { const doc = await task.promise; const page = await doc.getPage(1); const content = await page.getTextContent();
      return content.items.map(item => 'str' in item ? item.str : '').join(' ').slice(0, 8000);
    } finally { await task.destroy(); }
  }
  throw new Error('No text excerpt for this format/size. Metadata-only hints still work.');
}
export function HintPanel({ ai, name, handle, labels, onClose }: {
  ai: AiController; name: string; handle?: LocalFile | undefined; labels: string[]; onClose: () => void;
}) {
  useEffect(() => () => ai.cancelHint(), []);
  const [shareName, setShareName] = useState(false), [excerpt, setExcerpt] = useState('');
  const [payload, setPayload] = useState<FileHintRequest>(), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  useEffect(() => {
    let alive = true;
    setPayload(undefined); ai.setHint(undefined);
    void (async () => {
      const file = handle ? await handle.getFile() : undefined;
      const next = ai.hintPayload({ fileId: crypto.randomUUID(), mimeType: file?.type ?? 'text/plain', size: file?.size ?? 64,
        ...(shareName ? { approvedName: name } : {}) }, labels, excerpt);
      if (alive) setPayload(next);
    })().catch(() => { if (alive) setError('Could not read local metadata.'); });
    return () => { alive = false; };
  }, [handle, name, shareName, excerpt, labels]);
  async function load() {
    setLoading(true); setError('');
    try { setExcerpt(await localExcerpt(handle)); } catch (e) { setError(e instanceof Error ? e.message : 'Excerpt unavailable.'); }
    finally { setLoading(false); }
  }
  return <section className="hint-panel" aria-label="Review AI hint transmission">
    <div className="file-heading"><strong>Review before sending</strong><button disabled={ai.working} onClick={onClose}>Close</button></div>
    <p>Metadata-only by default. The exact approved payload below goes to Google Vertex AI. Gemini offers advice; it never moves your file.</p>
    <label className="checkbox"><input type="checkbox" checked={shareName} disabled={ai.working} onChange={e => setShareName(e.target.checked)} />Include this filename: {name}</label>
    <button disabled={loading || ai.working} onClick={() => void load()}>{loading ? 'Reading locally…' : 'Load text / first-page PDF excerpt locally'}</button>
    <label>Optional excerpt (editable, {excerpt.length}/8000)<textarea rows={4} maxLength={8000} value={excerpt} disabled={ai.working} onChange={e => setExcerpt(e.target.value)} /></label>
    <details open><summary>Exact outgoing data (no session token shown)</summary><pre>{payload ? JSON.stringify(payload, null, 2) : 'Preparing local metadata…'}</pre></details>
    <button className="primary" disabled={!payload || ai.working || !ai.status.enabled}
      onClick={() => { if (payload) void ai.requestHint(payload); }}>{ai.working ? 'Asking Gemini…' : 'I approve this payload · send hint request'}</button>
    {error && <p role="status">{error}</p>}
    {ai.hint && <p className="hint-result"><strong>Gemini suggests {payload?.approvedBuckets.find(b => b.id === ai.hint?.suggestedBucketId)?.label ?? 'no specific category'}.</strong> {ai.hint.explanation}</p>}
    <p role="status">{ai.message}</p>
  </section>;
}
