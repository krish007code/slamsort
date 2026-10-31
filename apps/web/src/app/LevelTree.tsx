import { levelKey } from '../ai/useAi';
import type { AiController } from '../ai/useAi';
export function LevelTree({ labels, path, ai, demo, onChange }: { labels: string[]; path: string[]; ai: AiController; demo: boolean; onChange?: (index: number, value: string) => void }) {
  function branch(names: string[], parent: string[] = []) {
    return <ul>{names.map((label, index) => {
      const location = [...parent, label], key = levelKey(location), child = ai.levels[key];
      const preparing = ai.planning[key];
      return <li key={index}>
        <div className={`flow-node ${preparing ? 'is-planning' : child ? 'is-ready' : ''} ${levelKey(path) === key ? 'is-current' : ''}`}>
          <small className="flow-depth">LEVEL {parent.length + 1} · BIN {index + 1}</small>
          {onChange && parent.length === 0 ? <input aria-label={`Category ${index + 1}`} value={label} maxLength={80} onChange={e => onChange(index, e.target.value)} /> : <strong>{label}</strong>}
          <small className="flow-state"><i aria-hidden="true" />{demo ? 'Sample bin' : preparing ? 'Gemini is planning…' : child?.fallback ? 'Local fallback ready' : child ? child.fileCount ? `${child.stale ? 'Earlier draft' : 'Ready'} · ${child.fileCount} file names` : 'Ready · prompt based' : ai.shareNames ? 'Waiting for sorted files' : 'Next level queued'}</small>
        </div>
        {child ? branch(child.labels, location) : parent.length === 0 && <ul><li><div className={`flow-pending ${preparing ? 'is-planning' : ''}`}><span>◇</span>{preparing ? 'Creating child bins' : 'Future bins appear here'}<small>{ai.shareNames ? 'From the files you sort here' : 'From your organization goal'}</small></div></li></ul>}
      </li>;
    })}</ul>;
  }
  return <nav className={`level-tree flow-chart ${onChange ? 'flow-editor' : ''}`} aria-label="Folder level flowchart">
    <p className="eyebrow">FOLDER MAP · LEVEL {path.length + 1}</p>
    <div className="flow-root">◈ {path.length ? path.join(' / ') : 'Your selected folder'}</div>
    <div className="flow-scroll">{branch(labels)}</div>
  </nav>;
}
