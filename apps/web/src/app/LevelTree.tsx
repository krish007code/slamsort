import { levelKey } from '../ai/useAi';
import type { AiController } from '../ai/useAi';
export function LevelTree({ labels, path, ai, demo }: { labels: string[]; path: string[]; ai: AiController; demo: boolean }) {
  // Paths are cache keys only; local folder paths never become AI request metadata.
  function branch(names: string[], parent: string[] = []) {
    return <ul>{names.map(label => {
      const location = [...parent, label], key = levelKey(location), child = ai.levels[key];
      return <li key={label} className={levelKey(path) === key ? 'current-level' : undefined}>
        <span>{label}</span>
        <small>{demo ? 'Sample destination' : ai.planning[key] ? 'Preparing next level…' : child?.fallback ? 'Local fallback ready' : child ? 'Next level ready' : 'Queued'}</small>
        {child && branch(child.labels, location)}
      </li>;
    })}</ul>;
  }
  return <nav className="level-tree" aria-label="Folder levels">
    <p className="eyebrow">FOLDER LEVELS · LEVEL {path.length + 1}</p>
    <strong>{path.length ? path.join(' / ') : 'Top level'}</strong>
    {branch(labels)}
  </nav>;
}
