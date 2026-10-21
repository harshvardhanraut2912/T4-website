// app/purchase/PurchaseClient.js  (new file)
// One question at a time. Enter = next. A live preview of the institute's own app
// builds itself on the right as the visitor types.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import s from "./purchase.module.css";

const STATES = ["Andhra Pradesh","Assam","Bihar","Chhattisgarh","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Odisha","Punjab","Rajasthan","Tamil Nadu","Telangana","Uttar Pradesh","Uttarakhand","West Bengal","Other"];
const TYPES = ["Coaching institute", "School", "Junior college", "Tutor / small batch", "Other"];
const SIZES = [{ l: "Under 50", v: 40 }, { l: "50 – 200", v: 120 }, { l: "200 – 500", v: 350 }, { l: "500+", v: 800 }];
const ACCENTS = ["#6d5dfc", "#2f7df6", "#12b886", "#f06595", "#f59f00", "#e8590c"];

const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const digitsOf = (v) => v.replace(/\D/g, "");

const STEPS = [
  { id: "institute_name", q: "What is your institute called?", hint: "This is the name your students will see everywhere.", ph: ["Sahyadri Academy", "Vidya Coaching Classes", "Your institute's name"] },
  { id: "owner_name", q: "Lovely. And who are we speaking to?", hint: "Your name, so we know who to ask for.", ph: ["Your full name"] },
  { id: "phone", q: "What's the best number to reach you on?", hint: "We'll call or WhatsApp. No spam, promise.", ph: ["98765 43210"] },
  { id: "email", q: "Where should we send the details?", hint: "An email you actually check.", ph: ["you@institute.com"] },
  { id: "where", q: "Where are you based?", hint: "City and state." },
  { id: "size", q: "Tell us about your institute.", hint: "A rough idea is perfectly fine." },
  { id: "message", q: "Anything you'd like us to know?", hint: "Optional. Exams you run, what you need, questions." },
];

export default function PurchaseClient() {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [f, setF] = useState({ institute_name: "", owner_name: "", phone: "", email: "", city: "", state: "Maharashtra", institute_type: "", student_count: "", message: "", website: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [phIdx, setPhIdx] = useState(0);
  const inputRef = useRef(null);
  const step = STEPS[i];

  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErr(""); };

  // Rotating placeholder on the first question.
  useEffect(() => {
    if (!step.ph || step.ph.length < 2) return;
    const t = setInterval(() => setPhIdx((n) => n + 1), 2200);
    return () => clearInterval(t);
  }, [step]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 380);
    return () => clearTimeout(t);
  }, [i]);

  const accent = useMemo(() => {
    const n = f.institute_name.trim();
    if (!n) return ACCENTS[0];
    let h = 0;
    for (const c of n) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return ACCENTS[h % ACCENTS.length];
  }, [f.institute_name]);

  function validate() {
    switch (step.id) {
      case "institute_name": return f.institute_name.trim().length < 2 ? "Please type your institute's name." : "";
      case "owner_name": return f.owner_name.trim().length < 2 ? "We'd love to know your name." : "";
      case "phone": return digitsOf(f.phone).length < 10 ? "That number looks short. Please check it." : "";
      case "email": return !emailOk(f.email) ? "That email doesn't look right." : "";
      case "where": return f.city.trim().length < 2 ? "Please add your city." : "";
      default: return "";
    }
  }

  async function submit() {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/purchase", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Something went wrong.");
      setDone(true);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  function next() {
    const v = validate();
    if (v) return setErr(v);
    if (i === STEPS.length - 1) return submit();
    setDir(1); setI(i + 1);
  }
  function back() { if (i > 0) { setDir(-1); setI(i - 1); setErr(""); } }
  const onKey = (e) => { if (e.key === "Enter" && !(e.target.tagName === "TEXTAREA" && !e.metaKey && !e.ctrlKey)) { e.preventDefault(); next(); } };

  const name = f.institute_name.trim();
  const initial = (name[0] || "?").toUpperCase();
  const pct = done ? 100 : Math.round((i / STEPS.length) * 100);

  return (
    <main className={s.page} style={{ "--ac": accent }} onKeyDown={onKey}>
      <div className={s.aurora} aria-hidden="true"><i /><i /><i /></div>
      <div className={s.grain} aria-hidden="true" />

      <header className={s.top}>
        <a href="/" className={s.brand}><span aria-hidden="true">←</span> Back to home</a>
        <a href="/" className={s.close}>Close <span>✕</span></a>
      </header>
      <div className={s.bar} aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>

      <div className={s.stage}>
        <section className={s.left}>
          <a href="/" className={s.logo} aria-label="Parikshiq home">
            <Image src="/images/other_images/Parikshiq-name-tight.png" alt="Parikshiq" width={342} height={337} priority />
          </a>
          {done ? (
            <div className={s.done}>
              <svg viewBox="0 0 80 80" className={s.tick} aria-hidden="true"><circle cx="40" cy="40" r="34" /><path d="M25 41l11 11 20-23" /></svg>
              <h1>Thank you, {f.owner_name.trim().split(" ")[0]}.</h1>
              <p>We have your details for <strong>{name}</strong>. Our team will reach you on <strong>{f.phone}</strong> soon.</p>
              <a href="/" className={s.pill}>Back to home <span>→</span></a>
              <div className={s.confetti} aria-hidden="true">{Array.from({ length: 26 }).map((_, k) => <i key={k} style={{ "--k": k }} />)}</div>
            </div>
          ) : (
            <div key={i} className={`${s.slide} ${dir > 0 ? s.fromRight : s.fromLeft}`}>
              <span className={s.count}>{String(i + 1).padStart(2, "0")}<em> / {String(STEPS.length).padStart(2, "0")}</em></span>
              <h1 className={s.q}>{step.q}</h1>
              <p className={s.hint}>{step.hint}</p>

              {["institute_name", "owner_name", "phone", "email"].includes(step.id) && (
                <div className={s.field}>
                  <input
                    ref={inputRef} className={s.big} value={f[step.id]} onChange={(e) => set(step.id, e.target.value)}
                    type={step.id === "email" ? "email" : step.id === "phone" ? "tel" : "text"}
                    inputMode={step.id === "phone" ? "tel" : undefined} autoComplete="off" maxLength={step.id === "email" ? 160 : 120}
                    placeholder={step.ph[phIdx % step.ph.length]} aria-label={step.q}
                  />
                  <span className={s.line} />
                </div>
              )}

              {step.id === "where" && (
                <div className={s.row2}>
                  <div className={s.field}><input ref={inputRef} className={s.big} value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="City" autoComplete="off" maxLength={80} aria-label="City" /><span className={s.line} /></div>
                  <div className={s.field}>
                    <select className={`${s.big} ${s.sel}`} value={f.state} onChange={(e) => set("state", e.target.value)} aria-label="State">{STATES.map((x) => <option key={x}>{x}</option>)}</select>
                    <span className={s.line} />
                  </div>
                </div>
              )}

              {step.id === "size" && (
                <div className={s.choices}>
                  <div className={s.chipRow}>{TYPES.map((t) => <button type="button" key={t} className={`${s.chip} ${f.institute_type === t ? s.chipOn : ""}`} onClick={() => set("institute_type", t)}>{t}</button>)}</div>
                  <span className={s.mini}>How many students?</span>
                  <div className={s.chipRow}>{SIZES.map((z) => <button type="button" key={z.l} className={`${s.chip} ${String(f.student_count) === String(z.v) ? s.chipOn : ""}`} onClick={() => set("student_count", String(z.v))}>{z.l}</button>)}</div>
                </div>
              )}

              {step.id === "message" && (
                <div className={s.field}>
                  <textarea ref={inputRef} className={`${s.big} ${s.area}`} rows={3} maxLength={1000} value={f.message} onChange={(e) => set("message", e.target.value)} placeholder="Type here, or just press Send." aria-label="Message" />
                  <span className={s.line} />
                </div>
              )}

              {/* honeypot */}
              <input className={s.hp} tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website} onChange={(e) => set("website", e.target.value)} name="website" />

              {err && <p className={s.err} role="alert">{err}</p>}

              <div className={s.actions}>
                {i > 0 && <button type="button" className={s.back} onClick={back}>← Back</button>}
                <button type="button" className={s.next} onClick={next} disabled={busy}>
                  {busy ? "Sending…" : i === STEPS.length - 1 ? "Send my details" : "Continue"} <span>{i === STEPS.length - 1 ? "✦" : "→"}</span>
                </button>
                <span className={s.enter}>or press <kbd>Enter ↵</kbd></span>
              </div>
            </div>
          )}
        </section>

        <aside className={s.right} aria-hidden="true">
          <div className={s.phone}>
            <div className={s.notch} />
            <div className={s.appHead}>
              <span className={s.badge}>{initial}</span>
              <div><strong key={name} className={s.pop}>{name || "Your institute"}</strong><small>{f.city.trim() ? `${f.city.trim()}, ${f.state}` : "Student app"}</small></div>
            </div>
            <div className={s.hero}><small>Next exam</small><b>Chemistry Mock Test</b><span className={s.pulse}>Starts in 2 days</span></div>
            <div className={s.bars}>{[78, 52, 90, 64].map((w, k) => <span key={k} style={{ "--w": `${w}%`, "--k": k }}><b /></span>)}</div>
            <div className={s.tabs}><i /><i /><i /><i /></div>
          </div>
          <div className={`${s.float} ${s.f1}`}>✓ OMR checked</div>
          <div className={`${s.float} ${s.f2}`}>Your name, everywhere</div>
          <p className={s.cap}>A peek at <em>{name || "your"}</em>'s app</p>
        </aside>
      </div>
    </main>
  );
}
