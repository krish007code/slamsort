import type { AiController } from './useAi';
export function AiSetup({ ai, apply }: { ai: AiController; apply: (labels: string[]) => void }) {
  return <section className="ai-setup">
    <div className="file-heading"><strong>✦ Gemini folder coach</strong><button onClick={() => void ai.reconnect()}>Reconnect</button></div>
    <small>{ai.status.status}</small>
    <label htmlFor="organization-prompt">How would you like to organize this folder?</label>
    <textarea id="organization-prompt" maxLength={2000} rows={3} value={ai.prompt}
      onChange={e => ai.setPrompt(e.target.value)} placeholder="For example: organize my creative work into a few useful categories" />
    <p>Generate sends only the prompt above to Google Vertex AI. No filenames, membership lists or file contents are included.</p>
    <label className="checkbox"><input type="checkbox" checked={ai.background} onChange={e => ai.setBackground(e.target.checked)} />
      Prepare future levels automatically: reuse this prompt and category labels, up to 5 requests per level. No filenames or file contents are sent. No repeated approval screens.</label>
    {ai.background && <small>Background drafting uses the last successfully generated prompt: {ai.approvedPrompt || 'none yet; Generate first.'}</small>}
    <button className="primary" disabled={!ai.status.enabled || ai.working || !ai.prompt.trim()}
      onClick={() => void ai.generate(apply)}>{ai.working ? 'Asking Gemini…' : 'Generate with Gemini · send prompt'}</button>
    <p role="status">{ai.message}</p>
  </section>;
}
