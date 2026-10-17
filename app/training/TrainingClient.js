'use client';

// 📂 SAVE THIS FILE AT: app/training/TrainingClient.js   (REPLACE the existing file)
//
// Training space, rendered inside the dashboard (app/dashboard/training/[[...mode]]/page.js).
//   /dashboard/training            home: pick SpeedRun or FreeFlow (no setup form here)
//   /dashboard/training/speedrun   2 min per question (3 min Maths), auto-submitted, one-way
//   /dashboard/training/freeflow   no limit, stopwatch on the question you are viewing
// The practice itself runs on the normal exam engine (/exam.html) and finishes on the normal
// review / solutions pages. This file handles: choosing subjects / chapters / question count,
// resuming an unfinished session, and listing earlier attempts of the current mode.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import styles from './training.module.css';

const MODES = {
  speedrun: {
    label: 'SpeedRun',
    icon: '⚡',
    tagline: 'Beat the clock on every question.',
    rules: ['2 minutes per question (3 minutes for Maths)', 'When the timer ends, your answer is submitted automatically and the next question opens', 'One-way only: no going back to earlier questions'],
  },
  freeflow: {
    label: 'FreeFlow',
    icon: '∞',
    tagline: 'Take all the time you need.',
    rules: ['No time limit', 'A stopwatch shows how long you spend on the question you are viewing', 'Switch questions freely: each question remembers its time and continues when you return'],
  },
};
const modeLabel = (m) => MODES[m]?.label || 'Training';

const COUNT_OPTIONS = [10, 20, 30, 50, 100];

function formatDuration(ms) {
  const seconds = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  if (minutes < 60) return rem ? `${minutes}m ${rem}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
function formatWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
const fmtMarks = (n) => (n == null ? '—' : Number.isInteger(Number(n)) ? String(Number(n)) : Number(n).toFixed(1));

function Icon({ children, className = '' }) {
  return <svg className={`${styles.icon} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

export default function TrainingClient() {
  const params = useParams();
  const rawMode = Array.isArray(params?.mode) ? params.mode[0] : params?.mode;
  const mode = MODES[rawMode] ? rawMode : null;   // null = training home

  const [tab, setTab] = useState('new');
  const [catalog, setCatalog] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [selectedChapters, setSelectedChapters] = useState([]);
  const [count, setCount] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [history, setHistory] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [nextBefore, setNextBefore] = useState(null);
  const [openChapters, setOpenChapters] = useState({});

  const visibleSubjects = useMemo(() => catalog.filter((s) => selectedSubjects.includes(s.name)), [catalog, selectedSubjects]);
  const selectedCount = selectedChapters.length;
  const availableQuestions = useMemo(() => {
    const map = new Map();
    catalog.forEach((s) => s.chapters.forEach((c) => map.set(c.id, c.question_count)));
    return selectedChapters.reduce((n, id) => n + (map.get(id) || 0), 0);
  }, [catalog, selectedChapters]);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError('');
    try {
      const response = await fetch('/api/training/catalog', { credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load subjects and chapters.');
      setCatalog(Array.isArray(data.subjects) ? data.subjects : []);
      setActiveSession(data.active_session || null);
    } catch (err) {
      setCatalogError(err.message || 'Could not load subjects and chapters.');
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async (before) => {
    if (!mode) return;
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const qs = new URLSearchParams({ mode });
      if (before) qs.set('before', before);
      const url = `/api/training/history?${qs.toString()}`;
      const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load your earlier attempts.');
      setHistory((current) => (before ? [...current, ...(data.sessions || [])] : (data.sessions || [])));
      setNextBefore(data.next_before || null);
      setHistoryLoaded(true);
    } catch (err) {
      setHistoryError(err.message || 'Could not load your earlier attempts.');
    } finally {
      setHistoryLoading(false);
    }
  }, [mode]);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);
  // Each mode has its own attempts list: reset when switching SpeedRun <-> FreeFlow.
  useEffect(() => {
    setTab('new');
    setHistory([]);
    setHistoryLoaded(false);
    setHistoryError('');
    setNextBefore(null);
    setError('');
  }, [mode]);
  useEffect(() => { if (tab === 'history' && !historyLoaded && !historyLoading) loadHistory(null); }, [tab, historyLoaded, historyLoading, loadHistory]);

  const toggleSubject = (subject) => {
    setSelectedSubjects((current) => {
      if (current.includes(subject)) {
        const removedIds = catalog.find((s) => s.name === subject)?.chapters.map((c) => c.id) || [];
        setSelectedChapters((ids) => ids.filter((id) => !removedIds.includes(id)));
        return current.filter((name) => name !== subject);
      }
      return [...current, subject];
    });
  };
  const toggleChapter = (id) => setSelectedChapters((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  const toggleAll = (subject) => {
    const ids = subject.chapters.map((c) => c.id);
    const allSelected = ids.every((id) => selectedChapters.includes(id));
    setSelectedChapters((current) => (allSelected ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])]));
  };

  const startTraining = async () => {
    if (busy || !selectedChapters.length || !mode) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/training/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ chapter_ids: selectedChapters, count, mode }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.error || 'Could not start training.');
      // Hand over to the normal exam engine.
      window.location.href = data.url;
    } catch (err) {
      setError(err.message || 'Could not start training.');
      setBusy(false);
    }
  };

  const activeNote = activeSession && <div className={styles.resumeBox}>
    <div>
      <strong>You have an unfinished {modeLabel(activeSession.mode)} session</strong>
      <span>{activeSession.question_count} questions{activeSession.subjects?.length ? ` · ${activeSession.subjects.join(', ')}` : ''} · started {formatWhen(activeSession.started_at)}. Starting a new one replaces it.</span>
    </div>
    <a className={styles.btnPrimary} href={`/exam.html?token=${encodeURIComponent(activeSession.token)}`}>Resume</a>
  </div>;

  // ---------------- Training home: just the two sections ----------------
  if (!mode) {
    return (
      <main className={styles.root}>
        <div className={styles.container}>
          <section className={styles.hero}>
            <h1>Training</h1>
            <p>Practise random questions from the chapters you pick, in the same exam screen you already know. Choose how you want to practise.</p>
          </section>
          {activeNote}
          <div className={styles.modeGrid}>
            {Object.entries(MODES).map(([key, m]) => (
              <Link key={key} href={`/dashboard/training/${key}`} className={`${styles.modeCard} ${key === 'speedrun' ? styles.modeSpeed : styles.modeFree}`}>
                <span className={styles.modeIcon} aria-hidden="true">{m.icon}</span>
                <h2>{m.label}</h2>
                <p className={styles.modeTag}>{m.tagline}</p>
                <ul>{m.rules.map((r) => <li key={r}>{r}</li>)}</ul>
                <span className={styles.modeGo}>Open {m.label} →</span>
              </Link>
            ))}
            <Link href="/dashboard/training/ultimate" className={styles.modeCard} style={{ gridColumn: '1 / -1' }}>
              <span className={styles.modeIcon} aria-hidden="true" style={{ background: 'linear-gradient(135deg, #6d28d9, #2563eb)' }}>♾</span>
              <h2>Ultimate Practice</h2>
              <p className={styles.modeTag}>Endless questions. Instant answers.</p>
              <ul>
                <li>Pick chapters and keep going: a new question appears the moment you submit, with no limit</li>
                <li>The right option and the full solution show right under the question</li>
                <li>No history is kept, only your accuracy per chapter, per subject and overall</li>
              </ul>
              <span className={styles.modeGo}>Open Ultimate Practice →</span>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const modeInfo = MODES[mode];

  return (
    <main className={styles.root}>
      <div className={styles.container}>
        {error && <div className={styles.errorBar} role="alert">{error}</div>}

        <section className={styles.hero}>
          <h1>{modeInfo.icon} {modeInfo.label}</h1>
          <p>{modeInfo.tagline} {modeInfo.rules[0]}.</p>
        </section>
        <ul className={styles.ruleList}>{modeInfo.rules.map((r) => <li key={r}>{r}</li>)}</ul>

        <div className={styles.tabs} role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'new'} className={`${styles.tab} ${tab === 'new' ? styles.tabOn : ''}`} onClick={() => setTab('new')}>New practice</button>
          <button type="button" role="tab" aria-selected={tab === 'history'} className={`${styles.tab} ${tab === 'history' ? styles.tabOn : ''}`} onClick={() => setTab('history')}>My attempts</button>
        </div>

        {tab === 'new' && <>
          {activeNote}

          {catalogLoading ? <div className={styles.centerNote}><span className={styles.spinner} /> Loading subjects and chapters…</div>
            : catalogError ? <div className={styles.errorBox}><p>{catalogError}</p><button className={styles.btnPrimary} onClick={loadCatalog}>Try again</button></div>
            : catalog.length === 0 ? <div className={styles.errorBox}>No usable single-correct MCQ questions are available for training yet.</div>
            : <>
              <div className={styles.stepTitle}><span>1</span> Choose subjects</div>
              <p className={styles.hint}>Select one or more subjects. You can mix chapters from different subjects.</p>
              <div className={styles.chips}>
                {catalog.map((subject) => <button key={subject.name} type="button" aria-pressed={selectedSubjects.includes(subject.name)} onClick={() => toggleSubject(subject.name)} className={`${styles.chip} ${selectedSubjects.includes(subject.name) ? styles.chipOn : ''}`}>
                  {subject.name}<em>{subject.chapters.length} chapters</em>
                </button>)}
              </div>

              {visibleSubjects.length > 0 && <>
                <div className={styles.stepTitle}><span>2</span> Choose chapters</div>
                <p className={styles.hint}>Questions are randomly mixed from the chapters you select.</p>
                {visibleSubjects.map((subject) => {
                  const all = subject.chapters.every((c) => selectedChapters.includes(c.id));
                  return <section className={styles.subjectCard} key={subject.name}>
                    <div className={styles.subjectHead}>
                      <div><h3>{subject.name}</h3><span>{subject.chapters.length} chapters · {subject.chapters.reduce((n, c) => n + c.question_count, 0)} questions</span></div>
                      <div className={styles.subjectBtns}><button type="button" className={styles.btnGhost} onClick={() => toggleAll(subject)}>{all ? 'Deselect all' : 'Select all'}</button></div>
                    </div>
                    <ul className={styles.chapterList}>{subject.chapters.map((chapter) => <li key={chapter.id}>
                      <label className={`${styles.chapterRow} ${selectedChapters.includes(chapter.id) ? styles.chapterOn : ''}`}>
                        <input type="checkbox" checked={selectedChapters.includes(chapter.id)} onChange={() => toggleChapter(chapter.id)} />
                        <span className={styles.chapterName}>{chapter.name}</span>
                        {chapter.standard && <span className={styles.std}>{chapter.standard}</span>}
                        <span className={styles.qCount}>{chapter.question_count} questions</span>
                      </label>
                    </li>)}</ul>
                  </section>;
                })}
              </>}

              <div className={styles.stepTitle}><span>3</span> How many questions?</div>
              <div className={styles.chips}>
                {COUNT_OPTIONS.map((n) => <button key={n} type="button" aria-pressed={count === n} onClick={() => setCount(n)} className={`${styles.chip} ${count === n ? styles.chipOn : ''}`}>{n}</button>)}
              </div>
              {selectedCount > 0 && availableQuestions < count && <p className={styles.hint}>Your chapters only have {availableQuestions} questions, so that is how many you will get.</p>}

              <div className={styles.summaryActions}>
                <button type="button" className={styles.btnPrimary} disabled={!selectedCount || busy} onClick={startTraining}>
                  {busy ? 'Preparing your questions…' : `Start ${modeInfo.label}${selectedCount ? ` · ${selectedCount} chapter${selectedCount === 1 ? '' : 's'}` : ''}`}
                </button>
              </div>
            </>}
        </>}

        {tab === 'history' && <>
          {historyError && <div className={styles.errorBox}><p>{historyError}</p><button className={styles.btnPrimary} onClick={() => loadHistory(null)}>Try again</button></div>}
          {!historyError && !historyLoaded && historyLoading && <div className={styles.centerNote}><span className={styles.spinner} /> Loading your attempts…</div>}
          {!historyError && historyLoaded && history.length === 0 && <div className={styles.errorBox}>You have not finished a {modeInfo.label} session yet. Your attempts will appear here.</div>}
          <div className={styles.histList}>
            {history.map((s) => {
              const isOpen = !!openChapters[s.token];
              return <section className={styles.histCard} key={s.token}>
                <div className={styles.histTop}>
                  <div>
                    <div className={styles.histTitle}>{(s.subjects || []).join(' + ') || 'Training session'}</div>
                    <div className={styles.histMeta}>{formatWhen(s.ended_at)} · {s.question_count} questions · {formatDuration(s.total_time_ms)}</div>
                  </div>
                  <div className={styles.histScore}><strong>{fmtMarks(s.marks_obtained)}</strong><span>/ {fmtMarks(s.marks_total)}</span></div>
                </div>
                <div className={styles.pills}>
                  <span className={`${styles.pill} ${styles.pillOk}`}>{s.correct} correct</span>
                  <span className={`${styles.pill} ${styles.pillBad}`}>{s.wrong} wrong</span>
                  <span className={`${styles.pill} ${styles.pillWarn}`}>{s.unanswered} unanswered</span>
                </div>
                {(s.chapter_stats || []).length > 0 && <>
                  <button type="button" className={styles.linkBtn} aria-expanded={isOpen} onClick={() => setOpenChapters((cur) => ({ ...cur, [s.token]: !cur[s.token] }))}>
                    {isOpen ? 'Hide chapter breakdown' : `Chapter breakdown (${s.chapter_stats.length})`}
                  </button>
                  {isOpen && <div className={styles.tableWrap}><table className={styles.table}>
                    <thead><tr><th>Chapter</th><th>Correct</th><th>Wrong</th><th>Unanswered</th></tr></thead>
                    <tbody>{s.chapter_stats.map((c) => <tr key={c.chapter_id}>
                      <td>{c.chapter_name}<small>{c.subject}</small></td><td>{c.correct}</td><td>{c.wrong}</td><td>{c.unanswered}</td>
                    </tr>)}</tbody>
                  </table></div>}
                </>}
                <div className={styles.histActions}>
                  <a className={styles.btnPrimary} href={`/review.html?token=${encodeURIComponent(s.token)}`}>Review answers &amp; solutions</a>
                </div>
              </section>;
            })}
          </div>
          {nextBefore && <div className={styles.summaryActions}><button type="button" className={styles.btnGhost} disabled={historyLoading} onClick={() => loadHistory(nextBefore)}>{historyLoading ? 'Loading…' : 'Load older attempts'}</button></div>}
        </>}
      </div>
    </main>
  );
}
