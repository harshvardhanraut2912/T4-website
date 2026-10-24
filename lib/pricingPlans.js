// lib/pricingPlans.js  (new file)
// Single source of truth for the plans. Used by /pricing, /purchase and /api/purchase.
// To change a price or a limit, edit it here only.

export const MAX_FLAT_STUDENTS = 150; // the flat plan below covers up to this many students

export const PLANS = [
  {
    key: "monthly", tone: "blue", tag: "Student-wise · Monthly", name: "Monthly plan",
    price: 25, unit: "per student / month", perStudentYear: 300,
    blurb: "Pay month by month for the students you have. A light way to get started.",
    badge: "", cta: "Book a demo · Monthly",
  },
  {
    key: "yearly", tone: "violet", tag: "Student-wise · Yearly", name: "Yearly plan",
    price: 250, unit: "per student / year", perStudentYear: 250,
    blurb: "A full year of the platform for ₹50 less per student than paying monthly.",
    badge: "Save ₹50 per student", cta: "Book a demo · Yearly",
  },
  {
    key: "upto150", tone: "green", tag: "Up to 150 students", name: "Up to 150 students",
    price: 20000, unit: "per year · up to 150 students", flat: 20000, maxStudents: MAX_FLAT_STUDENTS,
    blurb: "One flat price for institutes with up to 150 students.",
    badge: "Flat price", cta: "Book a demo · Up to 150",
  },
  {
    key: "unlimited", tone: "dark", tag: "Unlimited students", name: "Unlimited plan", featured: true,
    price: 30000, unit: "per year · no limit on students", flat: 30000,
    blurb: "For institutes with more than 150 students. No limit, however many join.",
    badge: "No limit", cta: "Book a demo · Unlimited",
  },
];

export const PLAN_KEYS = PLANS.map((p) => p.key);
export const planByKey = (k) => PLANS.find((p) => p.key === k) || null;

// Estimated cost for one year, or null when the plan can't cover that many students.
export function yearlyCost(key, students) {
  const n = Math.max(0, Number(students) || 0);
  const p = planByKey(key);
  if (!p) return null;
  if (p.maxStudents && n > p.maxStudents) return null;
  if (p.flat) return p.flat;
  return n * p.perStudentYear;
}

// Cheapest plan that is allowed for this many students.
export function cheapestPlan(students) {
  let best = null;
  for (const p of PLANS) {
    const c = yearlyCost(p.key, students);
    if (c !== null && (best === null || c < best.cost)) best = { key: p.key, cost: c };
  }
  return best;
}
