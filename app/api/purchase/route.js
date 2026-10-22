// app/api/purchase/route.js  (new file)
// Public endpoint: the /purchase form posts here. Validates, then saves into p_enquiry
// with the service-role key (the table has RLS on and no public policies).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { planByKey, yearlyCost, MAX_FLAT_STUDENTS } from "@/lib/pricingPlans";

export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

// Light spam brake (per server instance): 5 submissions / 10 min / IP.
const hits = new Map();
const WINDOW = 10 * 60 * 1000;
const MAX = 5;

const clean = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export async function POST(request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW);
    if (recent.length >= MAX) {
      return NextResponse.json({ error: "Too many requests. Please try again in a few minutes." }, { status: 429 });
    }

    const b = await request.json().catch(() => ({}));

    // Honeypot: real people never fill this hidden field. Pretend success.
    if (b.website) return NextResponse.json({ ok: true });

    const institute_name = clean(b.institute_name, 120);
    const owner_name = clean(b.owner_name, 100);
    const email = clean(b.email, 160).toLowerCase();
    const phone = String(b.phone ?? "").replace(/[^\d+]/g, "").slice(0, 16);
    const digits = phone.replace(/\D/g, "");
    const city = clean(b.city, 80);
    const state = clean(b.state, 60);
    const institute_type = clean(b.institute_type, 60);
    let message = clean(b.message, 1000);
    const source = ["demo", "pricing", "direct"].includes(b.source) ? b.source : "direct";
    const plan = planByKey(String(b.plan || ""));
    const sc = parseInt(b.student_count, 10);
    const student_count = Number.isFinite(sc) && sc > 0 ? Math.min(sc, 1000000) : null;

    if (!plan) return NextResponse.json({ error: "Please choose a plan." }, { status: 400 });
    if (!student_count) return NextResponse.json({ error: "Please tell us how many students you have." }, { status: 400 });
    const estimated_yearly = yearlyCost(plan.key, student_count);
    if (estimated_yearly === null) {
      return NextResponse.json({ error: `The ${plan.name.toLowerCase()} covers up to ${MAX_FLAT_STUDENTS} students. Please choose the unlimited plan.` }, { status: 400 });
    }
    if (institute_name.length < 2) return NextResponse.json({ error: "Please enter your institute's name." }, { status: 400 });
    if (owner_name.length < 2) return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
    if (digits.length < 10) return NextResponse.json({ error: "Please enter a valid contact number." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });

    const base = {
      institute_name, owner_name, phone, email, city: city || null, state: state || null,
      institute_type: institute_type || null, student_count, message: message || null,
      ip_address: ip, user_agent: (request.headers.get("user-agent") || "").slice(0, 300),
    };
    let { error } = await supabaseAdmin.from("p_enquiry").insert({
      ...base, plan: plan.key, plan_label: plan.name, estimated_yearly, source,
    });
    // If the plan columns haven't been added yet (sql/2026-10-22_p_enquiry_plan.sql), still save the
    // enquiry and put the plan into the message so nothing is lost.
    if (error && (error.code === "42703" || error.code === "PGRST204" || /column|schema cache/i.test(error.message || ""))) {
      const tag = `[${source === "demo" ? "Free demo · " : ""}Plan: ${plan.name} · ~${student_count} students · est. ₹${estimated_yearly}/yr]`;
      ({ error } = await supabaseAdmin.from("p_enquiry").insert({ ...base, message: `${tag} ${message}`.trim().slice(0, 1000) }));
    }
    if (error) throw error;

    recent.push(now);
    hits.set(ip, recent);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("purchase enquiry failed:", err);
    return NextResponse.json({ error: "Could not send your details. Please try again." }, { status: 500 });
  }
}
