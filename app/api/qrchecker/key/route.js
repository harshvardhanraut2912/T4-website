// app/api/qrchecker/key/route.js  (new file)
//
// TESTING ONLY. Used by the phone page /qrchecker/android/<token>.
//   GET ?t=<token>  -> { name, exam, total, totalMarks, key: [{ q, a, m }] }
// The phone has no admin login, so the signed link token IS the permission (see lib/qrchecker/token.js).
// Only the answer letters and marks are returned -- never the questions or the solutions.
// The answers come from exam_answer_keys_v2.answer_manifest (saved when the exam was created).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readCheckerToken } from "@/lib/qrchecker/token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const asArray = (v) => (Array.isArray(v) ? v : typeof v === "string" ? JSON.parse(v || "[]") : []);

// answer_key may be "B", "b", "option_b", "(B)", or 1..5.
function toLetter(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  if (/^[1-5]$/.test(t)) return "ABCDE"[Number(t) - 1];
  const m = /([A-Fa-f])\s*\)?$/.exec(t);
  return m ? m[1].toUpperCase() : "";
}

// Same default marking as the deploy popup: Maths = 2, every other subject = 1, no negative marks.
const marksFor = (section) => (/math/i.test(String(section || "")) ? 2 : 1);

export async function GET(request) {
  try {
    const t = new URL(request.url).searchParams.get("t");
    const tok = readCheckerToken(t);
    if (!tok.ok) {
      const msg = tok.reason === "expired" ? "This link has expired. Create a new one from Admin -> Exams." : "This link is not valid.";
      return NextResponse.json({ error: msg }, { status: 401 });
    }

    const { data: row, error } = await supabaseAdmin.from("exam_answer_keys_v2").select("id, exam, mock_test_name, answer_manifest").eq("id", tok.examId).maybeSingle();
    if (error) throw error;
    if (!row) return NextResponse.json({ error: "Exam not found." }, { status: 404 });

    const ordered = asArray(row.answer_manifest)
      .map((q, idx) => ({ q, idx }))
      .sort((a, b) => (Number(a.q.test_q_num) || 0) - (Number(b.q.test_q_num) || 0) || a.idx - b.idx)
      .map((x) => x.q);

    // Numbered 1..N in the exam's own order -- the same numbering the OMR sheet is printed with.
    const key = ordered.map((q, i) => ({
      q: i + 1,
      a: toLetter(q.answer_key ?? q.correct_option ?? q.correct_answer ?? q.answer),
      m: marksFor(q.q_section),
    }));

    return NextResponse.json(
      { name: row.mock_test_name || "", exam: row.exam || "", total: key.length, totalMarks: key.reduce((s, k) => s + k.m, 0), key },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    console.error("qrchecker key error:", err);
    return NextResponse.json({ error: err.message || "Failed to load the answer key." }, { status: 500 });
  }
}
