// app/admin/exams/omr/page.js  (new file)
//
// The "Generate OMR sheet" window. Opened from the OMR icon in the Exams table
// (/exams/omr?id=<exam id>&name=<exam name>) as a popup. It has no sidebar (see isPopupPath in
// app/admin/layout.js).
//
//   Step 1  pick a STYLE   (big circles / standard / small circles, with a live preview)
//   Step 2  sheet details  (title, date, number of questions, 4 or 5 options, where the letters go)
//   Result  preview + Download PDF + Print + Download coordinates (.json)
//
// The PDF is drawn in the browser (jsPDF, vector, black and white). The number of questions comes from
// the exam itself (GET /api/admin/exam-pdf?id=..). Every page carries four corner fiducials, repeated
// edge timing boxes, row trackers and a page code. The coordinates JSON is the source of truth for
// the future mobile scanner (that scanner is NOT part of this feature yet).
"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import s from "../exams.module.css";
import o from "./omr.module.css";
import { STYLES, MAX_QUESTIONS, buildLayout, toCoordinates, sheetCode, OPTION_LETTERS } from "@/lib/omr/layout";
import { drawOmrPdf } from "@/lib/omr/drawPdf";

const todayISO = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const fmtDate = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const slug = (t) => String(t || "exam").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "exam";

const LOGOS = [
  { id: "class", label: "Class logo", src: "/images/other_images/class-logo.png" },
];
const LOGO_MAX_PX = 700;

function toLogoDataUrl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w0 = img.naturalWidth || img.width;
      const h0 = img.naturalHeight || img.height;
      if (!w0 || !h0) { reject(new Error("empty")); return; }
      const k = Math.min(1, LOGO_MAX_PX / Math.max(w0, h0));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w0 * k));
      c.height = Math.max(1, Math.round(h0 * k));
      const ctx = c.getContext("2d");
      if (!ctx) { reject(new Error("canvas")); return; }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      try { resolve(c.toDataURL("image/png")); } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error("load"));
    img.src = src;
  });
}

function saveBlobFile(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

function Segmented({ value, onChange, options, label }) {
  return (
    <div className={o.seg} role="radiogroup" aria-label={label}>
      {options.map((x) => (
        <button key={String(x.value)} type="button" role="radio" aria-checked={value === x.value} className={`${o.segBtn} ${value === x.value ? o.segOn : ""}`} onClick={() => onChange(x.value)}>
          {x.label}
        </button>
      ))}
    </div>
  );
}

// A small drawing of the style: 3 questions x 4 options plus a corner marker, scaled so that the
// circle sizes are in the same proportion as on the real sheet.
function StylePreview({ st }) {
  const rows = 3;
  const pitchX = st.optPitch;
  const pitchY = st.rowPitch;
  const w = 8 + 4 * pitchX + 4;
  const h = rows * pitchY + 6;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={o.stylePrev} aria-hidden="true">
      <rect x="0.6" y="0.6" width="4" height="4" fill="#000" />
      {Array.from({ length: rows }).map((_, r) =>
        ["A", "B", "C", "D"].map((L, c) => {
          const cx = 8 + pitchX / 2 + c * pitchX;
          const cy = 6 + pitchY / 2 + r * pitchY - 1;
          return (
            <g key={`${r}-${c}`}>
              <circle cx={cx} cy={cy} r={st.r} fill="#fff" stroke="#000" strokeWidth={st.line * 1.6} />
              {st.letters === "inside" && <text x={cx} y={cy + st.r * 0.38} textAnchor="middle" fontSize={st.r * 1.05} fontFamily="Helvetica,Arial,sans-serif" fill="#000">{L}</text>}
            </g>
          );
        })
      )}
    </svg>
  );
}

function OmrWindow() {
  const params = useSearchParams();
  const examId = params.get("id") || "";
  const examName = params.get("name") || "";

  const [info, setInfo] = useState(() => (examId ? { status: "loading", error: "", data: null } : { status: "error", error: "No exam selected.", data: null }));
  const [step, setStep] = useState("style"); // style | details | result
  const [styleId, setStyleId] = useState("standard");
  const [title, setTitle] = useState(examName);
  const [useCurrent, setUseCurrent] = useState(true);
  const [date, setDate] = useState(todayISO());
  const [qInput, setQInput] = useState(null); // null = follow the exam's question count
  const [options, setOptions] = useState(4);
  const [letters, setLetters] = useState("header"); // scanner-friendly: letters stay outside the fill ROI
  const [logoChoice, setLogoChoice] = useState("class");
  const [logoData, setLogoData] = useState("");
  const [logoName, setLogoName] = useState("");
  const [logoErr, setLogoErr] = useState("");
  const fileRef = useRef(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { pdfBlob, pdfUrl, pdfName, json, jsonName, pages, code }
  const frameRef = useRef(null);
  const urlRef = useRef("");

  useEffect(() => {
    document.title = "Generate OMR sheet";
    if (!examId) return;
    let alive = true;
    fetch(`/api/admin/exam-pdf?id=${encodeURIComponent(examId)}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to load the exam.");
        if (!alive) return;
        setInfo({ status: "ready", error: "", data });
        setTitle((t) => t || data.name || "");
      })
      .catch((e) => { if (alive) setInfo({ status: "error", error: e.message || "Failed to load the exam.", data: null }); });
    return () => { alive = false; };
  }, [examId]);

  useEffect(() => {
    const preset = LOGOS.find((l) => l.id === logoChoice);
    if (!preset) return;
    let alive = true;
    setLogoErr("");
    toLogoDataUrl(preset.src)
      .then((d) => { if (alive) setLogoData(d); })
      .catch(() => { if (alive) { setLogoData(""); setLogoErr("Could not load the class logo. Choose another logo or upload your own."); } });
    return () => { alive = false; };
  }, [logoChoice]);

  const pickNone = () => { setLogoChoice("none"); setLogoData(""); setLogoErr(""); };
  const pickUpload = (file) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) { setLogoErr("Choose an image file (PNG, JPG, WebP or SVG)."); return; }
    const obj = URL.createObjectURL(file);
    toLogoDataUrl(obj)
      .then((d) => { setLogoChoice("upload"); setLogoData(d); setLogoName(file.name); setLogoErr(""); })
      .catch(() => setLogoErr("That picture could not be read. Try a PNG or JPG."))
      .finally(() => URL.revokeObjectURL(obj));
  };

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const st = STYLES[styleId];
  const examTotal = info.data?.total || 0;
  const qText = qInput ?? (examTotal ? String(examTotal) : "");
  const qNum = Math.round(Number(qText));
  const qValid = Number.isFinite(qNum) && qNum >= 1 && qNum <= MAX_QUESTIONS;
  const lettersMode = letters || st.letters;

  // live page count for the chosen settings
  const preview = useMemo(() => {
    if (!qValid) return null;
    return buildLayout({ total: qNum, options, style: styleId, letters: lettersMode });
  }, [qValid, qNum, options, styleId, lettersMode]);

  const generate = async () => {
    setMsg("");
    if (!title.trim()) { setMsg("Enter a title for the OMR sheet."); return; }
    if (!qValid) { setMsg(`Number of questions must be between 1 and ${MAX_QUESTIONS}.`); return; }
    if (!useCurrent && !date) { setMsg("Pick the exam date or choose \u201cUse current date\u201d."); return; }
    setBusy(true);
    try {
      const layout = buildLayout({ total: qNum, options, style: styleId, letters: lettersMode });
      if (!layout.fits) throw new Error("This many questions do not fit on 15 pages with this style. Choose small circles or fewer questions.");
      const { jsPDF } = await import("jspdf");
      const doc = await drawOmrPdf(jsPDF, layout, {
        title: title.trim(),
        date: fmtDate(useCurrent ? todayISO() : date),
        logo: logoData || "",
      });
      const pdfBlob = doc.output("blob");
      const coords = toCoordinates(layout, { examId, examName: info.data?.name || examName });
      coords.title = title.trim();
      const json = new Blob([JSON.stringify(coords, null, 2)], { type: "application/json" });
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const pdfUrl = URL.createObjectURL(pdfBlob);
      urlRef.current = pdfUrl;
      const base = `omr-${slug(title)}-${qNum}q`;
      setResult({ pdfBlob, pdfUrl, pdfName: `${base}.pdf`, json, jsonName: `${base}-coordinates.json`, pages: layout.pages.length, code: sheetCode(layout) });
      setStep("result");
    } catch (e) {
      setMsg(e?.message || "Could not generate the OMR sheet.");
    } finally {
      setBusy(false);
    }
  };

  const printSheet = () => {
    if (!result) return;
    try {
      const w = frameRef.current?.contentWindow;
      if (!w) throw new Error("no frame");
      w.focus();
      w.print();
    } catch {
      window.open(result.pdfUrl, "_blank");
    }
  };

  const closeWindow = () => { try { window.close(); } catch { /* ignore */ } };

  return (
    <div className={o.wrap}>
      <div className={o.head}>
        <span className={o.headIcon} aria-hidden="true">OMR</span>
        <div>
          <h1 className={s.title}>Generate OMR sheet</h1>
          <p className={s.subtitle}>
            {info.data?.name || examName || "Exam"}
            {info.data?.exam ? ` \u00b7 ${info.data.exam}` : ""}
            {info.status === "ready" ? ` \u00b7 ${info.data.total} questions` : ""}
          </p>
        </div>
      </div>

      {info.status === "loading" && <div className={s.empty}>Loading exam&hellip;</div>}
      {info.status === "error" && <p className={s.err}>{info.error}</p>}

      {info.status === "ready" && step !== "result" && (
        <ol className={o.steps} aria-label="Steps">
          <li className={`${o.stepDot} ${step === "style" ? o.stepOn : o.stepDone}`}><span>1</span> Choose style</li>
          <li className={`${o.stepDot} ${step === "details" ? o.stepOn : ""}`}><span>2</span> Sheet details</li>
        </ol>
      )}

      {/* ------------------------------------------------------------ STEP 1: STYLE */}
      {info.status === "ready" && step === "style" && (
        <div className={`${s.card} ${o.card}`}>
          <div className={o.styleGrid} role="radiogroup" aria-label="Bubble style">
            {Object.values(STYLES).map((x) => (
              <button key={x.id} type="button" role="radio" aria-checked={styleId === x.id} className={`${o.styleCard} ${styleId === x.id ? o.styleOn : ""}`} onClick={() => setStyleId(x.id)}>
                <StylePreview st={x} />
                <span className={o.styleName}>{x.label}</span>
                <span className={o.styleMeta}>{(x.r * 2).toFixed(1)} mm circles</span>
                <span className={o.styleBlurb}>{x.blurb}</span>
              </button>
            ))}
          </div>
          <p className={o.note}>Every sheet is A4 portrait with four corner fiducials, repeated edge trackers, a tracker on both sides of every question-row slot, a page code and a 3 digit roll-number block.</p>
          <div className={o.actions}>
            <button type="button" className={`${s.btn} ${o.btnMain}`} onClick={() => setStep("details")}>Next {"\u2192"}</button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ STEP 2: DETAILS */}
      {info.status === "ready" && step === "details" && (
        <div className={`${s.card} ${o.card}`}>
          <div className={o.field}>
            <label className={s.label} htmlFor="omrTitle">Title of OMR sheet</label>
            <input id="omrTitle" className={s.input} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. MHT-CET Mock Test 12" />
          </div>

          <div className={o.row}>
            <div className={o.field}>
              <label className={s.label} htmlFor="omrQ">Number of questions</label>
              <input id="omrQ" className={s.input} value={qText} inputMode="numeric" maxLength={3} onChange={(e) => setQInput(e.target.value.replace(/\D/g, ""))} />
              <p className={o.hint}>{examTotal ? `This exam has ${examTotal} questions.` : ""}{qValid && examTotal && qNum !== examTotal ? " You changed it from the exam's count." : ""}</p>
            </div>
            <div className={o.field}>
              <span className={s.label}>Options per question</span>
              <Segmented label="Options per question" value={options} onChange={setOptions} options={[{ value: 4, label: `4 (${OPTION_LETTERS.slice(0, 4).join(" ")})` }, { value: 5, label: `5 (${OPTION_LETTERS.slice(0, 5).join(" ")})` }]} />
            </div>
          </div>

          <div className={o.field}>
            <span className={s.label}>Exam date</span>
            <Segmented label="Exam date" value={useCurrent} onChange={setUseCurrent} options={[{ value: true, label: "Use current date" }, { value: false, label: "Pick a date" }]} />
            {!useCurrent && <input type="date" className={`${s.input} ${o.dateInput}`} value={date} onChange={(e) => setDate(e.target.value)} />}
          </div>

          <div className={o.field}>
            <span className={s.label}>Logo</span>
            <div className={o.logoGrid} role="radiogroup" aria-label="Logo">
              {LOGOS.map((l) => (
                <button key={l.id} type="button" role="radio" aria-checked={logoChoice === l.id} className={`${o.logoTile} ${logoChoice === l.id ? o.logoOn : ""}`} onClick={() => setLogoChoice(l.id)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.src} alt="" className={o.logoImg} />
                  <span className={o.logoLabel}>{l.label}</span>
                </button>
              ))}
              <button type="button" role="radio" aria-checked={logoChoice === "upload"} className={`${o.logoTile} ${logoChoice === "upload" ? o.logoOn : ""}`} onClick={() => fileRef.current?.click()}>
                {logoChoice === "upload" && logoData
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={logoData} alt="" className={o.logoImg} />
                  : <span className={o.logoPlus} aria-hidden="true">+</span>}
                <span className={o.logoLabel}>{logoChoice === "upload" && logoName ? logoName : "Upload your logo"}</span>
              </button>
              <button type="button" role="radio" aria-checked={logoChoice === "none"} className={`${o.logoTile} ${logoChoice === "none" ? o.logoOn : ""}`} onClick={pickNone}>
                <span className={o.logoPlus} aria-hidden="true">∅</span>
                <span className={o.logoLabel}>No logo</span>
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { pickUpload(e.target.files?.[0]); e.target.value = ""; }} />
            {logoErr && <p className={`${s.err} ${o.logoErr}`}>{logoErr}</p>}
            <p className={o.hint}>The logo is printed in the top-left header and the same faint, softly blurred watermark is placed behind every page, matching the question-paper PDF.</p>
          </div>

          <div className={o.field}>
            <span className={s.label}>Option letters</span>
            <Segmented label="Option letters" value={lettersMode} onChange={setLetters} options={[{ value: "inside", label: "Inside the circles" }, { value: "header", label: "Above each column" }]} />
          </div>

          <div className={o.summary}>
            <strong>{st.label}</strong>
            {preview ? ` \u00b7 ${preview.cols} column${preview.cols === 1 ? "" : "s"} \u00b7 ${preview.pages.length} page${preview.pages.length === 1 ? "" : "s"}` : ""}
            {preview && !preview.fits ? <span className={o.warn}> {"\u2014"} too many questions for this style</span> : ""}
          </div>

          {msg && <p className={s.err}>{msg}</p>}

          <div className={o.actions}>
            <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => { setMsg(""); setStep("style"); }}>{"\u2190"} Back</button>
            <button type="button" className={`${s.btn} ${o.btnMain}`} disabled={busy} onClick={generate}>{busy ? "Generating\u2026" : "Generate OMR sheet"}</button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ RESULT */}
      {info.status === "ready" && step === "result" && result && (
        <div className={`${s.card} ${o.card} ${o.resultCard}`}>
          <div className={o.resultTop}>
            <span className={o.tick} aria-hidden="true">{"\u2713"}</span>
            <div>
              <h2 className={o.resultTitle}>OMR sheet is ready</h2>
              <p className={o.resultName}>{result.pdfName} {"\u00b7"} {result.pages} page{result.pages === 1 ? "" : "s"} {"\u00b7"} {result.code}</p>
            </div>
          </div>

          <iframe ref={frameRef} title="OMR preview" src={result.pdfUrl} className={o.frame} />

          <div className={o.threeBtns}>
            <button type="button" className={`${o.big} ${o.bigDownload}`} onClick={() => saveBlobFile(result.pdfBlob, result.pdfName)}>Download PDF</button>
            <button type="button" className={`${o.big} ${o.bigPrint}`} onClick={printSheet}>Print</button>
            <button type="button" className={`${o.big} ${o.bigJson}`} onClick={() => saveBlobFile(result.json, result.jsonName)}>Download coordinates</button>
          </div>
          <p className={o.note}>Keep the coordinates file (.json) with this exact sheet design. The future mobile scanner will use it for perspective correction, row alignment and bubble detection. Print at 100% / &ldquo;Actual size&rdquo;; do not use Fit to page.</p>

          <div className={o.actions}>
            <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => setStep("details")}>{"\u2190"} Change settings</button>
            <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={closeWindow}>Close window</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExamOmrPage() {
  return (
    <Suspense fallback={<div className={o.wrap}><div className={s.empty}>Loading&hellip;</div></div>}>
      <OmrWindow />
    </Suspense>
  );
}
