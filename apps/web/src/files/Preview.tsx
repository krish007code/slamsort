import { useEffect, useRef, useState } from 'react';
import type { PreparedFile } from './preparation';
import type { LocalFile } from './engine';
export function Preview({ handle, demoName, inspect, preparedFile }: { preparedFile?: PreparedFile | undefined; handle?: LocalFile | undefined; demoName?: string; inspect: boolean }) {
  const [text, setText] = useState(''), [url, setUrl] = useState(''), [meta, setMeta] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let alive = true, objectUrl = '', destroy: (() => void) | undefined;
    setText(''); setUrl(''); setMeta('');
    if (!handle && /\.(jpg|png)$/i.test(demoName ?? '')) { setUrl(demoName?.endsWith('.png') ? '/assets/demo-sketch.svg' : '/assets/demo-coast.svg'); return; }
    if (!handle) { setText(demoName?.endsWith('.txt') ? 'Weekend ideas\n\nA little more space. A little less clutter.\nTake the scenic route home.' : 'SAMPLE FILE\nA fictional local file, ready for its new home.'); return; }
    void (async () => {
      const file = preparedFile?.file ?? await handle.getFile();
      if (!alive) return;
      setMeta(`${(file.size / 1024).toFixed(1)} KB · ${file.type || 'Unknown format'} · ${new Date(file.lastModified).toLocaleDateString()}`);
      if (file.type.startsWith('image/') && file.size < 30 * 1024 * 1024) { objectUrl = URL.createObjectURL(file); setUrl(objectUrl); }
      else if (/\.(txt|md|csv|json|log|css|html|js|ts)$/i.test(file.name)) { const value = !inspect && preparedFile?.snippet ? preparedFile.snippet : await file.slice(0, inspect ? 64000 : 1500).text(); if (alive) setText(value); }
      else if (/\.pdf$/i.test(file.name) && file.size < 25 * 1024 * 1024) {
        const pdf = await import('pdfjs-dist');
        const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url'); pdf.GlobalWorkerOptions.workerSrc = worker.default;
        if (!alive) return;
        const task = pdf.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }); destroy = () => { void task.destroy(); };
        const doc = await task.promise, page = await doc.getPage(1);
        if (!alive || !canvas.current) return;
        const viewport = page.getViewport({ scale: inspect ? 1 : .5 }), context = canvas.current.getContext('2d');
        canvas.current.width = viewport.width; canvas.current.height = viewport.height;
        if (context) await page.render({ canvasContext: context, canvas: canvas.current, viewport }).promise;
      } else setText('Metadata preview only\nThis format or size is not rendered here.');
    })().catch(() => { if (alive) setText('Preview unavailable. The file is unchanged.'); });
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); destroy?.(); };
  }, [handle, demoName, inspect, preparedFile]);
  return <div className={`preview ${inspect ? 'expanded' : ''}`}><div className="preview-body">{url ? <img src={url} alt="Local file preview" /> : text ? <pre>{text}</pre> : <canvas ref={canvas} />}</div><small>{meta || (handle ? 'Reading local metadata…' : 'Demo content · no real files connected')}</small></div>;
}
