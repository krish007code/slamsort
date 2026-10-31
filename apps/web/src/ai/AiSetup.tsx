import type { AiFileSummary } from '@slamsort/shared';
import type { AiController } from './useAi';
export function AiSetup({ ai, apply, readFiles }: { ai: AiController; apply: (labels: string[]) => void; readFiles: () => Promise<AiFileSummary[]> }) {
  return <section className="ai-setup">
    <div className="file-heading"><strong>✦ Gemini folder coach</strong><button onClick={() => void ai.reconnect()}>Reconnect</button></div>
    <small>{ai.status.status}</small>
    <label htmlFor="organization-prompt">How would you like to organize this folder?</label>
    <textarea id="organization-prompt" maxLength={2000} rows={3} value={ai.prompt}
      onChange={e => ai.setPrompt(e.target.value)} placeholder="For example: organize my creative work into a few useful categories" />
    <p>Generate sends your prompt to Google Vertex AI. File names and types are included only if you enable the option below. File contents are never sent by folder planning.</p>
    <label className="checkbox"><input type="checkbox" checked={ai.background} onChange={e => ai.setBackground(e.target.checked)} />
      Prepare future levels automatically: reuse this prompt and category labels, up to 5 branches per level. Without file-name consent, planning uses only your prompt and category labels. No repeated approval screens.</label>
    <label className="checkbox"><input type="checkbox" checked={ai.shareNames} onChange={e => ai.setShareNames(e.target.checked)} />
      Use file names and types to plan bins: send metadata for up to 12 files per request. Child plans use files you place in each bin and refresh before that level starts. No contents, folder paths, hidden files or credential filenames are sent.</label>
    {ai.background && <small>Background drafting uses the last successfully generated prompt: {ai.approvedPrompt || 'none yet; Generate first.'}</small>}
    <button className="primary" disabled={!ai.status.enabled || ai.working || !ai.prompt.trim()}
      onClick={() => void ai.generate(apply, readFiles)}>{ai.working ? 'Asking Gemini…' : ai.shareNames ? 'Generate · send prompt + file names' : 'Generate with Gemini · send prompt'}</button>
    <p role="status">{ai.message}</p>
  </section>;
}
