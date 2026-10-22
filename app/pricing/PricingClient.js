// app/pricing/PricingClient.js  (new file)
// Animated pricing page: hero, "every plan includes", three plans, a small
// "which plan is cheapest for me" slider, and a free-demo call to action.
// Change prices / copy in the PLANS and INCLUDED arrays below.
"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import s from "./pricing.module.css";
import { PLANS, MAX_FLAT_STUDENTS, planByKey, yearlyCost, cheapestPlan } from "@/lib/pricingPlans";

const DEMO_HREF = "/purchase?demo=1";

const INCLUDED = [
  { icon: "▣", title: "Student app", text: "Exams, practice and reports in every student’s pocket." },
  { icon: "⌘", title: "Teacher admin app", text: "Build papers, schedule exams, scan OMR sheets and track every student." },
  { icon: "↗", title: "Website for students & teachers", text: "A portal that carries your institute’s name and look." },
];

const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const rupee = (n) => `₹${fmt(n)}`;

/* Counts a number up the first time it scrolls into view */
function CountUp({ to }) {
  const ref = useRef(null);
  const [v, setV] = useState(to);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      let t0 = null;
      const tick = (t) => {
        if (t0 === null) t0 = t;
        const p = Math.min((t - t0) / 1100, 1);
        setV(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to]);

  return <span ref={ref}>{fmt(v)}</span>;
}

const Tick = () => (
  <svg viewBox="0 0 24 24" className={s.tick} aria-hidden="true"><circle cx="12" cy="12" r="11" /><path d="M7 12.5l3.3 3.3L17 9" /></svg>
);

export default function PricingClient() {
  const rootRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [students, setStudents] = useState(120);

  // Reveal [data-rv] blocks as they scroll into view.
  useEffect(() => {
    setReady(true);
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.setAttribute("data-in", ""); io.unobserve(e.target); }
    }), { threshold: 0.15 });
    root.querySelectorAll("[data-rv]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const keys = PLANS.map((p) => p.key);
  const costs = Object.fromEntries(keys.map((k) => [k, yearlyCost(k, students)]));
  const best = cheapestPlan(students).key;
  const maxCost = Math.max(...keys.map((k) => costs[k] || 0));
  const saving = costs.monthly - costs[best];

  return (
    <main className={s.page} ref={rootRef} data-ready={ready ? "true" : "false"}>
      <div className={s.aurora} aria-hidden="true"><i /><i /><i /></div>

      <header className={s.header}>
        <a href="/" className={s.brand} aria-label="Parikshiq home">
          <Image src="/images/other_images/class-logo.png" alt="" width={43} height={43} className={s.logo} priority />
          <span>Parikshiq<b>.</b></span>
        </a>
        <nav className={s.nav} aria-label="Main navigation">
          <a href="/">Home</a>
          <a href="/pricing" aria-current="page">Pricing</a>
          <a href="/login">Student login</a>
        </nav>
        <a className={s.primary} href={DEMO_HREF}>Get free demo <span>→</span></a>
      </header>

      {/* ---------- Hero ---------- */}
      <section className={s.hero}>
        <span className={`${s.coin} ${s.c1}`} aria-hidden="true">₹25</span>
        <span className={`${s.coin} ${s.c2}`} aria-hidden="true">₹250</span>
        <span className={`${s.coin} ${s.c3}`} aria-hidden="true">∞</span>
        <div className={s.eyebrow} style={{ "--i": 0 }}><span>✳</span> Simple pricing</div>
        <h1>
          <span className={s.w} style={{ "--i": 1 }}>Pay for the students</span>{" "}
          <span className={s.w} style={{ "--i": 2 }}>you teach.</span>{" "}
          <span className={`${s.w} ${s.grad}`} style={{ "--i": 3 }}>Or stop counting.</span>
        </h1>
        <p className={s.lead} style={{ "--i": 4 }}>
          Choose a student-wise plan, or a flat price for your whole institute. Every plan comes with the same three things.
        </p>
        <div className={s.heroBtns} style={{ "--i": 5 }}>
          <a className={s.primary} href="#plans">Compare plans <span>↓</span></a>
          <a className={s.ghost} href={DEMO_HREF}>Try a free demo first</a>
        </div>
      </section>

      {/* ---------- Included in every plan ---------- */}
      <section className={s.included} aria-label="Included in every plan">
        <p className={s.incLabel} data-rv>Included in every plan</p>
        <div className={s.incGrid}>
          {INCLUDED.map((x, k) => (
            <article className={s.incCard} key={x.title} data-rv style={{ "--i": k }}>
              <span className={s.incIcon} style={{ "--k": k }}>{x.icon}</span>
              <div><h3>{x.title}</h3><p>{x.text}</p></div>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- Plans ---------- */}
      <section className={s.plansSection} id="plans">
        <div className={s.sectionIntro} data-rv>
          <span className={s.label}>Four ways to pay</span>
          <h2>Pick the plan that fits your institute</h2>
          <p>All four include the student app, the teacher admin app and the website. Only the way you pay changes.</p>
        </div>

        <div className={s.planGrid}>
          {PLANS.map((p, k) => (
            <article
              key={p.key}
              className={`${s.plan} ${s[p.tone]} ${p.featured ? s.featured : ""}`}
              data-rv style={{ "--i": k }}
            >
              {p.featured && <span className={s.sheen} aria-hidden="true" />}
              {p.featured && <span className={s.infMark} aria-hidden="true">∞</span>}
              <div className={s.planTop}>
                <span className={s.planTag}><i />{p.tag}</span>
                {p.badge && <span className={s.badge}>{p.badge}</span>}
              </div>

              <div className={s.priceRow}>
                <span className={s.cur}>₹</span>
                <strong className={s.amount}><CountUp to={p.price} /></strong>
              </div>
              <span className={s.unit}>{p.unit}</span>
              <p className={s.blurb}>{p.blurb}</p>

              <ul className={s.list}>
                {INCLUDED.map((x, j) => (
                  <li key={x.title} style={{ "--j": j }}><Tick />{x.title}</li>
                ))}
              </ul>

              <a className={s.planBtn} href={`/purchase?plan=${p.key}`}>{p.cta} <span>→</span></a>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- Which plan is cheapest ---------- */}
      <section className={s.calc} data-rv>
        <div className={s.calcCopy}>
          <span className={s.label}>Not sure which one?</span>
          <h2>See what a year costs for your students</h2>
          <p>Slide to your number of students. We show the yearly cost of each plan.</p>

          <div className={s.sliderBox}>
            <div className={s.sliderHead}>
              <span>Students</span>
              <strong key={students} className={s.pop}>{fmt(students)}</strong>
            </div>
            <input
              type="range" min="10" max="1000" step="10" value={students}
              onChange={(e) => setStudents(Number(e.target.value))}
              className={s.range} aria-label="Number of students"
              style={{ "--pct": `${((students - 10) / 990) * 100}%` }}
            />
            <div className={s.ticks}><span>10</span><span>500</span><span>1,000</span></div>
          </div>
        </div>

        <div className={s.bars}>
          {keys.map((k) => (
            <div className={`${s.barRow} ${best === k ? s.barBest : ""} ${costs[k] === null ? s.barOff : ""}`} key={k}>
              <div className={s.barHead}>
                <span>{planByKey(k).name}{best === k && <em>Lowest</em>}</span>
                {costs[k] === null
                  ? <strong className={s.na}>Only up to {MAX_FLAT_STUDENTS} students</strong>
                  : <strong>{rupee(costs[k])}<small> / year</small></strong>}
              </div>
              <div className={s.track}><b style={{ width: `${costs[k] === null ? 0 : Math.max((costs[k] / maxCost) * 100, 3)}%` }} /></div>
            </div>
          ))}
          <p className={s.verdict} key={best}>
            For <b>{fmt(students)}</b> students, the <b>{planByKey(best).name.toLowerCase()}</b> costs the least over a year
            {best !== "monthly" && saving > 0 ? <>, <b>{rupee(saving)}</b> less than paying monthly.</> : "."}
          </p>
        </div>
      </section>

      {/* ---------- Final call to action ---------- */}
      <section className={s.cta} data-rv>
        <div className={s.ctaRing} aria-hidden="true" />
        <div className={s.ctaCopy}>
          <span>Free demo</span>
          <h2>See Parikshiq with your own institute’s name on it.</h2>
          <p>Tell us about your institute and we will show you the apps and website before you choose a plan.</p>
        </div>
        <a href={DEMO_HREF} className={s.ctaBtn}>Get free demo <span>→</span></a>
      </section>

      <footer className={s.footer}>
        <a href="/" className={s.footBrand}><Image src="/images/other_images/class-logo.png" alt="" width={34} height={34} /><span>Parikshiq<b>.</b></span></a>
        <div><a href="/">Home</a><a href="/pricing">Pricing</a><a href="/login">Student login</a></div>
        <span className={s.copy}>© {new Date().getFullYear()} Parikshiq</span>
      </footer>
    </main>
  );
}
