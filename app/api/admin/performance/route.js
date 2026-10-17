// 📂 SAVE AT: app/api/admin/performance/route.js   (NEW FILE)
//
// GET /api/admin/performance                  -> every student + their Ultimate Practice totals
// GET /api/admin/performance?student=<email>  -> that student's detail:
//     exams    : every exam he has submitted (exam_results), with section-wise MARKS per attempt
//                (no questions, no answers, no options -- marks only; scored exactly like review.html)
//     subjects : Ultimate Practice subject-wise + chapter-wise breakdown
//
// Source: ultimate_practice_stats (one row per student + chapter: correct / wrong), the exact same
// numbers the student sees under "My accuracy". Accuracy rules are the same too:
//   chapter  = correct / (correct + wrong)
//   subject  = correct / (correct + wrong) over that subject's chapters
//   overall  = MEAN of the subject accuracies (every subject counts equally)
// Gated by proxy.js like every /api/admin/* route (admin session cookie required).
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Small in-memory cache with in-flight de-duplication: the slow lookups (all students, a student's
// exam results) are computed once and shared, so opening the tab / a student is instant.
const memo = new Map();
function cached(key, ttlMs, fn) {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  const value = fn().catch((err) => { memo.delete(key); throw err; });
  memo.set(key, { at: Date.now(), value });
  if (memo.size > 400) memo.delete(memo.keys().next().value);
  return value;
}
const STUDENTS_TTL = 60 * 1000;
const EXAMS_TTL = 2 * 60 * 1000;

const norm = (v) => String(v || "").trim().toLowerCase();
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
const noStore = { "Cache-Control": "private, no-store" };
const json = (body, status = 200) => NextResponse.json(body, { status, headers: noStore });

async function loadStats(email) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase
      .from("ultimate_practice_stats")
      .select("student_id, chapter_id, chapter_name, subject, correct, wrong, updated_at")
      .order("student_id", { ascending: true })
      .order("chapter_id", { ascending: true })
      .range(from, from + 999);
    if (email) q = q.ilike("student_id", email);
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

// subjects[] + overall from one student's chapter rows
function summarise(rows) {
  const bySubject = new Map();
  let last = null;
  for (const r of rows) {
    const attempted = (r.correct || 0) + (r.wrong || 0);
    if (r.updated_at && (!last || r.updated_at > last)) last = r.updated_at;
    if (!attempted) continue;
    const name = r.subject || "Other";
    if (!bySubject.has(name)) bySubject.set(name, { name, correct: 0, wrong: 0, chapters: [] });
    const s = bySubject.get(name);
    s.correct += r.correct || 0;
    s.wrong += r.wrong || 0;
    s.chapters.push({
      chapter_id: r.chapter_id,
      chapter_name: r.chapter_name || r.chapter_id,
      correct: r.correct || 0,
      wrong: r.wrong || 0,
      attempted,
      accuracy: pct(r.correct || 0, attempted),
      updated_at: r.updated_at || null,
    });
  }
  const subjects = [...bySubject.values()]
    .map((s) => ({
      ...s,
      attempted: s.correct + s.wrong,
      accuracy: pct(s.correct, s.correct + s.wrong),
      chapters: s.chapters.sort((a, b) => a.chapter_name.localeCompare(b.chapter_name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const accs = subjects.map((s) => s.accuracy).filter((a) => a !== null);
  const overall = {
    accuracy: accs.length ? Math.round((accs.reduce((n, a) => n + a, 0) / accs.length) * 10) / 10 : null,
    correct: subjects.reduce((n, s) => n + s.correct, 0),
    wrong: subjects.reduce((n, s) => n + s.wrong, 0),
    attempted: subjects.reduce((n, s) => n + s.attempted, 0),
    subjects_counted: accs.length,
    chapters_practised: subjects.reduce((n, s) => n + s.chapters.length, 0),
  };
  return { subjects, overall, last_practice: last };
}


/* ---------------- exam results (marks only) ---------------- */

const resolveCorrectIndex = (raw) => {
  if (raw === null || raw === undefined) return null;
  const v = String(raw).trim().toUpperCase();
  if (v === "A" || v === "1") return 0;
  if (v === "B" || v === "2") return 1;
  if (v === "C" || v === "3") return 2;
  if (v === "D" || v === "4") return 3;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
};

const asList = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") { try { const p = JSON.parse(v || "[]"); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
};
const round2 = (n) => Math.round(n * 100) / 100;

// Same marking as /api/exam/review + review.html: per-section +/- marks from products.sections,
// bonus/void questions count as correct for everyone, unanswered = 0.
function scoreAttempt(rawMatrix, sections, keys, voided) {
  const secMap = new Map(sections.map((sec) => [sec.id, { ...sec, score: 0, correct: 0, incorrect: 0, unanswered: 0 }]));
  const byId = new Map(keys.filter((k) => k.q_id).map((k) => [k.q_id, k]));
  const bySub = new Map(keys.map((k) => [`${k.sub_id}|${k.test_q_num}`, k]));
  for (const q of asList(rawMatrix)) {
    const b = secMap.get(q.sectionId);
    if (!b) continue;
    if (voided.has(Number(q.test_q_num))) { b.correct += 1; b.score += b.positiveMarks; continue; }
    const key = (q.q_id && byId.get(q.q_id)) || bySub.get(`${q.sub_id}|${q.test_q_num}`);
    const correctIdx = key ? resolveCorrectIndex(key.answer_key) : null;
    const pick = q.selectedOption === null || q.selectedOption === undefined ? null : parseInt(q.selectedOption, 10);
    if (pick === null || Number.isNaN(pick)) b.unanswered += 1;
    else if (correctIdx !== null && pick === correctIdx) { b.correct += 1; b.score += b.positiveMarks; }
    else { b.incorrect += 1; b.score -= b.negativeMarks; }
  }
  const out = [...secMap.values()].map((b) => ({
    name: b.name, score: round2(b.score), max: round2(b.maxMarks),
    correct: b.correct, incorrect: b.incorrect, unanswered: b.unanswered, total_questions: b.totalQuestions,
  }));
  const score = out.reduce((n, x) => n + x.score, 0);
  const max = out.reduce((n, x) => n + x.max, 0);
  return { sections: out, score: round2(score), max: round2(max), percentage: max > 0 ? Math.round((score / max) * 1000) / 10 : null };
}

async function loadExamResults(email) {
  const rows = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase
      .from("exam_results")
      .select("test_id, student_id, submitted_at, raw_response_matrix")
      .ilike("student_id", email)
      .order("submitted_at", { ascending: true })
      .range(from, from + 499);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  const mine = rows.filter((r) => norm(r.student_id) === email);
  if (!mine.length) return [];

  const testIds = [...new Set(mine.map((r) => String(r.test_id)))];
  const { data: products } = await supabase
    .from("products").select("id, title, linked_exam_v2_id, sections").in("id", testIds);
  const productById = new Map((products || []).map((p) => [String(p.id), p]));

  const v2Ids = [...new Set(testIds.map((id) => productById.get(id)?.linked_exam_v2_id || id))];
  const { data: keyRows } = await supabase
    .from("exam_answer_keys_v2").select("id, answer_manifest").in("id", v2Ids);
  const keysByV2 = new Map((keyRows || []).map((k) => [String(k.id), asList(k.answer_manifest)]));

  const { data: voidRows } = await supabase
    .from("question_voids").select("mock_test_name, test_q_num").in("mock_test_name", testIds);
  const voidsByTest = new Map();
  for (const v of voidRows || []) {
    const k = String(v.mock_test_name);
    if (!voidsByTest.has(k)) voidsByTest.set(k, new Set());
    voidsByTest.get(k).add(Number(v.test_q_num));
  }

  const exams = [];
  for (const testId of testIds) {
    const product = productById.get(testId);
    const manifest = keysByV2.get(String(product?.linked_exam_v2_id || testId)) || [];
    const keys = manifest.map((q) => ({ q_id: q.q_id, sub_id: q.q_section || "General", test_q_num: q.q_num, answer_key: q.answer_key }));

    const marks = {};
    for (const sec of asList(product?.sections)) {
      const m = {
        positiveMarks: typeof sec.positiveMarks === "number" ? sec.positiveMarks : 1,
        negativeMarks: typeof sec.negativeMarks === "number" ? sec.negativeMarks : 0,
      };
      if (sec?.id) marks[sec.id] = m;
      if (sec?.name) marks[sec.name] = m;
    }
    const order = []; const secs = {};
    for (const q of keys) {
      const name = q.sub_id;
      if (!secs[name]) {
        const m = marks[name] || { positiveMarks: 1, negativeMarks: 0 };
        secs[name] = { id: name, name, ...m, totalQuestions: 0 };
        order.push(name);
      }
      secs[name].totalQuestions += 1;
    }
    const sections = order.map((n) => ({ ...secs[n], maxMarks: secs[n].positiveMarks * secs[n].totalQuestions }));
    const voided = voidsByTest.get(testId) || new Set();

    const attempts = mine.filter((r) => String(r.test_id) === testId).map((r, i) => ({
      attempt: i + 1,
      submitted_at: r.submitted_at || null,
      ...scoreAttempt(r.raw_response_matrix, sections, keys, voided),
    }));
    const best = attempts.reduce((m, a) => (m === null || (a.percentage ?? -1) > (m.percentage ?? -1) ? a : m), null);
    exams.push({
      test_id: testId,
      title: product?.title || testId,
      attempts_count: attempts.length,
      best_score: best?.score ?? null, best_max: best?.max ?? null, best_percentage: best?.percentage ?? null,
      last_submitted_at: attempts[attempts.length - 1]?.submitted_at || null,
      attempts: attempts.slice().reverse(),     // newest first
    });
  }
  return exams.sort((a, b) => String(b.last_submitted_at || "").localeCompare(String(a.last_submitted_at || "")));
}

// Same idea as /api/admin/users: profile fields win, blanks are filled from Supabase Auth.
async function loadStudents() {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url, current_class, email, is_online, xp_count");
  if (error) throw error;

  const authById = {};
  for (let page = 1; ; page += 1) {
    const { data, error: aErr } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (aErr) { console.error("Performance: listUsers failed:", aErr.message); break; }
    for (const u of data.users || []) {
      const m = u.user_metadata || {};
      authById[u.id] = { email: u.email || null, full_name: m.full_name || m.name || null, avatar_url: m.avatar_url || m.picture || null };
    }
    if (!data.users || data.users.length < 1000) break;
  }

  const out = new Map();
  for (const p of profiles || []) {
    const a = authById[p.id] || {};
    const email = p.email || a.email || null;
    if (!email) continue;
    out.set(norm(email), {
      email,
      full_name: p.full_name || a.full_name || null,
      username: p.username || null,
      avatar_url: p.avatar_url || a.avatar_url || null,
      current_class: p.current_class || null,
      is_online: !!p.is_online,
    });
  }
  return out;
}

export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams;
    const email = norm(params.get("student"));
    const part = params.get("part");           // "ultimate" | "exams" | (both)

    if (email) {
      // Exam results: heavier (answer keys + scoring), so the page asks for them separately and in
      // the background. Cached for a couple of minutes.
      if (part === "exams") {
        try {
          const exams = await cached(`exams:${email}`, EXAMS_TTL, () => loadExamResults(email));
          return json({ exams });
        } catch (e) {
          console.error("Admin performance: exam results failed:", e);
          return json({ error: "Could not load exam results." }, 500);
        }
      }

      const rows = (await loadStats(email)).filter((r) => norm(r.student_id) === email);
      if (part === "ultimate") return json({ ...summarise(rows) });

      const students = await cached("students", STUDENTS_TTL, loadStudents);
      const info = students.get(email) || { email, full_name: null, username: null, avatar_url: null, current_class: null, is_online: false };
      let exams = [];
      let examsError = null;
      try { exams = await cached(`exams:${email}`, EXAMS_TTL, () => loadExamResults(email)); }
      catch (e) { console.error("Admin performance: exam results failed:", e); examsError = "Could not load exam results."; }
      return json({ student: info, exams, exams_error: examsError, ...summarise(rows) });
    }

    const students = await cached("students", STUDENTS_TTL, loadStudents);

    const byStudent = new Map();
    for (const r of await loadStats(null)) {
      const k = norm(r.student_id);
      if (!byStudent.has(k)) byStudent.set(k, []);
      byStudent.get(k).push(r);
    }

    const list = [];
    for (const [k, info] of students) {
      const sum = summarise(byStudent.get(k) || []);
      list.push({
        ...info,
        accuracy: sum.overall.accuracy,
        correct: sum.overall.correct,
        wrong: sum.overall.wrong,
        attempted: sum.overall.attempted,
        subjects_counted: sum.overall.subjects_counted,
        chapters_practised: sum.overall.chapters_practised,
        last_practice: sum.last_practice,
      });
      byStudent.delete(k);
    }
    // practice rows whose student has no profile any more: still shown, by email
    for (const [k, rows] of byStudent) {
      const sum = summarise(rows);
      list.push({
        email: rows[0].student_id, full_name: null, username: null, avatar_url: null, current_class: null, is_online: false,
        accuracy: sum.overall.accuracy, correct: sum.overall.correct, wrong: sum.overall.wrong, attempted: sum.overall.attempted,
        subjects_counted: sum.overall.subjects_counted, chapters_practised: sum.overall.chapters_practised, last_practice: sum.last_practice,
      });
    }
    return json({ students: list });
  } catch (err) {
    console.error("Admin performance error:", err);
    return json({ error: "Could not load performance data." }, 500);
  }
}
