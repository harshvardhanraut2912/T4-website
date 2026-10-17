// app/admin/performance/page.js  (NEW FILE)
//
// Performance -- every student's Ultimate Practice results, exactly as the student sees them under
// "My accuracy": overall, subject-wise and chapter-wise.
//   list   : GET /api/admin/performance
//   detail : GET /api/admin/performance?student=<email>  -> two sections:
//            1. Exam results (marks only, section-wise, per attempt, expandable)
//            2. Ultimate Practice (overall / subject-wise / chapter-wise)
// A real folder, so it wins over the generic placeholder at app/admin/[panel].
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import s from "./performance.module.css";

const avatarUrl = (st) =>
  st.avatar_url ||
  `https://ui-avatars.com/api/?name=${encodeURIComponent(st.full_name || st.email || "Student")}&background=172a85&color=ffffff&size=128`;

// Exam results are fetched in the BACKGROUND and remembered, so a student's page never waits for them.
// Hovering / focusing a row in the list starts the fetch before the row is even clicked.
const examJobs = new Map();
function getExams(email) {
  const hit = examJobs.get(email);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.promise;
  const promise = fetch(`/api/admin/performance?student=${encodeURIComponent(email)}&part=exams`, { credentials: "same-origin", cache: "no-store" })
    .then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not load exam results.");
      return body.exams || [];
    })
    .catch((err) => { examJobs.delete(email); throw err; });
  examJobs.set(email, { at: Date.now(), promise });
  return promise;
}

const warm = (email) => { getExams(email).catch(() => {}); };   // background fetch, errors surface later in the student view

const fmtPct = (v) => (v === null || v === undefined ? "—" : `${v}%`);
const fmtDate = (d) => {
  if (!d) return "—";
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? "—" : x.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};
const tone = (v) => (v === null ? s.muted : v >= 70 ? s.ok : v < 40 ? s.bad : "");
const barColor = (v) => (v === null ? "#c7c7cc" : v >= 70 ? "#34c759" : v >= 40 ? "#ff9500" : "#ff3b30");

function Bar({ value }) {
  return (
    <span className={s.bar} aria-hidden="true">
      <span className={s.barFill} style={{ width: `${value ?? 0}%`, background: barColor(value) }} />
    </span>
  );
}


const fmtMarks = (n) => (n === null || n === undefined ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ""));

function ExamRow({ exam }) {
  const [open, setOpen] = useState(false);
  return (
    <section className={s.subject}>
      <div
        role="button" tabIndex={0} className={s.examHead} aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); } }}
      >
        <span className={s.chev}>{open ? "▾" : "▸"}</span>
        <span className={s.subjectName}>{exam.title}</span>
        <span className={s.subjectMeta}>
          Best <b className={tone(exam.best_percentage)}>{fmtMarks(exam.best_score)} / {fmtMarks(exam.best_max)}</b> ({fmtPct(exam.best_percentage)})
          {" · "}{exam.attempts_count} attempt{exam.attempts_count === 1 ? "" : "s"} · {fmtDate(exam.last_submitted_at)}
        </span>
      </div>
      {open && exam.attempts.map((a) => (
        <div key={a.attempt} className={s.attemptBlock}>
          <div className={s.attemptTitle}>
            Attempt {a.attempt} · {fmtDate(a.submitted_at)} ·{" "}
            <b className={tone(a.percentage)}>{fmtMarks(a.score)} / {fmtMarks(a.max)} ({fmtPct(a.percentage)})</b>
          </div>
          <div className={s.scroll}>
            <table className={s.inner}>
              <thead><tr><th>Section</th><th>Marks</th><th>Correct</th><th>Wrong</th><th>Unanswered</th></tr></thead>
              <tbody>
                {a.sections.map((sec) => (
                  <tr key={sec.name}>
                    <td>{sec.name}</td>
                    <td className={s.num}><b>{fmtMarks(sec.score)}</b> / {fmtMarks(sec.max)}</td>
                    <td className={`${s.num} ${s.ok}`}>{sec.correct}</td>
                    <td className={`${s.num} ${sec.incorrect ? s.bad : ""}`}>{sec.incorrect}</td>
                    <td className={`${s.num} ${s.muted}`}>{sec.unanswered}</td>
                  </tr>
                ))}
                <tr>
                  <td><b>Total</b></td>
                  <td className={s.num}><b>{fmtMarks(a.score)}</b> / {fmtMarks(a.max)}</td>
                  <td className={`${s.num} ${s.ok}`}>{a.sections.reduce((n, x) => n + x.correct, 0)}</td>
                  <td className={`${s.num} ${s.bad}`}>{a.sections.reduce((n, x) => n + x.incorrect, 0)}</td>
                  <td className={`${s.num} ${s.muted}`}>{a.sections.reduce((n, x) => n + x.unanswered, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );
}

function Detail({ student, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [exams, setExams] = useState(null);       // null = still loading in the background
  const [examsError, setExamsError] = useState("");

  const loadUltimate = useCallback(async () => {
    setError(""); setData(null);
    try {
      const res = await fetch(`/api/admin/performance?student=${encodeURIComponent(student.email)}&part=ultimate`, { credentials: "same-origin", cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not load this student's performance.");
      setData(body);
    } catch (e) { setError(e.message || "Could not load this student's performance."); }
  }, [student.email]);

  const loadExams = useCallback(() => {
    setExamsError(""); setExams(null);
    getExams(student.email).then(setExams).catch((e) => setExamsError(e.message || "Could not load exam results."));
  }, [student.email]);

  useEffect(() => { loadUltimate(); loadExams(); }, [loadUltimate, loadExams]);

  const info = student;
  const o = data?.overall;

  return (
    <>
      <button className={`${s.btn} ${s.btnGhost} ${s.back}`} onClick={onBack}>← All students</button>
      <div className={s.who}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={s.whoAvatar} src={avatarUrl(info)} alt="" />
        <div>
          <h2 className={s.whoName}>{info.full_name || info.email}</h2>
          <p className={s.whoSub}>{[info.username, info.email, info.current_class].filter(Boolean).join(" · ")}</p>
        </div>
      </div>

      <h2 className={s.sectionTitle}>1. Exam results</h2>
      {examsError && <div className={s.err}>{examsError} <button className={s.btn} onClick={loadExams}>Try again</button></div>}
      {!exams && !examsError && <div className={s.loading}>Loading exam results…</div>}
      {exams && !exams.length && <div className={s.loading}>This student hasn’t submitted any exam yet.</div>}
      {(exams || []).map((ex) => <ExamRow key={ex.test_id} exam={ex} />)}

      <h2 className={s.sectionTitle}>2. Ultimate Practice</h2>
      {error && <div className={s.err}>{error} <button className={s.btn} onClick={loadUltimate}>Try again</button></div>}
      {!data && !error && <div className={s.loading}>Loading performance…</div>}

      {data && (
        <>
          <div className={s.cards}>
            <div className={s.card}><div className={s.cardLabel}>Overall accuracy</div><div className={`${s.cardValue} ${tone(o.accuracy)}`}>{fmtPct(o.accuracy)}</div></div>
            <div className={s.card}><div className={s.cardLabel}>Attempted</div><div className={s.cardValue}>{o.attempted}</div></div>
            <div className={s.card}><div className={s.cardLabel}>Correct</div><div className={`${s.cardValue} ${s.ok}`}>{o.correct}</div></div>
            <div className={s.card}><div className={s.cardLabel}>Wrong</div><div className={`${s.cardValue} ${o.wrong ? s.bad : ""}`}>{o.wrong}</div></div>
            <div className={s.card}><div className={s.cardLabel}>Chapters practised</div><div className={s.cardValue}>{o.chapters_practised}</div></div>
            <div className={s.card}><div className={s.cardLabel}>Last practice</div><div className={s.cardValue} style={{ fontSize: 15 }}>{fmtDate(data.last_practice)}</div></div>
          </div>

          {!data.subjects.length && <div className={s.loading}>This student hasn’t practised in Ultimate yet.</div>}

          {data.subjects.map((sub) => (
            <section key={sub.name} className={s.subject}>
              <div className={s.subjectHead}>
                <span className={s.subjectName}>{sub.name}</span>
                <span className={s.subjectMeta}>
                  <Bar value={sub.accuracy} />
                  <b className={tone(sub.accuracy)}>{fmtPct(sub.accuracy)}</b> · {sub.correct} correct · {sub.wrong} wrong · {sub.attempted} attempted
                </span>
              </div>
              <div className={s.scroll}>
                <table className={s.inner}>
                  <thead><tr><th>Chapter</th><th>Accuracy</th><th>Correct</th><th>Wrong</th><th>Attempted</th><th>Last practised</th></tr></thead>
                  <tbody>
                    {sub.chapters.map((c) => (
                      <tr key={c.chapter_id}>
                        <td>{c.chapter_name}</td>
                        <td className={s.num}><Bar value={c.accuracy} /><b className={tone(c.accuracy)}>{fmtPct(c.accuracy)}</b></td>
                        <td className={`${s.num} ${s.ok}`}>{c.correct}</td>
                        <td className={`${s.num} ${c.wrong ? s.bad : ""}`}>{c.wrong}</td>
                        <td className={s.num}>{c.attempted}</td>
                        <td className={`${s.num} ${s.muted}`}>{fmtDate(c.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </>
      )}
    </>
  );
}

export default function PerformancePage() {
  const [students, setStudents] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("attempted");
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/admin/performance", { credentials: "same-origin", cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not load performance data.");
      setStudents(body.students || []);
    } catch (e) { setError(e.message || "Could not load performance data."); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = (students || []).filter((st) =>
      !q || [st.full_name, st.username, st.email, st.current_class].some((v) => (v || "").toLowerCase().includes(q)));
    const by = {
      attempted: (a, b) => b.attempted - a.attempted,
      accuracy_high: (a, b) => (b.accuracy ?? -1) - (a.accuracy ?? -1),
      accuracy_low: (a, b) => (a.accuracy ?? 101) - (b.accuracy ?? 101),
      recent: (a, b) => String(b.last_practice || "").localeCompare(String(a.last_practice || "")),
      name: (a, b) => (a.full_name || a.email || "").localeCompare(b.full_name || b.email || ""),
    }[sort];
    return [...list].sort(by);
  }, [students, query, sort]);

  // After the list shows, quietly pre-load the exam results of the first few students.
  // (Runs in the background; the student view then opens with them already there.)
  useEffect(() => {
    if (!students) return undefined;
    const ids = students.filter((st) => st.attempted > 0).slice(0, 8).map((st) => st.email);
    const t = setTimeout(() => ids.forEach(warm), 600);
    return () => clearTimeout(t);
  }, [students]);

  if (open) return <Detail student={open} onBack={() => setOpen(null)} />;

  const active = (students || []).filter((st) => st.attempted > 0).length;

  return (
    <>
      <div className={s.head}>
        <div>
          <h1 className={s.title}>Performance</h1>
          <p className={s.subtitle}>Ultimate Practice results of every student: overall, subject-wise and chapter-wise.</p>
        </div>
      </div>

      <div className={s.toolbar}>
        <input className={s.search} placeholder="Search name, username, email or class" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className={s.select} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort students">
          <option value="attempted">Most questions attempted</option>
          <option value="accuracy_high">Highest accuracy</option>
          <option value="accuracy_low">Lowest accuracy</option>
          <option value="recent">Recently practised</option>
          <option value="name">Name (A–Z)</option>
        </select>
        {students && (
          <div className={s.stats}>
            <span className={s.stat}>Students <b>{students.length}</b></span>
            <span className={s.stat}>Practised <b>{active}</b></span>
          </div>
        )}
      </div>

      {error && <div className={s.err}>{error} <button className={s.btn} onClick={load}>Try again</button></div>}
      {!students && !error && <div className={s.loading}>Loading students…</div>}

      {students && (
        <div className={s.tableWrap}>
          {!shown.length ? (
            <div className={s.empty}>No students match your search.</div>
          ) : (
            <table className={s.table}>
              <thead>
                <tr><th>Student</th><th>Class</th><th>Overall accuracy</th><th>Correct</th><th>Wrong</th><th>Attempted</th><th>Chapters</th><th>Last practice</th></tr>
              </thead>
              <tbody>
                {shown.map((st) => (
                  <tr key={st.email} className={s.row} tabIndex={0} onClick={() => setOpen(st)} onKeyDown={(e) => { if (e.key === "Enter") setOpen(st); }} onMouseEnter={() => warm(st.email)} onFocus={() => warm(st.email)} onTouchStart={() => warm(st.email)}>
                    <td>
                      <div className={s.person}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={avatarUrl(st)} alt="" className={s.avatar} width={40} height={40} loading="lazy" decoding="async" />
                        <div style={{ minWidth: 0 }}>
                          <span className={s.pName} title={st.full_name || ""}>{st.full_name || "-"}</span>
                          <span className={s.pSub}>{st.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className={st.current_class ? "" : s.muted}>{st.current_class || "-"}</td>
                    <td className={s.num}>{st.attempted ? (<><Bar value={st.accuracy} /><b className={tone(st.accuracy)}>{fmtPct(st.accuracy)}</b></>) : <span className={s.muted}>No practice yet</span>}</td>
                    <td className={`${s.num} ${st.correct ? s.ok : s.muted}`}>{st.correct}</td>
                    <td className={`${s.num} ${st.wrong ? s.bad : s.muted}`}>{st.wrong}</td>
                    <td className={s.num}>{st.attempted}</td>
                    <td className={s.num}>{st.chapters_practised}</td>
                    <td className={`${s.num} ${s.muted}`}>{fmtDate(st.last_practice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
