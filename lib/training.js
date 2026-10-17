// 📂 SAVE THIS FILE AT: lib/training.js   (REPLACE the existing file)
//
// Shared server-side helpers for Training Ground. Server only — never import this
// from a "use client" component.
//
// Training Ground now runs on the SAME exam engine / review / solutions pages as a
// normal exam. A training attempt is a row in `training_sessions` and is addressed by a
// token that starts with "trn_". The shared /api/exam/* routes branch on that prefix
// (isTrainingToken) so nothing is ever written to attempt_sessions / exam_results.
//
// Speed: nothing here scans question_bundles_v2 in Node any more. Postgres does the work
// through tiny functions (see sql/2026-10-17_training_ground_v2.sql):
//   training_catalog()      subjects / chapters / counts from the id-only index
//   training_pick()         random question ids from the id-only index
//   training_get_questions  only the requested questions out of the big bundle rows
//   training_get_keys       only the answer keys (scoring)

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export const TRAINING_TEST_ID = 'training';
export const MAX_CHAPTERS = 300;
export const MAX_QUESTIONS = 200;
export const DEFAULT_QUESTIONS = 30;
export const MIN_QUESTIONS = 5;
// The exam engine still needs a paper duration to boot, but Training Ground never shows or
// enforces it. Real limits are per question (SpeedRun) or none at all (FreeFlow).
export const MINS_PER_QUESTION = 4;

// Training modes.
//   freeflow : no limit; the exam page shows a stopwatch for the question you are on.
//   speedrun : strict per-question limit; the question is submitted automatically when it ends.
export const MODES = ['speedrun', 'freeflow'];
export const MODE_LABEL = { speedrun: 'SpeedRun', freeflow: 'FreeFlow' };
export const normalizeMode = (m) => (m === 'speedrun' ? 'speedrun' : 'freeflow');
// SpeedRun limits: 2 min per question, 3 min for Maths.
export const SPEEDRUN_SECONDS = 120;
export const SPEEDRUN_MATHS_SECONDS = 180;
export const speedrunLimitFor = (subject) => (/math/i.test(String(subject || '')) ? SPEEDRUN_MATHS_SECONDS : SPEEDRUN_SECONDS);

const LETTERS = ['A', 'B', 'C', 'D'];
const TOKEN_RE = /^trn_[0-9a-f]{32}$/;

export const isTrainingToken = (t) => typeof t === 'string' && TOKEN_RE.test(t);
export const newTrainingToken = () => `trn_${crypto.randomBytes(16).toString('hex')}`;

export const asArray = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try { const p = JSON.parse(v || '[]'); return Array.isArray(p) ? p : []; } catch { return []; }
  }
  return [];
};

/* ------------------------------------------------------------------ */
/* HTTP + auth helpers                                                 */
/* ------------------------------------------------------------------ */

export function respond(body, status = 200, headers = {}) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store', ...headers },
  });
}

export function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

// cet_session_token cookie -> supabaseAdmin.auth.getUser (8s timeout) -> student_id = email.
// Returns { email, user } or { error: <NextResponse> }.
export async function authenticateStudent(request) {
  const sessionToken = request.cookies.get('cet_session_token')?.value;
  if (!sessionToken) return { error: respond({ error: 'Unauthorized' }, 401) };
  try {
    const { data, error } = await withTimeout(
      supabaseAdmin.auth.getUser(sessionToken), 8000, 'auth.getUser'
    );
    if (error || !data?.user?.email) return { error: respond({ error: 'Invalid Session' }, 401) };
    return { email: data.user.email, user: data.user };
  } catch (err) {
    console.error('Training: auth check failed:', err.message);
    return { error: respond({ error: 'Authentication check timed out. Please try again.' }, 504) };
  }
}

// Same per-token AES key the exam routes derive (manifest + question-chunk must agree).
export function deriveSessionKey(token) {
  return crypto.createHash('sha256').update(`${process.env.ADMIN_SESSION_SECRET}:${token}`).digest();
}

export function encryptChunk(key, plaintextObj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(plaintextObj), 'utf8')), cipher.final()]);
  return { iv: iv.toString('base64'), data: Buffer.concat([encrypted, cipher.getAuthTag()]).toString('base64') };
}

/* ------------------------------------------------------------------ */
/* Marking (same scheme the MHT-CET mocks use: Maths 2 marks, rest 1)  */
/* ------------------------------------------------------------------ */

export function subjectMarks(subject) {
  return /math/i.test(String(subject || ''))
    ? { positiveMarks: 2, negativeMarks: 0 }
    : { positiveMarks: 1, negativeMarks: 0 };
}

/* ------------------------------------------------------------------ */
/* Catalog (subjects -> chapters), cached in memory                    */
/* ------------------------------------------------------------------ */

const CATALOG_TTL_MS = 5 * 60 * 1000;
let catalogCache = { at: 0, data: null, inflight: null };

async function loadCatalog() {
  const { data, error } = await supabaseAdmin.rpc('training_catalog');
  if (error) throw error;
  const chapters = {};
  const bySubject = new Map();
  for (const row of data || []) {
    if (!row.question_count) continue;
    const subject = row.subject || 'Other';
    const chapter = {
      id: row.id,
      name: row.chapter_name || row.id,
      subject,
      standard: row.standard || '',
      exam: row.exam || '',
      question_count: row.question_count,
    };
    chapters[row.id] = chapter;
    if (!bySubject.has(subject)) bySubject.set(subject, []);
    bySubject.get(subject).push(chapter);
  }
  const subjects = [...bySubject.entries()]
    .map(([name, list]) => ({ name, chapters: list }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { subjects, chapters };
}

// Returns { subjects:[{name,chapters:[..]}], chapters:{id:{..}} }. One shared in-flight
// request, stale copy is served if a refresh fails.
export async function getCatalog() {
  if (catalogCache.data && Date.now() - catalogCache.at < CATALOG_TTL_MS) return catalogCache.data;
  if (!catalogCache.inflight) {
    catalogCache.inflight = loadCatalog()
      .then((data) => { catalogCache = { at: Date.now(), data, inflight: null }; return data; })
      .catch((err) => {
        catalogCache.inflight = null;
        if (catalogCache.data) { console.error('Training: catalog refresh failed, serving stale:', err.message); return catalogCache.data; }
        throw err;
      });
  }
  return catalogCache.inflight;
}

/* ------------------------------------------------------------------ */
/* Voided ("bonus") questions — excluded when picking                  */
/* ------------------------------------------------------------------ */

let voidCache = { at: 0, set: new Set() };
const VOID_TTL_MS = 5 * 60 * 1000;

async function loadVoidedQIds() {
  const { data: voids, error } = await supabaseAdmin.from('question_voids').select('mock_test_name, test_q_num');
  if (error) throw error;
  const set = new Set();
  if (!voids?.length) return set;

  const names = [...new Set(voids.map((v) => String(v.mock_test_name)))];
  const examOf = {};
  const { data: prods, error: prodErr } = await supabaseAdmin.from('products').select('id, linked_exam_v2_id').in('id', names);
  if (prodErr) console.error('Training: products lookup for voids failed:', prodErr.message);
  (prods || []).forEach((p) => { examOf[String(p.id)] = p.linked_exam_v2_id || String(p.id); });

  const numsByExam = new Map();
  for (const v of voids) {
    const examId = examOf[String(v.mock_test_name)] || String(v.mock_test_name);
    if (!numsByExam.has(examId)) numsByExam.set(examId, new Set());
    numsByExam.get(examId).add(Number(v.test_q_num));
  }
  const exams = [...numsByExam.keys()];
  const { data: rows, error: rowErr } = await supabaseAdmin
    .from('exam_question_data_v2').select('id, questions_manifest').in('id', exams);
  if (rowErr) { console.error('Training: manifest lookup for voids failed:', rowErr.message); return set; }
  for (const row of rows || []) {
    const nums = numsByExam.get(String(row.id));
    for (const q of asArray(row.questions_manifest)) {
      if (q.q_id && nums?.has(Number(q.test_q_num ?? q.q_num))) set.add(String(q.q_id));
    }
  }
  return set;
}

// Never throws: if the void tables can't be read, the last known set is kept.
export async function getVoidedQIds() {
  if (Date.now() - voidCache.at < VOID_TTL_MS) return voidCache.set;
  try {
    voidCache = { at: Date.now(), set: await loadVoidedQIds() };
  } catch (err) {
    console.error('Training: could not load voided questions:', err.message);
    voidCache = { at: Date.now() - VOID_TTL_MS + 5000, set: voidCache.set };
  }
  return voidCache.set;
}

/* ------------------------------------------------------------------ */
/* Picking + fetching questions (all heavy lifting is in Postgres)     */
/* ------------------------------------------------------------------ */

export async function pickQuestions(chapterIds, count, excludeIds = []) {
  const { data, error } = await supabaseAdmin.rpc('training_pick', {
    p_chapter_ids: chapterIds,
    p_count: count,
    p_exclude: excludeIds,
  });
  if (error) throw error;
  return data || [];
}

// Groups manifest-like entries ({chapter_id, q_type, q_id}) into the RPC input shape.
function groupItems(entries, useType) {
  const map = new Map();
  for (const e of entries) {
    const type = useType ? (e.q_type || null) : null;
    const key = `${e.chapter_id}|${type || ''}`;
    if (!map.has(key)) map.set(key, { chapter_id: e.chapter_id, question_type: type, q_ids: [] });
    map.get(key).q_ids.push(e.q_id);
  }
  return [...map.values()];
}

// Normalise a bank question (single-correct MCQ). Returns null when unusable.
export function normalizeQuestion(q) {
  if (!q || typeof q !== 'object' || !q.q_id) return null;
  const html = typeof q.question_html === 'string' ? q.question_html : '';
  if (!html.trim()) return null;
  const rawOpts = q.options && typeof q.options === 'object' ? q.options : null;
  if (!rawOpts) return null;
  const options = {};
  for (const L of LETTERS) {
    const v = rawOpts[L] ?? rawOpts[L.toLowerCase()];
    if (typeof v === 'string' && v.trim()) options[L] = v;
  }
  if (Object.keys(options).length < 2) return null;
  const key = String(q.answer_key ?? '').trim().toUpperCase();
  if (!/^[A-D]$/.test(key) || !options[key]) return null;
  return {
    q_id: String(q.q_id),
    question_html: html,
    options,
    correct_key: key,
    solution_html: typeof q.solution_html === 'string' ? q.solution_html : '',
  };
}

// Small server-side cache: question content is identical for every student, and the
// exam engine pre-loads questions one by one, so this removes repeat DB work.
const Q_CACHE_MAX = 400;
const Q_CACHE_TTL_MS = 10 * 60 * 1000;
const qCache = new Map(); // q_id -> { at, q }

function cacheGet(qId) {
  const hit = qCache.get(qId);
  if (!hit) return null;
  if (Date.now() - hit.at > Q_CACHE_TTL_MS) { qCache.delete(qId); return null; }
  return hit.q;
}
function cacheSet(qId, q) {
  if (qCache.size >= Q_CACHE_MAX) qCache.delete(qCache.keys().next().value);
  qCache.set(qId, { at: Date.now(), q });
}

// entries: [{chapter_id, q_type, q_id}] -> Map(q_id -> normalised question incl. answer + solution).
// Callers must never forward correct_key / solution_html to the client of a live attempt.
export async function fetchQuestions(entries) {
  const out = new Map();
  const missing = [];
  for (const e of entries) {
    const hit = cacheGet(e.q_id);
    if (hit) out.set(e.q_id, hit); else missing.push(e);
  }
  if (!missing.length) return out;

  const run = async (list, useType) => {
    const { data, error } = await supabaseAdmin.rpc('training_get_questions', { p_items: groupItems(list, useType) });
    if (error) throw error;
    for (const row of data || []) {
      const n = normalizeQuestion(row.q);
      if (n && !out.has(n.q_id)) { out.set(n.q_id, n); cacheSet(n.q_id, n); }
    }
  };
  await run(missing, true);
  // Bank may have re-typed a question since the session was created: retry the rest untyped.
  const still = missing.filter((e) => !out.has(e.q_id));
  if (still.length) await run(still, false);
  return out;
}

// entries -> Map(q_id -> 'A'..'D'). Answer keys only (no HTML).
export async function fetchKeys(entries) {
  const out = new Map();
  const { data, error } = await supabaseAdmin.rpc('training_get_keys', { p_items: groupItems(entries, false) });
  if (error) throw error;
  for (const row of data || []) {
    if (row.q_id && /^[A-D]$/.test(row.answer_key || '')) out.set(row.q_id, row.answer_key);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Sections / manifest builders shared by the exam routes              */
/* ------------------------------------------------------------------ */

// manifest: [{q_id, chapter_id, q_type, subject, q_num}] (already in exam order)
export function buildSections(manifest) {
  const order = [];
  const map = {};
  for (const q of manifest) {
    if (!map[q.subject]) {
      map[q.subject] = { id: q.subject, name: q.subject, paperAllocation: 1, ...subjectMarks(q.subject), totalQuestions: 0 };
      order.push(q.subject);
    }
    map[q.subject].totalQuestions += 1;
  }
  return order.map((n) => map[n]);
}

export const durationMinsFor = (count) => Math.max(30, count * MINS_PER_QUESTION);

// Loads a training attempt by token. Returns the row or null.
export async function loadTrainingByToken(token, columns) {
  if (!isTrainingToken(token)) return null;
  const { data, error } = await supabaseAdmin.from('training_sessions').select(columns).eq('token', token).maybeSingle();
  if (error) throw error;
  return data || null;
}

/* ------------------------------------------------------------------ */
/* Scoring (submit)                                                    */
/* ------------------------------------------------------------------ */

const pct = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);

// matrix = exam engine raw_response_matrix; selectedOption is an index 0..3 (or null).
export function scoreSession({ manifest, matrix, keys, chapterNameOf, mode = 'freeflow' }) {
  const byQ = new Map();
  for (const m of asArray(matrix)) if (m?.q_id) byQ.set(String(m.q_id), m);

  const responses = manifest.map((q) => {
    const m = byQ.get(q.q_id);
    const idx = m && m.selectedOption !== null && m.selectedOption !== undefined ? parseInt(m.selectedOption, 10) : NaN;
    const selected = Number.isInteger(idx) && idx >= 0 && idx <= 3 ? LETTERS[idx] : null;
    const correctKey = keys.get(q.q_id) || null;
    const marksCfg = subjectMarks(q.subject);
    const answered = selected !== null;
    const isCorrect = answered && !!correctKey && selected === correctKey;
    const marks = !answered ? 0 : isCorrect ? marksCfg.positiveMarks : -marksCfg.negativeMarks;
    let secs = Number(m?.timeSpentSeconds);
    // SpeedRun: a question can never have used more than its limit.
    if (mode === 'speedrun' && Number.isFinite(secs)) secs = Math.min(secs, speedrunLimitFor(q.subject));
    return {
      n: q.q_num,
      q_id: q.q_id,
      chapter_id: q.chapter_id,
      chapter_name: chapterNameOf(q.chapter_id),
      subject: q.subject,
      selected,
      correct_key: correctKey,
      is_correct: isCorrect,
      marks,
      time_ms: Number.isFinite(secs) && secs > 0 ? Math.round(secs * 1000) : 0,
      status: answered ? 'answered' : 'unanswered',
    };
  });

  const chapterOrder = [];
  const stats = {};
  for (const r of responses) {
    if (!stats[r.chapter_id]) {
      stats[r.chapter_id] = {
        chapter_id: r.chapter_id, chapter_name: r.chapter_name, subject: r.subject,
        total: 0, attempted: 0, correct: 0, wrong: 0, unanswered: 0, marks: 0, max_marks: 0, time_ms: 0,
      };
      chapterOrder.push(r.chapter_id);
    }
    const s = stats[r.chapter_id];
    s.total += 1;
    s.max_marks += subjectMarks(r.subject).positiveMarks;
    s.time_ms += r.time_ms;
    s.marks += r.marks;
    if (r.status === 'answered') { s.attempted += 1; if (r.is_correct) s.correct += 1; else s.wrong += 1; }
    else s.unanswered += 1;
  }
  const chapterStats = chapterOrder.map((id) => ({ ...stats[id], accuracy: pct(stats[id].correct, stats[id].attempted) }));

  const answeredCount = responses.filter((r) => r.status === 'answered').length;
  const correctCount = responses.filter((r) => r.is_correct).length;
  return {
    responses,
    chapterStats,
    answeredCount,
    correctCount,
    skippedCount: responses.length - answeredCount,
    totalTimeMs: responses.reduce((n, r) => n + r.time_ms, 0),
    marksObtained: responses.reduce((n, r) => n + r.marks, 0),
    marksTotal: responses.reduce((n, r) => n + subjectMarks(r.subject).positiveMarks, 0),
    subjectNames: [...new Set(responses.map((r) => r.subject))],
    chapterNames: chapterOrder.map((id) => ({ id, name: stats[id].chapter_name, subject: stats[id].subject })),
  };
}

// responses[] -> the matrix shape review.html / solutions.html read.
export function responsesToMatrix(responses) {
  return asArray(responses).map((r, i) => ({
    globalIndex: i,
    q_id: r.q_id,
    sub_id: r.subject,
    test_q_num: r.n,
    sectionId: r.subject,
    status: r.status === 'answered' ? 'answered' : 'unvisited',
    selectedOption: r.selected ? LETTERS.indexOf(r.selected) : null,
    timeSpentSeconds: Math.round((Number(r.time_ms) || 0) / 1000),
  }));
}

/* ------------------------------------------------------------------ */
/* Image proxy for training tokens (question images)                   */
/* ------------------------------------------------------------------ */

function allowedImageSource(url) {
  let supabaseHost = null;
  try { supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host; } catch {}
  const isStorage = !!supabaseHost && url.host === supabaseHost && url.pathname.startsWith('/storage/v1/object/');
  const isGitHubRaw = url.protocol === 'https:' &&
    ['raw.githubusercontent.com', 'github.com', 'objects.githubusercontent.com'].includes(url.hostname);
  return isStorage || isGitHubRaw;
}

export async function trainingImageProxy(token, src) {
  let parsed;
  try { parsed = new URL(src); } catch { return new NextResponse('Invalid URL.', { status: 400 }); }
  if (parsed.protocol !== 'https:' || !allowedImageSource(parsed)) return new NextResponse('Blocked.', { status: 403 });

  const session = await loadTrainingByToken(token, 'id, status');
  if (!session || (session.status !== 'active' && session.status !== 'completed')) {
    return new NextResponse('Unauthorized.', { status: 401 });
  }
  const upstream = await fetch(parsed.toString(), { redirect: 'follow', signal: AbortSignal.timeout(12000) });
  if (!upstream.ok) return new NextResponse('Not found.', { status: 404 });
  let finalUrl;
  try { finalUrl = new URL(upstream.url); } catch { return new NextResponse('Bad image response.', { status: 502 }); }
  if (!allowedImageSource(finalUrl)) return new NextResponse('Blocked.', { status: 403 });
  const contentType = upstream.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) return new NextResponse('Not an image.', { status: 415 });
  return new NextResponse(await upstream.arrayBuffer(), {
    headers: { 'Content-Type': contentType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
