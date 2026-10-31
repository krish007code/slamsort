import { useCallback, useEffect, useRef, useState } from 'react';
import { AiClient, RequestScope, matchesResponse } from './client';
import { shareableName } from '../files/aiContext';
import type { AiStatus } from './client';
import type { AiFileSummary, FileHintRequest, FileHintResponse } from '@slamsort/shared';
interface ChildDraft { labels: string[]; explanation: string; fallback?: boolean; fileCount?: number; stale?: boolean }
export const levelKey = (path: readonly string[]) => JSON.stringify(path);
export function useAi() {
  const levelScope = useRef(new RequestScope());
  const levelCache = useRef(new Map<string, { signature: string; job: Promise<ChildDraft> }>());
  const levelQueue = useRef<Promise<unknown>>(Promise.resolve());
  const contexts = useRef(new Map<string, AiFileSummary[]>());
  const [contextVersion, setContextVersion] = useState(0);
  const [shareNames, setShareNames] = useState(false);
  const hintScope = useRef(new RequestScope());
  const client = useRef(new AiClient()), scope = useRef(new RequestScope());
  const session = useRef(crypto.randomUUID()), plan = useRef(crypto.randomUUID());
  const [status, setStatus] = useState<AiStatus>({ mode: 'disabled', enabled: false, status: 'Checking AI API…' });
  const [prompt, setPrompt] = useState(''), [approvedPrompt, setApprovedPrompt] = useState('');
  const [working, setWorking] = useState(false), [message, setMessage] = useState('');
  const [levels, setLevels] = useState<Record<string, ChildDraft>>({});
  const [planning, setPlanning] = useState<Record<string, boolean>>({});
  const [hint, setHint] = useState<FileHintResponse>();
  const [background, setBackground] = useState(true);
  const [roundPlan, setRoundPlan] = useState<{ id: string; labels: string[]; prompt: string; path: string[] }>();
  async function reconnect() {
    try { setStatus(await client.current.bootstrap()); } catch (e) { setStatus({ mode: 'disabled', enabled: false, status: e instanceof Error ? e.message : 'AI API unavailable. Manual bins work.' }); }
  }
  useEffect(() => { void reconnect(); return () => { scope.current.invalidate(); hintScope.current.invalidate(); levelScope.current.invalidate(); }; }, []);
  function invalidate(newSession = false) {
    scope.current.invalidate(); hintScope.current.invalidate(); plan.current = crypto.randomUUID();
    if (newSession) { session.current = crypto.randomUUID(); setApprovedPrompt(''); levelScope.current.invalidate(); levelCache.current.clear(); contexts.current.clear(); setLevels({}); setPlanning({}); }
    setHint(undefined); setWorking(false); setRoundPlan(undefined); setMessage('');
  }
  async function generate(apply: (labels: string[]) => void, readFiles?: () => Promise<AiFileSummary[]>) {
    if (working || !status.enabled || !prompt.trim()) return;
    invalidate(); levelScope.current.invalidate(); levelCache.current.clear(); contexts.current.clear(); setLevels({}); setPlanning({});
    const task = scope.current.begin(); setWorking(true);
    try {
      const files = shareNames && readFiles ? await readFiles() : [];
      if (!task.current()) return;
      const request = { sessionId: session.current, requestId: crypto.randomUUID(), parentId: null, prompt, files, ...(files.length ? { fileContextApproved: true } : {}) };
      const response = await client.current.plan(request, task.signal);
      if (!task.current() || !matchesResponse(request, response)) return;
      const labels = response.categories.map(c => c.label);
      apply(labels); setApprovedPrompt(prompt);
      if (background) setRoundPlan({ id: plan.current, labels, prompt, path: [] });
      setMessage(`Gemini proposal: ${response.explanation} Edit the names, then approve the round.`);
      setStatus(s => ({ ...s, enabled: true, status: 'Vertex connected · last request succeeded.' }));
    } catch (e) { if (task.current()) setMessage(e instanceof Error ? e.message : 'AI request failed. Manual bins work.'); }
    finally { task.finish(); if (task.current()) setWorking(false); }
  }
  // First draft while playing, then refresh once with final membership before entry.
  const prepareLevel = useCallback((path: string[], label: string, approved = approvedPrompt, finalize = false): Promise<ChildDraft> => {
    const key = levelKey(path), cached = levelCache.current.get(key);
    const files = shareNames ? contexts.current.get(key) ?? [] : [];
    const signature = JSON.stringify(files.map(f => f.fileId));
    if (cached && (cached.signature === signature || (!finalize && cached.signature !== '[]'))) return cached.job;
    const task = levelScope.current.begin();
    setPlanning(p => ({ ...p, [key]: true }));
    const job = levelQueue.current.then(async () => {
      let draft: ChildDraft = cached ? await cached.job : { labels: ['Keep', 'Reference', 'Archive'], explanation: 'Local fallback destinations', fallback: true };
      if (!task.current()) throw new Error('Folder session changed.');
      if (background && approved && status.enabled) {
        const parentId = crypto.randomUUID();
        const request = { sessionId: session.current, requestId: crypto.randomUUID(), parentId, parentLabel: label, prompt: approved, files, ...(files.length ? { fileContextApproved: true } : {}) };
        try {
          const response = await client.current.plan(request, task.signal);
          if (!task.current()) throw new Error('Folder session changed.');
          if (matchesResponse(request, response) && response.parentId === parentId)
            draft = { labels: response.categories.map(c => c.label), explanation: response.explanation, fileCount: files.length };
        } catch { draft = { ...draft, stale: !!cached }; }
      }
      if (!task.current()) throw new Error('Folder session changed.');
      setLevels(p => ({ ...p, [key]: draft })); setPlanning(p => ({ ...p, [key]: false }));
      return draft;
    }).finally(task.finish);
    levelCache.current.set(key, { signature, job });
    levelQueue.current = job.catch(() => {});
    return job;
  }, [approvedPrompt, background, status.enabled, shareNames]);
  function freeze(labels: string[], path: string[] = []) {
    invalidate(); const id = plan.current;
    setRoundPlan({ id, labels: [...labels], prompt: approvedPrompt, path });
  }
  useEffect(() => {
    if (!roundPlan) return;
    let alive = true;
    void (async () => {
      for (const label of roundPlan.labels) {
        if (!alive) break;
        if (shareNames && (contexts.current.get(levelKey([...roundPlan.path, label]))?.length ?? 0) < 2) continue;
        try { await prepareLevel([...roundPlan.path, label], label, roundPlan.prompt); }
        catch { break; }
      }
    })();
    return () => { alive = false; };
  }, [roundPlan, prepareLevel, shareNames, contextVersion]);
  const children = Object.fromEntries((roundPlan?.labels ?? []).flatMap(label => {
    const child = levels[levelKey([...(roundPlan?.path ?? []), label])];
    return child ? [[label, child]] : [];
  }));
  function recordFile(path: string[], file: AiFileSummary) {
    if (!shareNames || !file.approvedName || !shareableName(file.approvedName)) return;
    const key = levelKey(path), files = contexts.current.get(key) ?? [];
    if (files.length < 12) contexts.current.set(key, [...files, file]);
    setContextVersion(n => n + 1);
  }
  function removeFile(fileId: string) {
    for (const [key, files] of contexts.current) contexts.current.set(key, files.filter(file => file.fileId !== fileId));
    setContextVersion(n => n + 1);
  }
  function hintPayload(file: FileHintRequest['file'], labels: string[], excerpt: string): FileHintRequest {
    return { sessionId: session.current, requestId: crypto.randomUUID(), planId: plan.current, file,
      approvedBuckets: labels.map((label, i) => ({ id: `${plan.current}-${i}`, parentId: null, label, kind: 'category' })),
      ...(excerpt ? { approvedExcerpt: excerpt } : {}) };
  }
  function cancelHint() { hintScope.current.invalidate(); setHint(undefined); setWorking(false); }
  async function requestHint(payload: FileHintRequest) {
    if (working || !status.enabled) return;
    const task = hintScope.current.begin(); setWorking(true); setHint(undefined); setMessage('');
    try {
      const response = await client.current.hint(payload, task.signal);
      if (!task.current() || !matchesResponse(payload, response) || response.fileId !== payload.file.fileId) return;
      setHint(response); setStatus(s => ({ ...s, enabled: true, status: 'Vertex connected · last request succeeded.' }));
    } catch (e) { if (task.current()) setMessage(e instanceof Error ? e.message : 'Hint unavailable.'); }
    finally { task.finish(); if (task.current()) setWorking(false); }
  }
  return { status, reconnect, prompt, setPrompt, approvedPrompt, background, setBackground, working, message, hint, setHint,
    generate, freeze, invalidate, children, levels, planning, prepareLevel, recordFile, removeFile, shareNames, setShareNames, hintPayload, requestHint, cancelHint };
}
export type AiController = ReturnType<typeof useAi>;
