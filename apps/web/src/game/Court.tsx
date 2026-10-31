import { useEffect, useRef, useState } from 'react';
import type { CourtState } from './createCourt';
export function Court(props: CourtState) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef(props); state.current = props;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;
    void import('./createCourt').then(({ createCourt }) => {
      if (!cancelled && host.current) dispose = createCourt(host.current, () => state.current);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; dispose?.(); };
  }, []);
  return <div className="court" ref={host} aria-label="Basketball sorting court. Drag back from the ball and release. Or choose a category and press Fire.">
    {failed && <p className="canvas-error">The court could not load. Canvas support is required.</p>}
  </div>;
}
