// app/purchase/PurchaseClient.js  (new file)
// One question at a time. Enter = next. A live preview of the institute's own app
// builds itself on the right as the visitor types.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import s from "./purchase.module.css";
import { PLANS, MAX_FLAT_STUDENTS, planByKey, yearlyCost, cheapestPlan } from "@/lib/pricingPlans";

const STATES = ["Andhra Pradesh","Assam","Bihar","Chhattisgarh","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Odisha","Punjab","Rajasthan","Tamil Nadu","Telangana","Uttar Pradesh","Uttarakhand","West Bengal","Other"];
const TYPES = ["Coaching institute", "School", "Junior college", "Tutor / small batch", "Other"];
const ACCENTS = ["#6d5dfc", "#2f7df6", "#12b886", "#f06595", "#f59f00", "#e8590c"];

// Timeline milestones for the number of students (each segment is the same width on screen).
const MILESTONES = [10, 50, 100, 150, 300, 500, 1000];
const SEG = 100;
const posOf = (v) => {
  if (v <= MILESTONES[0]) return 0;
  for (let k = 0; k < MILESTONES.length - 1; k++) {
    const a = MILESTONES[k], b = MILESTONES[k + 1];
    if (v <= b) return k * SEG + ((v - a) / (b - a)) * SEG;
  }
  return (MILESTONES.length - 1) * SEG;
};
const valOf = (p) => {
  const k = Math.min(Math.floor(p / SEG), MILESTONES.length - 2);
  const a = MILESTONES[k], b = MILESTONES[k + 1];
  const raw = a + ((p - k * SEG) / SEG) * (b - a);
  const step = raw <= 150 ? 5 : raw <= 500 ? 10 : 50;
  return Math.max(MILESTONES[0], Math.min(MILESTONES[MILESTONES.length - 1], Math.round(raw / step) * step));
};
const money = (n) => "₹" + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const digitsOf = (v) => v.replace(/\D/g, "");

const STEPS = [
  { id: "institute_name", q: "What is your institute called?", hint: "This is the name your students will see everywhere.", ph: ["Sahyadri Academy", "Vidya Coaching Classes", "Your institute's name"] },
  { id: "owner_name", q: "Lovely. And who are we speaking to?", hint: "Your name, so we know who to ask for.", ph: ["Your full name"] },
  { id: "phone", q: "What's the best number to reach you on?", hint: "We'll call or WhatsApp. No spam, promise.", ph: ["98765 43210"] },
  { id: "email", q: "Where should we send the details?", hint: "An email you actually check.", ph: ["you@institute.com"] },
  { id: "where", q: "Where are you based?", hint: "City and state." },
  { id: "size", q: "Tell us about your institute.", hint: "What kind of institute is it?" },
  { id: "students", q: "How many students do you have?", hint: "Drag along the timeline, or tap a milestone. A rough number is fine." },
  { id: "plan", q: "Which plan suits you?", hint: "Pick one. You can still talk it through with us before anything is final." },
  { id: "message", q: "Anything you'd like us to know?", hint: "Optional. Exams you run, what you need, questions." },
];

export default function PurchaseClient() {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [f, setF] = useState({ institute_name: "", owner_name: "", phone: "", email: "", city: "", state: "Maharashtra", institute_type: "", student_count: "100", plan: "", message: "", website: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [phIdx, setPhIdx] = useState(0);
  const [intent, setIntent] = useState("");
  const [source, setSource] = useState("direct");
  const inputRef = useRef(null);
  const step = STEPS[i];

  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErr(""); };

  // Read ?demo=1 / ?plan=... once on load.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const plan = q.get("plan");
    if (planByKey(plan)) { setF((p) => ({ ...p, plan })); setSource("pricing"); }
    if (q.get("demo")) { setIntent("Free demo request"); setSource("demo"); }
  }, []);

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
      case "students": return !(Number(f.student_count) > 0) ? "Please choose how many students you have." : "";
      case "plan": {
        if (!f.plan) return "Please choose a plan to continue.";
        if (yearlyCost(f.plan, f.student_count) === null) return `That plan covers up to ${MAX_FLAT_STUDENTS} students. Please pick the unlimited plan.`;
        return "";
      }
      default: return "";
    }
  }

  async function submit() {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/purchase", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, source }) });
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
              {planByKey(f.plan) && <p>Plan chosen: <strong>{planByKey(f.plan).name}</strong>, for about <strong>{f.student_count}</strong> students.</p>}
              <a href="/" className={s.pill}>Back to home <span>→</span></a>
              <div className={s.confetti} aria-hidden="true">{Array.from({ length: 26 }).map((_, k) => <i key={k} style={{ "--k": k }} />)}</div>
            </div>
          ) : (
            <div key={i} className={`${s.slide} ${dir > 0 ? s.fromRight : s.fromLeft}`}>
              {intent && <span className={s.intentTag}>{intent}</span>}
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
                </div>
              )}

              {step.id === "students" && (() => {
                const n = Number(f.student_count) || 0;
                const total = (MILESTONES.length - 1) * SEG;
                const pct = (posOf(n) / total) * 100;
                const label = (v) => (v >= 1000 ? "1,000+" : String(v));
                return (
                  <div className={s.timeline}>
                    <div className={s.tlValue}><strong key={n} className={s.tlPop}>{label(n)}</strong><span>students</span></div>
                    <div className={s.tlTrack}>
                      <span className={s.tlZone} style={{ width: `${(posOf(MAX_FLAT_STUDENTS) / total) * 100}%` }} />
                      <span className={s.tlFill} style={{ width: `${pct}%` }} />
                      {MILESTONES.map((m, k) => (
                        <button type="button" key={m} className={`${s.tlNode} ${n >= m ? s.tlOn : ""}`} style={{ left: `${(k * SEG / total) * 100}%` }} onClick={() => set("student_count", String(m))} aria-label={`${label(m)} students`}>
                          <i /><em>{label(m)}</em>
                        </button>
                      ))}
                      <span className={s.tlThumb} style={{ left: `${pct}%` }} />
                      <input ref={inputRef} type="range" min={0} max={total} step={1} value={posOf(n)} onChange={(e) => set("student_count", String(valOf(Number(e.target.value))))} className={s.tlRange} aria-label="Number of students" />
                    </div>
                    <p className={s.tlNote}>{n <= MAX_FLAT_STUDENTS ? `Up to ${MAX_FLAT_STUDENTS} students: the flat ${money(planByKey("upto150").flat)} plan is available.` : `More than ${MAX_FLAT_STUDENTS} students: the unlimited ${money(planByKey("unlimited").flat)} plan fits.`}</p>
                  </div>
                );
              })()}

              {step.id === "plan" && (
                <div className={s.planList} role="radiogroup" aria-label="Plan">
                  {PLANS.map((p) => {
                    const n = Number(f.student_count) || 0;
                    const cost = yearlyCost(p.key, n);
                    const off = cost === null;
                    const best = cheapestPlan(n)?.key === p.key;
                    return (
                      <button type="button" role="radio" aria-checked={f.plan === p.key} key={p.key} disabled={off}
                        className={`${s.planOpt} ${f.plan === p.key ? s.planOn : ""}`} onClick={() => set("plan", p.key)}>
                        <span className={s.radio} aria-hidden="true" />
                        <span className={s.planMain}><strong>{p.name}{best && <em>Lowest for you</em>}</strong><small>{money(p.price)} {p.unit}</small></span>
                        <span className={s.planEst}>{off ? <small>Up to {MAX_FLAT_STUDENTS} students only</small> : <><b>{money(cost)}</b><small>a year for {n >= 1000 ? "1,000+" : n}</small></>}</span>
                      </button>
                    );
                  })}
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
