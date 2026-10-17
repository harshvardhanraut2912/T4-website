// 📂 SAVE THIS FILE AT: lib/ultimate.js   (REPLACE)
//
// Server-side helpers for Ultimate Practice. Server only.
//
// Every question travels as a "bundle":
//   question : encrypted with the per-session key (the browser decrypts it to show the question)
//   answer   : correct option + solution, encrypted with the same session key and delivered together
//              with the question (prefetched), so Submit can reveal it instantly with no network wait.
//              The network tab only ever shows ciphertext; the browser decrypts locally on Submit.
//              The server still decides right/wrong for the stats (/api/ultimate/answer).
//
// Stored: per-chapter correct/wrong counters + ONE session row (current + next question pointers).

import crypto from 'crypto';
import { NextResponse } from 'next/server';
import {
  supabaseAdmin, getVoidedQIds, pickQuestions, fetchQuestions, deriveSessionKey, encryptChunk,
} from '@/lib/training';

export const ULTIMATE_TEST_ID = 'ultimate';
const TOKEN_RE = /^ult_[0-9a-f]{32}$/;
const MAX_SEEN = 400;
const PICK_TRIES = 4;

export const isUltimateToken = (t) => typeof t === 'string' && TOKEN_RE.test(t);
export const newUltimateToken = () => `ult_${crypto.randomBytes(16).toString('hex')}`;
export const pct = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);

export function cleanSeen(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const v of list) {
    if (typeof v === 'string' && v.length <= 80) out.push(v);
    if (out.length >= MAX_SEEN) break;
  }
  return out;
}

export async function loadUltimateSession(token, studentId) {
  if (!isUltimateToken(token)) return null;
  const { data, error } = await supabaseAdmin
    .from('ultimate_sessions')
    .select('student_id, token, chapter_ids, pending_q_id, pending_chapter_id, pending_q_type, next_q_id, next_chapter_id, next_q_type')
    .eq('token', token).eq('student_id', studentId).maybeSingle();
  if (error) throw error;
  return data || null;
}

/* ---------------- encryption ---------------- */

export const encryptFor = (token, payload) => encryptChunk(deriveSessionKey(token), payload);
export const sessionKeyB64 = (token) => deriveSessionKey(token).toString('base64');

// Per-question answer key. Never sent to the browser before the question is submitted.
export function answerKeyFor(token, qId) {
  return crypto.createHmac('sha256', String(process.env.ADMIN_SESSION_SECRET || ''))
    .update(`ult-ans:${token}:${qId}`).digest();
}

function buildBundle(token, q, chapterId, catalog) {
  const ch = catalog.chapters[chapterId];
  return {
    q_id: q.q_id,
    question: encryptFor(token, {
      q_id: q.q_id,
      chapter_id: chapterId,
      chapter_name: ch?.name || chapterId,
      subject: ch?.subject || 'Other',
      question_html: q.question_html,
      options: q.options,
    }),
    // Same session key as the question: the browser keeps this as ciphertext (never visible in the
    // Network tab) and opens it locally the instant the student presses Submit.
    answer: encryptFor(token, {
      correct_key: q.correct_key,
      solution_html: q.solution_html || '',
    }),
  };
}

// entry = { q_id, chapter_id, q_type } -> bundle, or null when the bank row is unusable
export async function bundleForEntry(token, entry, catalog) {
  if (!entry?.q_id || !catalog.chapters[entry.chapter_id]) return null;
  const q = (await fetchQuestions([entry])).get(entry.q_id);
  return q ? buildBundle(token, q, entry.chapter_id, catalog) : null;
}

export const pendingEntry = (s) => (s?.pending_q_id && s.pending_chapter_id
  ? { q_id: s.pending_q_id, chapter_id: s.pending_chapter_id, q_type: s.pending_q_type || null } : null);
export const nextEntry = (s) => (s?.next_q_id && s.next_chapter_id
  ? { q_id: s.next_q_id, chapter_id: s.next_chapter_id, q_type: s.next_q_type || null } : null);

/* ---------------- picking ---------------- */

// One random question, avoiding what the sitting already showed / holds. If the whole pool has
// been shown it starts over (recycled), never handing back the question that was just shown.
async function pickOne(chapterIds, seen, hold) {
  const voided = [...(await getVoidedQIds())];
  let picks = await pickQuestions(chapterIds, 1, [...voided, ...seen, ...hold]);
  let recycled = false;
  if (!picks.length && seen.length) {
    const justShown = seen[seen.length - 1];
    picks = await pickQuestions(chapterIds, 1, [...voided, ...hold, justShown]);
    recycled = true;
  }
  if (!picks.length) picks = await pickQuestions(chapterIds, 1, voided);   // tiny pools: allow a repeat
  return { pick: picks[0] || null, recycled };
}

// Picks a usable question and stores it in the first free slot (current, then next).
// Returns { bundle, slot: 'pending'|'next'|'full'|'none'|'empty', recycled }.
//   'full'  : another request filled the slot first (bundle is null; caller re-reads the session)
//   'empty' : no usable question exists for these chapters
export async function fillSlot({ token, studentId, session, chapterIds, seen, catalog }) {
  const hold = [session?.pending_q_id, session?.next_q_id].filter(Boolean);
  const failed = [];
  let recycled = false;
  for (let i = 0; i < PICK_TRIES; i += 1) {
    const res = await pickOne(chapterIds, seen, [...hold, ...failed]);
    recycled = recycled || res.recycled;
    if (!res.pick) break;
    const entry = { q_id: res.pick.q_id, chapter_id: res.pick.chapter_id, q_type: res.pick.question_type || null };
    const bundle = await bundleForEntry(token, entry, catalog);
    if (!bundle) { failed.push(entry.q_id); continue; }

    const { data, error } = await supabaseAdmin.rpc('ultimate_fill_slot', {
      p_token: token, p_student: studentId, p_q_id: entry.q_id, p_chapter_id: entry.chapter_id, p_q_type: entry.q_type,
    });
    if (error) throw error;
    if (data === 'pending' || data === 'next') return { bundle, slot: data, recycled };
    return { bundle: null, slot: data, recycled };
  }
  return { bundle: null, slot: 'empty', recycled };
}

/* ---------------- image proxy ---------------- */

export function allowedImageSource(url) {
  let supabaseHost = null;
  try { supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host; } catch {}
  const isStorage = !!supabaseHost && url.host === supabaseHost && url.pathname.startsWith('/storage/v1/object/');
  const isGitHubRaw = url.protocol === 'https:' &&
    ['raw.githubusercontent.com', 'github.com', 'objects.githubusercontent.com'].includes(url.hostname);
  return isStorage || isGitHubRaw;
}

export async function ultimateImageProxy(src) {
  let parsed;
  try { parsed = new URL(src); } catch { return new NextResponse('Invalid URL.', { status: 400 }); }
  if (parsed.protocol !== 'https:' || !allowedImageSource(parsed)) return new NextResponse('Blocked.', { status: 403 });
  const upstream = await fetch(parsed.toString(), { redirect: 'follow', signal: AbortSignal.timeout(12000) });
  if (!upstream.ok) return new NextResponse('Not found.', { status: 404 });
  let finalUrl;
  try { finalUrl = new URL(upstream.url); } catch { return new NextResponse('Bad image response.', { status: 502 }); }
  if (!allowedImageSource(finalUrl)) return new NextResponse('Blocked.', { status: 403 });
  const contentType = upstream.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) return new NextResponse('Not an image.', { status: 415 });
  return new NextResponse(await upstream.arrayBuffer(), {
    headers: { 'Content-Type': contentType, 'Cache-Control': 'private, max-age=600', 'X-Content-Type-Options': 'nosniff' },
  });
}
