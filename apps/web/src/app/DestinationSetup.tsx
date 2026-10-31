import type { AiController } from '../ai/useAi';
import { AiSetup } from '../ai/AiSetup';
import { LevelTree } from './LevelTree';
import { MAX_BINS, MIN_BINS, roundDuration } from './roundRules';
import type { AiFileSummary } from '@slamsort/shared';

interface DestinationSetupProps {
  ai: AiController;
  labels: string[];
  folderName: string;
  fileCount: number;
  directoryCount: number;
  duration: number;
  blocked: string;
  onLabels: (labels: string[]) => void;
  onDuration: (seconds: number) => void;
  onApprove: () => void;
  readFiles: () => Promise<AiFileSummary[]>;
}

export function DestinationSetup(props: DestinationSetupProps) {
  const { ai, labels, folderName, fileCount, directoryCount, duration, blocked,
    onLabels, onDuration, onApprove, readFiles } = props;

  return <section className="setup-card">
    <div>
      <p className="eyebrow">YOUR FOLDERS, YOUR CALL</p>
      <h2>Set up your destinations once.</h2>
      <p><strong>{fileCount} files ready to prepare</strong> in {folderName}. {directoryCount} subfolders can be opened separately. Edit proposals freely. Approve once; later levels continue automatically.</p>
      <AiSetup ai={ai} apply={onLabels} readFiles={readFiles} />
    </div>
    <div className="bin-inputs">
      <LevelTree labels={labels} path={[]} ai={ai} demo={false}
        onChange={(index, value) => onLabels(labels.map((name, i) => i === index ? value : name))} />
      <div className="buttons">
        <button disabled={labels.length >= MAX_BINS}
          onClick={() => onLabels([...labels, `Category ${labels.length + 1}`])}>+ Bin</button>
        <button disabled={labels.length <= MIN_BINS}
          onClick={() => onLabels(labels.slice(0, -1))}>− Bin</button>
        <label>Seconds<input type="number" min={15} max={3600} value={duration}
          onChange={event => onDuration(roundDuration(event.target.valueAsNumber))} /></label>
        <button className="primary" onClick={onApprove} disabled={!!blocked}
          aria-describedby={blocked ? 'approval-blocked' : undefined}>Approve & play</button>
      </div>
      {blocked && <p id="approval-blocked" role="status">{blocked}</p>}
    </div>
  </section>;
}
