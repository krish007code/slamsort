import { useEffect, useRef } from 'react';
import { supportsLocalFolders } from '../files/capabilities';

interface Props { busy: boolean; notice: string; onChoose: () => void; onDemo: () => void }
export function FolderEntry({busy, notice, onChoose, onDemo}: Props) {
  const root = useRef<HTMLElement>(null), ball = useRef<SVGGElement>(null);
  const sheet = useRef<SVGGElement>(null), label = useRef<SVGTextElement>(null);
  useEffect(() => {
    let frame = 0;
    const resize = () => root.current?.style.setProperty('--viewport-height', `${window.innerHeight}px`);
    resize(); window.addEventListener('resize', resize);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Illustration uses fictional file labels only; no selected files or cloud calls.
    const animate = (time: number) => {
      const t = reduced ? .72 : (time % 5200) / 5200;
      const feeding = t < .44, feed = Math.min(1, t / .44);
      sheet.current?.setAttribute('transform', `translate(${44 + feed * 188} 334) rotate(${-8 + feed * 8}) scale(${1 - Math.max(0,feed-.8)*3})`);
      sheet.current?.setAttribute('opacity', feeding ? '1' : '0');
      const p = Math.max(0, Math.min(1, (t - .44) / .48));
      const x = 263 + p * 302, y = 326 - 460 * p + 324 * p * p;
      ball.current?.setAttribute('transform', `translate(${x} ${y}) rotate(${p * 480})`);
      ball.current?.setAttribute('opacity', feeding ? '0' : String(Math.min(1,(1-p)*10)));
      if (label.current) label.current.textContent = ['lecture-notes.pdf','weekend-photo.jpg','project-draft.docx'][Math.floor(time / 5200) % 3]!;
      if (!reduced) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); };
  }, []);
  return <main className="folder-entry hero-screen" ref={root} onPointerMove={event => {
    if (event.pointerType !== 'mouse') return;
    const rect=event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--pointer-x', `${(event.clientX/rect.width-.5)*9}px`);
    event.currentTarget.style.setProperty('--pointer-y', `${(event.clientY/rect.height-.5)*7}px`);
  }}>
    <div className="entry-backdrop" aria-hidden="true" />
    <header><a className="brand" href="#start"><span>◉</span> SlamSort</a><span className="hero-kicker">A LITTLE AIM. A LOT LESS CLUTTER.</span><span className="entry-league">THE LOCAL LEAGUE / 01</span></header>
    <div className="hero-content">
      <section className="entry-card" id="start">
        <p className="eyebrow"><span className="live-dot" />YOUR FOLDER IS THE NEXT LEVEL</p>
        <h1>Big mess.<br /><em>Clean shot.</em></h1>
        <p>A folder full of files.<br />A cannon, a few hoops, and you.</p>
        <button className="primary entry-choose" disabled={busy} onClick={onChoose}>{busy ? 'Opening folder…' : 'Select a folder'}<span aria-hidden="true">↗</span></button>
        <button className="entry-demo" disabled={busy} onClick={onDemo}>Take a practice shot <span aria-hidden="true">→</span></button>
        <div className="entry-trust"><span aria-hidden="true">⌁</span><small>Stays on your device. You choose what moves.<br />No file upload. No account needed to play.</small></div>
        {!supportsLocalFolders() && <p className="browser-note">Real folder moves need desktop Chrome, Chromium, or Edge. Open this same link there, or try a practice round here.</p>}
        <p className="entry-notice" role="status">{notice.startsWith('Welcome') ? '' : notice}</p>
      </section>
      <div className="hero-art" aria-label="Animated illustration: a document travels down a conveyor, becomes a paper ball, and flies into a hoop.">
        <span className="art-caption">THE CLUTTER-TO-CLEAN MACHINE</span>
        <svg viewBox="0 0 700 500" role="img" aria-label="File to basketball hoop illustration">
          <defs>
            <linearGradient id="machine" x2="1" y2="1"><stop stopColor="#78a89b"/><stop offset="1" stopColor="#1f525c"/></linearGradient>
            <linearGradient id="wood" x2="0" y2="1"><stop stopColor="#c49459"/><stop offset="1" stopColor="#73503b"/></linearGradient>
          </defs>
          <ellipse cx="350" cy="441" rx="300" ry="17" fill="#0f1019" opacity=".5"/>
          <g stroke="#342536" strokeWidth="4">
            <path d="M61 384v51m142-51v51" stroke="#94745e" strokeWidth="12"/>
            <rect x="20" y="365" width="205" height="31" rx="11" fill="#223c43"/>
            <path d="M32 376h178" stroke="#819b8d" strokeWidth="3"/>
            {[42,70,98,126,154,182,210].map(x=><circle key={x} cx={x} cy="382" r="8" fill="#526b65" strokeWidth="2"/>)}
            <rect x="212" y="284" width="72" height="114" rx="8" fill="url(#machine)"/>
            <rect x="223" y="325" width="50" height="32" rx="2" fill="#122c37"/>
            <path d="M284 367l43-13" stroke="#ad8c64" strokeWidth="11"/>
            <circle cx="248" cy="305" r="6" fill="#efc778"/>
            <path d="M291 424a43 39 0 0 1 86 0z" fill="url(#machine)" stroke="#b5c6a4"/>
            <path d="M304 397l-43-67 33-23 45 70z" fill="url(#machine)" stroke="#789b8b"/>
            <path d="M261 330l33-23" stroke="#d0d2ac" strokeWidth="7"/>
            <path d="M284 422h100v14H284z" fill="#24363e"/>
            <path d="M612 91v329m-74 13h130" stroke="url(#wood)" strokeWidth="18"/>
            <path d="M607 156l-58-34" stroke="url(#wood)" strokeWidth="15"/>
            <path d="M524 195l13 60h54l13-60m-72 0l15 60m0-60l14 60m0-60l14 60m0-60l13 60m-59-40h67m-61 20h58" stroke="#b0c8aa" strokeWidth="2" fill="none"/>
            <ellipse cx="565" cy="194" rx="43" ry="7" fill="none" stroke="#69b39d" strokeWidth="7"/>
          </g>
          <path d="M264 317Q398 27 560 171" fill="none" stroke="#8cc5af" strokeWidth="4" strokeDasharray="1 17" strokeLinecap="round" opacity=".6"/>
          <g ref={sheet}><path d="M-24-35h34l16 16v52h-50z" fill="#f2e5c7" stroke="#b7a484" strokeWidth="2"/><path d="M10-35v17h16" fill="#b7c5ac"/><path d="M-14-8h27m-27 11h27m-27 11h19" stroke="#a6a58a" strokeWidth="3"/></g>
          <g ref={ball}><path d="M-15-7l9-10 14 2 10 12-5 14-15 7-13-8z" fill="#f4e8ce" stroke="#c0b59f" strokeWidth="2"/><path d="M-7-13l6 15 13-6M-1 2l5 12M-12 7l11-5" fill="none" stroke="#b4a995" strokeWidth="2"/></g>
          <text ref={label} x="27" y="333" fill="#dbceb7" fontFamily="monospace" fontSize="13">lecture-notes.pdf</text>
          <text x="217" y="269" fill="#b0bfaa" fontFamily="monospace" fontSize="10">CRUMPLE. LOAD. LAUNCH.</text>
          <text x="536" y="76" fill="#edcf95" fontFamily="monospace" fontSize="13">A NEW HOME</text>
          <text x="470" y="333" fill="#967592" fontFamily="Georgia,serif" fontStyle="italic" fontSize="58" transform="rotate(-9 470 333)">SWISH!</text>
        </svg>
        <div className="art-steps"><span>01 / PICK</span><span>02 / AIM</span><span>03 / ORGANIZE</span></div>
      </div>
    </div>
    <footer><span>SHOOT FILES. CLEAR CLUTTER.</span><span>LOCAL FILES · GOOGLE CLOUD · GOOD AIM</span></footer>
  </main>;
}
