import { useEffect, useRef, useState } from 'react';
import { AiClient, RequestScope, matchesResponse } from './client';
import type { AiStatus } from './client';
import type { FileHintRequest, FileHintResponse } from '@slamsort/shared';
interface ChildDraft { labels: string[]; explanation: string }
export function useAi() {
  const attempted = useRef(new Set<string>());
  const hintScope = useRef(new RequestScope());
  const client = useRef(new AiClient()), scope = useRef(new RequestScope());
  const session = useRef(crypto.randomUUID()), plan = useRef(crypto.randomUUID());
  const [status, setStatus] = useState<AiStatus>({ mode: 'disabled', enabled: false, status: 'Checking AI API…' });
  const [prompt, setPrompt] = useState(''), [approvedPrompt, setApprovedPrompt] = useState('');
  const [working, setWorking] = useState(false), [message, setMessage] = useState('');
  const [children, setChildren] = useState<Record<string, ChildDraft>>({});
  const [hint, setHint] = useState<FileHintResponse>();
  const [background, setBackground] = useState(false);
  const [roundPlan, setRoundPlan] = useState<{ id: string; labels: string[]; prompt: string }>();
  async function reconnect() {
    try { setStatus(await client.current.bootstrap()); } catch (e) { setStatus({ mode: 'disabled', enabled: false, status: e instanceof Error ? e.message : 'AI API unavailable. Manual bins work.' }); }
  }
  useEffect(() => { void reconnect(); return () => { scope.current.invalidate(); hintScope.current.invalidate(); }; }, []);
  function invalidate(newSession = false) {
    scope.current.invalidate(); hintScope.current.invalidate(); plan.current = crypto.randomUUID();
    if (newSession) { session.current = crypto.randomUUID(); setApprovedPrompt(''); }
    setChildren({}); setHint(undefined); setWorking(false); setRoundPlan(undefined); setMessage('');
  }
  async function generate(apply: (labels: string[]) => void) {
    if (working || !status.enabled || !prompt.trim()) return;
    invalidate(); const task = scope.current.begin(); setWorking(true);
    const request = { sessionId: session.current, requestId: crypto.randomUUID(), parentId: null, prompt, files: [] };
    try {
      const response = await client.current.plan(request, task.signal);
      if (!task.current() || !matchesResponse(request, response)) return;
      apply(response.categories.map(c => c.label)); setApprovedPrompt(prompt);
      setMessage(`Gemini proposal: ${response.explanation} Edit the names, then approve the round.`);
      setStatus(s => ({ ...s, enabled: true, status: 'Vertex connected · last request succeeded.' }));
    } catch (e) { if (task.current()) setMessage(e instanceof Error ? e.message : 'AI request failed. Manual bins work.'); }
    finally { task.finish(); if (task.current()) setWorking(false); }
  }
  function freeze(labels: string[]) {
    invalidate(); const id = plan.current;
    setRoundPlan({ id, labels: [...labels], prompt: approvedPrompt });
  }
  useEffect(() => {
    if (!roundPlan || !background || !roundPlan.prompt || !status.enabled) return;
    const task = scope.current.begin();
    void (async () => {
      // One sequential request per category per approved plan; no membership names.
      for (let i = 0; i < roundPlan.labels.length; i++) {
        if (!task.current()) break;
        const label = roundPlan.labels[i]!;
        const key = `${session.current}:${roundPlan.id}:${i}`;
        if (attempted.current.has(key)) continue;
        attempted.current.add(key);
        const request = { sessionId: session.current, requestId: crypto.randomUUID(), parentId: `${roundPlan.id}-${i}`, parentLabel: label, prompt: roundPlan.prompt, files: [] };
        try {
          const response = await client.current.plan(request, task.signal);
          if (!task.current() || !matchesResponse(request, response) || response.parentId !== request.parentId) break;
          setChildren(drafts => ({ ...drafts, [label]: { labels: response.categories.map(c => c.label), explanation: response.explanation } }));
        } catch { if (task.current()) setMessage('A refinement proposal was unavailable. Manual refinement still works.'); }
        if (i + 1 < roundPlan.labels.length && task.current()) await new Promise<void>(resolve => {
          const timer = window.setTimeout(resolve, 1200);
          task.signal.addEventListener('abort', () => { window.clearTimeout(timer); resolve(); }, { once: true });
        });
      }
      task.finish();
    })();
    return () => task.cancel();
  }, [roundPlan, background, status.enabled]);
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
    generate, freeze, invalidate, children, hintPayload, requestHint, cancelHint };
}
export type AiController = ReturnType<typeof useAi>;
