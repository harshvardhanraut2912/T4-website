// app/admin/XpToppers.js  (new file)
//
// "XP toppers" section of the admin Overview page: the real students with the most XP
// (profiles.xp_count, via GET /api/admin/xp-toppers).
//   - top 3 on an animated podium (bars rise, crown bounces, XP counts up)
//   - the rest as a list whose rows slide in one after another, with XP bars that fill
//   - animations start when the section scrolls into view; reduced-motion users get a static view
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import s from "./xpToppers.module.css";

const initials = (name) => String(name || "S").split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "S";
const fmt = (n) => Number(n || 0).toLocaleString("en-IN");

function useCountUp(target, run, delay = 0, ms = 1300) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setV(target); return undefined; }
    let raf = 0, t0 = 0;
    const start = setTimeout(() => {
      const step = (t) => {
        if (!t0) t0 = t;
        const p = Math.min(1, (t - t0) / ms);
        setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(start); cancelAnimationFrame(raf); };
  }, [target, run, delay, ms]);
  return v;
}

function Avatar({ t, className }) {
  const [bad, setBad] = useState(false);
  return (
    <span className={className}>
      {t.avatar_url && !bad ? <img src={t.avatar_url} alt="" referrerPolicy="no-referrer" onError={() => setBad(true)} /> : initials(t.name)}
      {t.online && <i className={s.online} title="Online now" />}
    </span>
  );
}

function PodiumSpot({ t, place, run }) {
  const delay = place === 1 ? 500 : place === 2 ? 250 : 0;
  const xp = useCountUp(t.xp, run, delay + 300);
  return (
    <div className={`${s.spot} ${s[`p${place}`]}`} style={{ "--d": `${delay}ms` }}>
      {place === 1 && <span className={s.crown} aria-hidden="true">{"\u{1F451}"}</span>}
      <Avatar t={t} className={s.pAvatar} />
      <strong className={s.pName} title={t.name}>{t.name}</strong>
      <span className={s.pXp}>{"\u2605"} {fmt(xp)}</span>
      <div className={s.pillar}><b>{t.rank}</b></div>
    </div>
  );
}

function Row({ t, top, run, i }) {
  const xp = useCountUp(t.xp, run, 700 + i * 90, 1000);
  return (
    <div className={s.row} style={{ "--i": i }}>
      <span className={s.rRank}>{t.rank}</span>
      <Avatar t={t} className={s.rAvatar} />
      <div className={s.rInfo}>
        <strong title={t.name}>{t.name}</strong>
        <span>{t.class ? `Class ${t.class}` : "Student"}</span>
        <div className={s.rBar}><i style={{ "--w": `${Math.max(4, Math.round((t.xp / top) * 100))}%` }} /></div>
      </div>
      <span className={s.rXp}>{"\u2605"} {fmt(xp)}</span>
    </div>
  );
}

export default function XpToppers() {
  const [state, setState] = useState({ status: "loading", error: "", data: null });
  const [run, setRun] = useState(false);
  const [round, setRound] = useState(0); // bumps on refresh so the animation plays again
  const box = useRef(null);

  const load = useCallback(() => {
    setState((p) => ({ ...p, status: "loading", error: "" }));
    fetch("/api/admin/xp-toppers?limit=10", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to load XP toppers.");
        setState({ status: "ready", error: "", data });
        setRound((r) => r + 1);
      })
      .catch((e) => setState({ status: "error", error: e.message || "Failed to load XP toppers.", data: null }));
  }, []);
  useEffect(() => { load(); }, [load]);

  // Start the animation when the section is actually on screen.
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") { setRun(true); return undefined; }
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { setRun(true); io.disconnect(); } }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const data = state.data;
  const toppers = data?.toppers || [];
  const podium = toppers.filter((t) => t.rank <= 3).slice(0, 3);
  const rest = toppers.slice(podium.length);
  const top = toppers[0]?.xp || 1;
  const order = [podium[1], podium[0], podium[2]].filter(Boolean); // 2nd, 1st, 3rd
  const live = run && state.status === "ready";

  return (
    <section ref={box} className={s.wrap} aria-label="XP toppers">
      <div className={s.head}>
        <div>
          <h2>XP toppers</h2>
          <p>{data ? `${fmt(data.studentsWithXp)} students earning XP \u00b7 ${fmt(data.totalXp)} XP in total` : "Real students with the most XP"}</p>
        </div>
        <button type="button" className={s.refresh} onClick={load} disabled={state.status === "loading"}>{state.status === "loading" ? "Loading\u2026" : "\u21BB Refresh"}</button>
      </div>

      <div className={s.card}>
        <span className={s.glow} aria-hidden="true" />
        {state.status === "loading" && !data && <div className={s.skel}><i /><i /><i /></div>}
        {state.status === "error" && <p className={s.err}>{state.error}</p>}
        {state.status !== "error" && data && toppers.length === 0 && <p className={s.empty}>No student has earned XP yet.</p>}

        {data && toppers.length > 0 && (
          <div key={round} className={live ? s.go : s.wait}>
            <div className={s.podium}>
              {order.map((t) => <PodiumSpot key={t.id} t={t} place={t.rank} run={live} />)}
            </div>
            {rest.length > 0 && (
              <div className={s.list}>
                {rest.map((t, i) => <Row key={t.id} t={t} top={top} run={live} i={i} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
