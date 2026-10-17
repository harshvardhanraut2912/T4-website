'use client';

// 📂 SAVE AT: app/training/UltimateClient.js   (NEW FILE)
//
// /dashboard/training/ultimate
//   Practice tab     : choose subjects + chapters, then Start -> opens /exam-ultimate.html
//   My accuracy tab  : chapter-wise, subject-wise and overall accuracy (overall = mean of the
//                      subject accuracies). There is no attempt history for Ultimate Practice.

import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './training.module.css';
import ux from './ultimate.module.css';

const tone = (a) => (a === null || a === undefined ? '' : a >= 70 ? 'good' : a >= 40 ? 'mid' : 'low');
const fill = (a) => (a >= 70 ? ux.fillGood : a >= 40 ? ux.fillMid : ux.fillLow);
const fmtPct = (a) => (a === null || a === undefined ? '—' : `${Number.isInteger(a) ? a : a.toFixed(1)}%`);

function AccBar({ value }) {
  return <div className={ux.bar}><div className={`${ux.barFill} ${fill(value || 0)}`} style={{ width: `${Math.min(100, Math.max(0, value || 0))}%` }} /></div>;
}

export default function UltimateClient() {
  const [tab, setTab] = useState('practice');
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [selectedChapters, setSelectedChapters] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');

  // Landing from the practice page's "End practice" button opens the accuracy tab.
  useEffect(() => {
    try { if (new URLSearchParams(window.location.search).get('tab') === 'accuracy') setTab('accuracy'); } catch {}
  }, []);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError('');
    try {
      const response = await fetch('/api/training/catalog', { credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load subjects and chapters.');
      setCatalog(Array.isArray(data.subjects) ? data.subjects : []);
    } catch (err) {
      setCatalogError(err.message || 'Could not load subjects and chapters.');
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError('');
    try {
      const response = await fetch('/api/ultimate/stats', { credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load your accuracy.');
      setStats(data);
    } catch (err) {
      setStatsError(err.message || 'Could not load your accuracy.');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);
  // Always re-read when the accuracy tab is opened, so numbers are fresh after a sitting.
  useEffect(() => { if (tab === 'accuracy') loadStats(); }, [tab, loadStats]);

  const visibleSubjects = useMemo(() => catalog.filter((s) => selectedSubjects.includes(s.name)), [catalog, selectedSubjects]);
  const availableQuestions = useMemo(() => {
    const map = new Map();
    catalog.forEach((s) => s.chapters.forEach((c) => map.set(c.id, c.question_count)));
    return selectedChapters.reduce((n, id) => n + (map.get(id) || 0), 0);
  }, [catalog, selectedChapters]);

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
  const toggleChapter = (id) => setSelectedChapters((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const toggleAll = (subject) => {
    const ids = subject.chapters.map((c) => c.id);
    const all = ids.every((id) => selectedChapters.includes(id));
    setSelectedChapters((cur) => (all ? cur.filter((id) => !ids.includes(id)) : [...new Set([...cur, ...ids])]));
  };

  const start = async () => {
    if (busy || !selectedChapters.length) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/ultimate/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ chapter_ids: selectedChapters }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.error || 'Could not start Ultimate Practice.');
      window.location.href = data.url;
    } catch (err) {
      setError(err.message || 'Could not start Ultimate Practice.');
      setBusy(false);
    }
  };

  const overall = stats?.overall;
  const hasStats = !!overall && overall.attempted > 0;

  return (
    <main className={styles.root}>
      <div className={styles.container}>
        {error && <div className={styles.errorBar} role="alert">{error}</div>}

        <section className={styles.hero} style={{ background: 'linear-gradient(135deg, #4c1d95 0%, #2563eb 70%, #3b82f6 100%)' }}>
          <h1>♾ Ultimate Practice</h1>
          <p>Endless questions, one at a time. Submit to see the right answer and the solution instantly, then move straight to the next one.</p>
        </section>
        <ul className={styles.ruleList}>
          <li>No limit: keep practising as long as you like</li>
          <li>The correct option, your choice and the solution appear right under each question</li>
          <li>No review page and no history: only your correct / wrong count per chapter is saved, to calculate your accuracy</li>
        </ul>

        <div className={styles.tabs} role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'practice'} className={`${styles.tab} ${tab === 'practice' ? styles.tabOn : ''}`} onClick={() => setTab('practice')}>Practice</button>
          <button type="button" role="tab" aria-selected={tab === 'accuracy'} className={`${styles.tab} ${tab === 'accuracy' ? styles.tabOn : ''}`} onClick={() => setTab('accuracy')}>My accuracy</button>
        </div>

        {tab === 'practice' && (catalogLoading
          ? <div className={styles.centerNote}><span className={styles.spinner} /> Loading subjects and chapters…</div>
          : catalogError
            ? <div className={styles.errorBox}><p>{catalogError}</p><button className={styles.btnPrimary} onClick={loadCatalog}>Try again</button></div>
            : catalog.length === 0
              ? <div className={styles.errorBox}>No usable single-correct MCQ questions are available for practice yet.</div>
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
                  <p className={styles.hint}>Questions are picked at random from the chapters you select.</p>
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

                {selectedChapters.length > 0 && <p className={styles.hint}>{availableQuestions} questions in your selection. When you have seen them all, they simply start again, so you never run out.</p>}

                <div className={styles.summaryActions}>
                  <button type="button" className={styles.btnPrimary} disabled={!selectedChapters.length || busy} onClick={start}>
                    {busy ? 'Preparing your first question…' : `Start Ultimate Practice${selectedChapters.length ? ` · ${selectedChapters.length} chapter${selectedChapters.length === 1 ? '' : 's'}` : ''}`}
                  </button>
                </div>
              </>)}

        {tab === 'accuracy' && <>
          {statsError && <div className={styles.errorBox}><p>{statsError}</p><button className={styles.btnPrimary} onClick={loadStats}>Try again</button></div>}
          {!statsError && statsLoading && !stats && <div className={styles.centerNote}><span className={styles.spinner} /> Loading your accuracy…</div>}
          {!statsError && stats && !hasStats && <div className={styles.errorBox}>You have not answered any Ultimate Practice questions yet. Start practising and your accuracy will appear here.</div>}

          {!statsError && hasStats && <>
            <section className={ux.overall}>
              <div className={ux.ring} style={{ '--p': overall.accuracy || 0, '--ring': (overall.accuracy || 0) >= 70 ? '#22c55e' : (overall.accuracy || 0) >= 40 ? '#f59e0b' : '#ef4444' }}>
                <div className={ux.ringIn}><b>{fmtPct(overall.accuracy)}</b><span>OVERALL</span></div>
              </div>
              <div className={ux.overallText}>
                <h2>Your overall accuracy</h2>
                <p>Average of your {overall.subjects_counted} subject accuracies{overall.subjects_counted === 1 ? '' : ', each subject counting equally'}.</p>
                <div className={ux.miniPills}>
                  <span className={`${styles.pill} ${styles.pillOk}`}>{overall.correct} correct</span>
                  <span className={`${styles.pill} ${styles.pillBad}`}>{overall.wrong} wrong</span>
                  <span className={`${styles.pill} ${styles.pillWarn}`}>{overall.attempted} answered</span>
                </div>
              </div>
            </section>

            {stats.subjects.map((subject) => (
              <section className={ux.subCard} key={subject.name}>
                <div className={ux.subHead}>
                  <div>
                    <h3>{subject.name}</h3>
                    <small>{subject.correct} correct out of {subject.attempted} · {subject.chapters.length} chapter{subject.chapters.length === 1 ? '' : 's'}</small>
                  </div>
                  <div className={`${ux.subPct} ${ux[tone(subject.accuracy)] || ''}`}>{fmtPct(subject.accuracy)}</div>
                </div>
                <AccBar value={subject.accuracy} />
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead><tr><th>Chapter</th><th>Correct</th><th>Wrong</th><th>Accuracy</th></tr></thead>
                    <tbody>
                      {subject.chapters.map((c) => (
                        <tr key={c.chapter_id}>
                          <td>{c.chapter_name}<small>{c.attempted} answered</small></td>
                          <td>{c.correct}</td>
                          <td>{c.wrong}</td>
                          <td><div className={ux.accCell}><AccBar value={c.accuracy} /><b className={ux[tone(c.accuracy)] || ''}>{fmtPct(c.accuracy)}</b></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
            <p className={ux.note}>Accuracy = correct ÷ (correct + wrong). Skipped questions are not counted.</p>
          </>}
        </>}
      </div>
    </main>
  );
}
