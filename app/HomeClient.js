'use client';
import { useEffect, useRef, useState } from 'react';
import styles from './home.module.css';

const brands = [
  { name: 'Aarambh Science Academy', mark: 'A', accent: '#3459dc' },
  { name: 'Vidyadeep Classes', mark: 'V', accent: '#e0782f' },
  { name: 'Kshitij Chemistry Hub', mark: 'K', accent: '#1fa971' },
  { name: 'Shreyas Institute', mark: 'S', accent: '#c2417a' },
];

/* Reveals [data-reveal] blocks once, so their CSS animations start when scrolled into view */
export function MotionInit() {
  useEffect(() => {
    document.documentElement.dataset.motion = 'on';
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.setAttribute('data-in', ''); io.unobserve(e.target); }
    }), { threshold: 0.25 });
    document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
    return () => { io.disconnect(); delete document.documentElement.dataset.motion; };
  }, []);
  return null;
}

/* Hero card that re-brands itself, to show the white-label idea */
export function BrandPreview() {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % brands.length), 3200);
    return () => clearInterval(t);
  }, [auto]);
  const b = brands[i];
  return (
    <div className={styles.heroVisual} style={{ '--accent': b.accent }} aria-label="Preview of an institute's branded exam dashboard">
      <div className={`${styles.orbit} ${styles.orbitOne}`} />
      <div className={`${styles.orbit} ${styles.orbitTwo}`} />
      <div className={styles.previewCard}>
        <div className={styles.previewTop}>
          <div className={styles.previewBrand}>
            <b className={styles.brandBadge}>{b.mark}</b>
            <div key={i} className={styles.brandSwap}><strong>{b.name}</strong><span>Teacher dashboard</span></div>
          </div>
          <span className={styles.liveTag}><span /> YOUR BRAND</span>
        </div>
        <div className={styles.previewGreeting}>Your exams, under your name <span>✦</span></div>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}><span>Question bank</span><strong>40,000+</strong><small>MHT-CET questions</small></div>
          <div className={styles.statCard}><span>Exam formats</span><strong>Online + OMR</strong><small>Plus printable PDFs</small></div>
        </div>
        <div className={styles.previewSectionHead}><strong>Run your institute</strong><span>One platform →</span></div>
        <div className={styles.toolGrid}>
          <div className={styles.toolCard}><span className={`${styles.toolIcon} ${styles.purple}`}>▤</span><strong>Create papers</strong><small>Choose your questions</small></div>
          <div className={styles.toolCard}><span className={`${styles.toolIcon} ${styles.orange}`}>◷</span><strong>Schedule exams</strong><small>Pick date and time</small></div>
          <div className={styles.toolCard}><span className={`${styles.toolIcon} ${styles.green}`}>▣</span><strong>Scan OMR sheets</strong><small>Checked automatically</small></div>
          <div className={styles.toolCard}><span className={`${styles.toolIcon} ${styles.blue}`}>↗</span><strong>Student reports</strong><small>Chapter-wise accuracy</small></div>
        </div>
        <div className={styles.previewBottom}><span className={styles.sparkle}>✦</span><span><strong>Unit test 3 is scheduled</strong><small>Saturday, 10:00 AM</small></span><span className={styles.bottomArrow}>↗</span></div>
      </div>
      <div className={styles.floatingNote}><b className={styles.brandBadge}>{b.mark}</b><span><strong>Your logo. Your colours.</strong><small>No Parikshiq branding.</small></span></div>
      <div className={styles.brandDots} role="tablist" aria-label="Sample institutes">
        {brands.map((x, k) => <button key={x.name} aria-label={x.name} aria-current={k === i} onClick={() => { setI(k); setAuto(false); }} />)}
      </div>
    </div>
  );
}

const bubbleRows = [1, 3, 0, 2, 1];
const Bubbles = () => (
  <div className={styles.bub}>
    {bubbleRows.map((a, r) => <p key={r}>{[0, 1, 2, 3].map((c) => <i key={c} data-f={a === c || undefined} style={{ '--k': r }} />)}</p>)}
  </div>
);

const art = {
  paper: () => <div className={styles.aPaper}>{[0, 1, 2, 3].map((k) => <p key={k} style={{ '--k': k }}><i /><u /></p>)}</div>,
  cal: () => (
    <div className={styles.aCal}>
      <div>{Array.from({ length: 21 }, (_, k) => <i key={k} data-on={k === 16 || undefined} />)}</div>
      <b className={styles.chip}>Sat · 10:00 AM</b>
    </div>
  ),
  test: () => (
    <div className={styles.aPhone}>
      <small>Q 7 of 30 <em>12:40</em></small>
      {['A', 'B', 'C', 'D'].map((o) => <p key={o} data-pick={o === 'C' || undefined}>{o}</p>)}
    </div>
  ),
  omr: () => <div className={styles.aOmr}><Bubbles /></div>,
  scan: () => (
    <div className={styles.aPhone}><Bubbles /><span className={styles.scanLine} /><b className={`${styles.chip} ${styles.chipRead}`}>✓ Read</b></div>
  ),
  res: () => (
    <div className={styles.aRes}>
      <small>Unit test 3</small>
      {[92, 88, 81].map((v, k) => <p key={v} style={{ '--k': k }}><i>{k + 1}</i><span><b style={{ '--w': `${v}%` }} /></span><em>{v}</em></p>)}
    </div>
  ),
};

const flows = {
  online: [
    { art: 'paper', tone: 'blue', t: 'Build the paper', d: 'Pick questions, set marks and timing in a few clicks.' },
    { art: 'cal', tone: 'violet', t: 'Schedule and deploy', d: 'Choose the date and time. Students see it in their app.' },
    { art: 'test', tone: 'green', t: 'Students take the test', d: 'On their own phones, at the time you set.' },
    { art: 'res', tone: 'green', t: 'Declare results', d: 'Review the marks, then publish them to every student.' },
  ],
  offline: [
    { art: 'paper', tone: 'blue', t: 'Build the paper', d: 'Get the question PDF in your format, plus an OMR sheet for each student.' },
    { art: 'omr', tone: 'violet', t: 'Print on plain A4', d: 'Papers and OMR sheets. Any printer works.' },
    { art: 'scan', tone: 'green', t: 'Scan in the teacher app', d: 'Answers come from the exam you built. No manual checking.' },
    { art: 'res', tone: 'green', t: 'Declare results', d: 'Review the marks, then publish them to every student.' },
  ],
};

export function ExamFlow() {
  const [mode, setMode] = useState('offline');
  return (
    <div data-reveal>
      <div className={styles.flowTabsWrap}>
        <div className={styles.flowTabs} role="tablist" aria-label="Exam type">
          {[['offline', 'Offline exam with OMR'], ['online', 'Online exam']].map(([k, label]) => (
            <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)}>{label}</button>
          ))}
        </div>
      </div>
      <div className={styles.flowCard} key={mode}>
        {flows[mode].map((s, n) => {
          const Art = art[s.art];
          return (
            <div className={styles.flowStep} data-tone={s.tone} style={{ '--s': n }} key={s.t}>
              <div className={styles.flowArt}><Art /></div>
              <span className={styles.flowNum}>0{n + 1}</span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
              {n < 3 && <span className={styles.flowArrow} aria-hidden="true">→</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Student app showcase: phone (mobile app) + laptop (web view) ---------- */
const SHOTS = {
  mobile: [1, 2, 3, 4, 5].map((n) => `/images/mobile_images/image${n}.png`),
  web: [1, 2, 3].map((n) => `/images/website_images/image${n}.png`),
};
/* Session-wide cache: each screenshot is downloaded once, one after another, then reused instantly */
const shotCache = new Map(); // src -> object URL (or null if it failed)
const shotLoaders = {};
function loadShotsSequentially(kind, onEach) {
  if (!shotLoaders[kind]) {
    shotLoaders[kind] = (async () => {
      for (const src of SHOTS[kind]) {
        if (shotCache.has(src)) { onEach(); continue; }
        try {
          const res = await fetch(src);
          if (!res.ok) throw new Error('bad status');
          const url = URL.createObjectURL(await res.blob());
          await new Promise((ok) => { const im = new Image(); im.onload = im.onerror = ok; im.src = url; });
          shotCache.set(src, url);
        } catch { shotCache.set(src, null); }
        onEach();
      }
    })();
  }
  return shotLoaders[kind].then(onEach);
}

function DeviceSlides({ kind, active }) {
  const list = SHOTS[kind];
  const [, bump] = useState(0);
  const [cur, setCur] = useState(0);
  const [prev, setPrev] = useState(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => { if (active) loadShotsSequentially(kind, () => bump((n) => n + 1)); }, [active, kind]);

  const ready = list.filter((s) => shotCache.get(s));
  const idx = ready.length ? cur % ready.length : 0;

  useEffect(() => {
    if (!active || paused || ready.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setTimeout(() => { setPrev(idx); setCur(idx + 1); }, 3200);
    return () => clearTimeout(t);
  }, [active, paused, idx, ready.length]);

  useEffect(() => {
    if (prev === null) return;
    const t = setTimeout(() => setPrev(null), 900);
    return () => clearTimeout(t);
  }, [prev]);

  const go = (i) => { if (i === idx) return; setPrev(idx); setCur(i); };
  const curSrc = ready[idx];
  const prevSrc = prev !== null && ready.length ? ready[prev % ready.length] : null;

  const screen = (
    <>
      {!curSrc && <div className={styles.phoneSkeleton}><i /><i /><i /><i /></div>}
      {prevSrc && <img key={`p${prev}-${prevSrc}`} className={`${styles.shot} ${styles.shotOut}`} src={prevSrc} alt="" draggable="false" />}
      {curSrc && <img key={`c${idx}-${curSrc}`} className={`${styles.shot} ${prevSrc ? styles.shotIn : ''}`} src={curSrc} alt={`Student ${kind === 'web' ? 'website' : 'app'} screen ${idx + 1}`} draggable="false" />}
    </>
  );

  return (
    <div className={styles.deviceWrap} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {kind === 'mobile' ? (
        <div className={styles.phone} role="img" aria-label="Screenshots of the Parikshiq student app">
          <span className={styles.phoneBtn} />
          <div className={styles.phoneScreen}><span className={styles.phoneIsland} />{screen}</div>
        </div>
      ) : (
        <div className={styles.laptop} role="img" aria-label="Screenshots of the Parikshiq student website">
          <div className={styles.laptopLid}>
            <div className={styles.laptopScreen}><span className={styles.laptopCam} />{screen}</div>
          </div>
          <div className={styles.laptopBase}><span /></div>
        </div>
      )}
      <div className={styles.phoneDots}>
        {list.map((s, i) => (
          <button key={s} type="button" aria-label={`Show screen ${i + 1}`} disabled={!shotCache.get(s)}
            data-on={shotCache.get(s) && ready[idx] === s ? '' : undefined}
            onClick={() => { const j = ready.indexOf(s); if (j >= 0) go(j); }} />
        ))}
      </div>
    </div>
  );
}

export function PhoneShowcase() {
  const [view, setView] = useState('mobile');
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.15, rootMargin: '300px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className={styles.phoneStage} ref={ref}>
      <div className={styles.phoneGlow} />
      <div className={styles.viewToggle} role="tablist" aria-label="Choose view">
        <button type="button" role="tab" aria-selected={view === 'mobile'} data-on={view === 'mobile' ? '' : undefined} onClick={() => setView('mobile')}>📱 Mobile app</button>
        <button type="button" role="tab" aria-selected={view === 'web'} data-on={view === 'web' ? '' : undefined} onClick={() => setView('web')}>💻 Web view</button>
      </div>
      <div className={styles.deviceSwap} key={view}>
        <span className={`${styles.phoneBadge} ${styles.pbA}`}>{view === 'mobile' ? '📝 Mock test · 10:30 AM' : '🌐 Your institute’s name'}</span>
        <span className={`${styles.phoneBadge} ${styles.pbB}`}>📊 Chapter report ready</span>
        <DeviceSlides kind={view} active={visible} />
      </div>
    </div>
  );
}
