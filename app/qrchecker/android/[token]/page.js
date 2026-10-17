// app/qrchecker/android/[token]/page.js  (new file)
//
// TESTING ONLY. Phone OMR checker. Opened from Admin -> Exams -> "OMR checker link":
//   http://<computer Wi-Fi address>:3000/qrchecker/android/<token>
//
//   1. loads this exam's answer key (GET /api/qrchecker/key, answers saved with the exam)
//   2. "Scan OMR sheet" opens a LIVE full-screen camera (LiveScanner.js): no shutter button, the sheet is
//      read several times a second and the corner squares, tracking points, roll number and marked
//      circles are drawn on the video. When the same result is read twice in a row the screen closes itself.
//   3. the list shows  roll number + marks.  A sheet with several pages is finished after every page is scanned.
//
// A live camera needs https:// (or localhost). On plain http:// the live screen explains the fix and the
// "take a photo instead" / gallery buttons below still work through the phone's own camera app.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import s from "./qrchecker.module.css";
import { STYLES, buildLayout } from "@/lib/omr/layout";
import { loadPhoto, scanSheet, drawOverlay, ScanError } from "@/lib/omr/scan";
import LiveScanner from "./LiveScanner";

const storeKey = (token) => `qrchecker:results:${String(token).slice(-16)}`;

function score(key, pages) {
  let marks = 0, correct = 0, wrong = 0, skipped = 0;
  const byQ = new Map();
  Object.values(pages).forEach((list) => list.forEach((a) => byQ.set(a.q, a)));
  key.forEach((k) => {
    const a = byQ.get(k.q);
    if (!a || !a.letter) { skipped++; return; }
    if (k.a && a.letter === k.a) { correct++; marks += k.m; } else wrong++;
  });
  return { marks, correct, wrong, skipped };
}

export default function QrCheckerPage() {
  const { token } = useParams();
  const [exam, setExam] = useState({ status: "loading", error: "", data: null });
  const [styleId, setStyleId] = useState("standard");
  const [options, setOptions] = useState(4);
  const [results, setResults] = useState([]);
  const [pending, setPending] = useState(null); // { roll, pages: { [pageNo]: answers[] } }
  const pendingRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [msg, setMsg] = useState({ kind: "", text: "" });
  const [last, setLast] = useState(null);
  const camRef = useRef(null);
  const galRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    document.title = "OMR checker";
    let alive = true;
    fetch(`/api/qrchecker/key?t=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not load the answer key.");
        if (alive) setExam({ status: "ready", error: "", data });
      })
      .catch((e) => { if (alive) setExam({ status: "error", error: e.message || "Could not load the answer key.", data: null }); });
    try { const saved = JSON.parse(localStorage.getItem(storeKey(token)) || "[]"); if (Array.isArray(saved)) setResults(saved); } catch { /* ignore */ }
    return () => { alive = false; };
  }, [token]);

  const saveResults = useCallback((list) => {
    setResults(list);
    try { localStorage.setItem(storeKey(token), JSON.stringify(list)); } catch { /* ignore */ }
  }, [token]);

  const total = exam.data?.total || 0;
  const layout = useMemo(() => (total ? buildLayout({ total, options, style: styleId, letters: "header" }) : null), [total, options, styleId]);
  const pageCount = layout?.pages.length || 1;

  const finish = (p) => {
    const sc = score(exam.data.key, p.pages);
    saveResults([{ id: Date.now(), roll: p.roll.text, rollOk: p.roll.valid, ...sc, totalMarks: exam.data.totalMarks, pagesRead: Object.keys(p.pages).length, pageCount }, ...results]);
    pendingRef.current = null;
    setPending(null);
    setMsg({ kind: "ok", text: `Roll ${p.roll.text}: ${sc.marks} / ${exam.data.totalMarks} marks.` });
  };

  // Shared by the live scanner and the photo scanner. Throws ScanError for a page scanned out of order.
  const applyResult = (r, photo) => {
    setLast({ pageNo: r.pageNo, roll: r.roll?.text || "", trackers: r.trackers });
    requestAnimationFrame(() => { if (overlayRef.current) drawOverlay(overlayRef.current, photo, r); });

    let cur = pendingRef.current;
    if (r.pageNo === 1) {
      cur = { roll: r.roll, pages: { 1: r.answers } };
    } else if (!cur) {
      throw new ScanError(`That was page ${r.pageNo}. Scan page 1 first - it carries the roll number.`);
    } else {
      cur = { ...cur, pages: { ...cur.pages, [r.pageNo]: r.answers } };
    }
    pendingRef.current = cur;
    setPending(cur);
    if (Object.keys(cur.pages).length >= pageCount) finish(cur);
    else {
      const missing = Array.from({ length: pageCount }, (_, i) => i + 1).filter((n) => !cur.pages[n]);
      setMsg({ kind: "info", text: `Roll ${cur.roll.text}: page ${r.pageNo} read. Now scan page ${missing[0]} of ${pageCount}.` });
    }
  };

  const onPhoto = async (file) => {
    if (!file || !layout) return;
    setBusy(true);
    setMsg({ kind: "", text: "" });
    await new Promise((r) => setTimeout(r, 30)); // let "Reading..." paint first
    try {
      const photo = await loadPhoto(file);
      applyResult(scanSheet(photo, layout), photo);
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof ScanError ? e.message : "Could not read that photo. Try again with the whole sheet in view." });
    } finally {
      setBusy(false);
    }
  };

  const onLiveDone = (r, snap) => {
    setLive(false);
    setMsg({ kind: "", text: "" });
    try { applyResult(r, snap); } catch (e) { setMsg({ kind: "err", text: e?.message || "Could not use that scan." }); }
  };
  const liveReject = (r) => (r.pageNo !== 1 && !pendingRef.current ? `That is page ${r.pageNo} - scan page 1 first (roll number)` : "");

  const pick = (e) => { const f = e.target.files?.[0]; e.target.value = ""; onPhoto(f); };
  const finishEarly = () => { if (pending) finish(pending); };
  const removeOne = (id) => saveResults(results.filter((x) => x.id !== id));
  const clearAll = () => { if (window.confirm("Clear the whole list?")) saveResults([]); };

  return (
    <main className={s.wrap}>
      <header className={s.head}>
        <span className={s.badge}>TEST</span>
        <div>
          <h1 className={s.title}>OMR checker</h1>
          <p className={s.sub}>
            {exam.status === "ready" ? `${exam.data.name || "Exam"}${exam.data.exam ? ` \u00b7 ${exam.data.exam}` : ""} \u00b7 ${exam.data.total} questions \u00b7 ${exam.data.totalMarks} marks` : "Loading exam\u2026"}
          </p>
        </div>
      </header>

      {live && layout && (
        <LiveScanner
          layout={layout}
          reject={liveReject}
          onConfirmed={onLiveDone}
          onClose={() => setLive(false)}
          onFallback={() => { setLive(false); camRef.current?.click(); }}
        />
      )}

      {exam.status === "error" && <p className={`${s.box} ${s.err}`}>{exam.error}</p>}

      {exam.status === "ready" && (
        <>
          <section className={s.card}>
            <button type="button" className={s.scanBtn} disabled={busy} onClick={() => { setMsg({ kind: "", text: "" }); setLive(true); }}>
              {busy ? "Reading the photo\u2026" : pending ? `Scan next page` : "Scan OMR sheet"}
            </button>
            <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
            <input ref={galRef} type="file" accept="image/*" hidden onChange={pick} />
            <div className={s.altRow}>
              <button type="button" className={s.linkBtn} disabled={busy} onClick={() => camRef.current?.click()}>take a photo instead</button>
              <button type="button" className={s.linkBtn} disabled={busy} onClick={() => galRef.current?.click()}>choose from gallery</button>
            </div>

            <p className={s.tip}>Opens a live camera - just hold the phone over the sheet with all four black corner squares visible, flat and well lit. It closes by itself when the result is confirmed.{pageCount > 1 ? ` This sheet has ${pageCount} pages: scan page 1 first, then the rest.` : ""}</p>

            {msg.text && <p className={`${s.box} ${msg.kind === "err" ? s.err : msg.kind === "ok" ? s.ok : s.info}`}>{msg.text}</p>}

            {pending && (
              <div className={s.pending}>
                <span>Roll {pending.roll.text} &middot; {Object.keys(pending.pages).length} of {pageCount} pages</span>
                <button type="button" className={s.smallBtn} onClick={finishEarly}>Finish now</button>
              </div>
            )}

            <details className={s.settings}>
              <summary>Sheet settings</summary>
              <p className={s.tip}>Must match how the OMR sheet was generated (defaults: Standard, 4 options).</p>
              <div className={s.setRow}>
                <label>Style
                  <select value={styleId} onChange={(e) => setStyleId(e.target.value)}>
                    {Object.values(STYLES).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                  </select>
                </label>
                <label>Options
                  <select value={options} onChange={(e) => setOptions(Number(e.target.value))}>
                    <option value={4}>4 (A-D)</option>
                    <option value={5}>5 (A-E)</option>
                  </select>
                </label>
              </div>
            </details>
          </section>

          <section className={s.card}>
            <div className={s.listHead}>
              <h2 className={s.h2}>Checked sheets ({results.length})</h2>
              {results.length > 0 && <button type="button" className={s.linkBtn} onClick={clearAll}>Clear</button>}
            </div>
            {results.length === 0 ? (
              <p className={s.tip}>Nothing scanned yet.</p>
            ) : (
              <table className={s.table}>
                <thead><tr><th>Roll no.</th><th>Marks</th><th /></tr></thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.id}>
                      <td className={s.roll}>{r.roll}{!r.rollOk && <span className={s.warn} title="Roll number not clearly shaded"> check</span>}</td>
                      <td>
                        <b>{r.marks}</b> / {r.totalMarks}
                        <div className={s.mini}>{r.correct} right &middot; {r.wrong} wrong &middot; {r.skipped} blank{r.pagesRead < r.pageCount ? ` \u00b7 ${r.pagesRead}/${r.pageCount} pages` : ""}</div>
                      </td>
                      <td><button type="button" className={s.x} aria-label={`Remove roll ${r.roll}`} onClick={() => removeOne(r.id)}>{"\u00d7"}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {last && (
            <section className={s.card}>
              <h2 className={s.h2}>Last scan: page {last.pageNo}{last.roll ? ` \u00b7 roll ${last.roll}` : ""}</h2>
              <p className={s.tip}>Green = option the scanner read, red = more than one mark, blue = corner squares. If these are off, retake the photo.</p>
              <canvas ref={overlayRef} className={s.overlay} />
            </section>
          )}
        </>
      )}
    </main>
  );
}
