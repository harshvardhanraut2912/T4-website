// 📂 SAVE THIS FILE AT: lib/trainingExam.js   (NEW FILE)
//
// Training-Ground branches of the shared exam routes. /api/exam/{manifest,question-chunk,
// save-progress,submit,review,report-error} call these when the token starts with "trn_",
// so the SAME exam.html / exam-engine.js / review.html / solutions.html work for training —
// and nothing is ever written to attempt_sessions or exam_results.

import { NextResponse } from 'next/server';
import {
  supabaseAdmin, TRAINING_TEST_ID, asArray, loadTrainingByToken, buildSections, durationMinsFor,
  deriveSessionKey, encryptChunk, fetchQuestions, fetchKeys, scoreSession, responsesToMatrix,
  normalizeMode, speedrunLimitFor, MODE_LABEL,
} from '@/lib/training';

const json = (body, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

/* GET /api/exam/manifest?token=trn_... */
export async function trainingManifest(token) {
  const s = await loadTrainingByToken(token, 'status, mode, question_manifest, exam_state, question_count, subject_names');
  if (!s || s.status !== 'active') return json({ error: 'Invalid, expired, or completed training session.' }, 401);

  const manifest = asArray(s.question_manifest);
  if (!manifest.length) return json({ error: 'This training session has no questions.' }, 404);

  const mode = normalizeMode(s.mode);
  // Only used to boot the engine; the exam page shows no overall countdown for training.
  const durationMins = durationMinsFor(manifest.length);
  const subjects = [...new Set(manifest.map((q) => q.subject))];
  return json({
    testId: TRAINING_TEST_ID,
    testTitle: `${MODE_LABEL[mode]} · ${subjects.join(' + ')}`,
    training: { mode },
    durationMins,
    sections: buildSections(manifest),
    papers: [{ id: 1, name: 'Training Ground', durationMinutes: durationMins }],
    // No chapter, no answer: just ids + position (same shape the exam engine expects).
    // limit_s = per-question time limit in seconds (SpeedRun only; 0 = no limit).
    questions: manifest.map((q) => ({
      q_id: q.q_id, sub_id: q.subject, test_q_num: q.q_num,
      limit_s: mode === 'speedrun' ? speedrunLimitFor(q.subject) : 0,
    })),
    resumeState: s.exam_state || null,
    k: deriveSessionKey(token).toString('base64'),
  });
}

/* POST /api/exam/question-chunk  { token: trn_..., q_id } */
export async function trainingQuestionChunk(token, qId) {
  const s = await loadTrainingByToken(token, 'status, question_manifest');
  if (!s || s.status === 'abandoned') return json({ error: 'Unauthorized' }, 401);

  const entry = asArray(s.question_manifest).find((q) => q.q_id === qId);
  if (!entry) return json({ error: 'Question not found' }, 404);

  const questions = await fetchQuestions([entry]);
  const q = questions.get(qId);
  if (!q) return json({ error: 'Question not found' }, 404);

  // Only HTML + options leave the server here — never the answer or solution.
  return json(encryptChunk(deriveSessionKey(token), { question_html: q.question_html, options: q.options }));
}

/* POST /api/exam/save-progress  { token: trn_..., exam_state } */
export async function trainingSaveProgress(token, examState) {
  const { data, error } = await supabaseAdmin
    .from('training_sessions')
    .update({ exam_state: examState, last_activity_at: new Date().toISOString() })
    .eq('token', token).eq('status', 'active')
    .select('id').maybeSingle();
  if (error) throw error;
  if (!data) return json({ error: 'This attempt is not currently active.' }, 409);
  return json({ ok: true });
}

/* POST /api/exam/submit  { token: trn_..., raw_response_matrix }  (user already authenticated) */
export async function trainingSubmit(user, token, matrix) {
  const s = await loadTrainingByToken(token, 'id, student_id, status, mode, question_manifest, chapter_names');
  if (!s || s.student_id !== user.email) return json({ error: 'Invalid, expired, or already submitted exam token.' }, 403);
  const reviewUrl = { url: `/review.html?token=${token}` };
  if (s.status === 'completed') return json(reviewUrl);               // double-submit: idempotent
  if (s.status !== 'active') return json({ error: 'Invalid, expired, or already submitted exam token.' }, 403);

  const manifest = asArray(s.question_manifest);
  const nameById = {};
  asArray(s.chapter_names).forEach((c) => { nameById[c.id] = c.name; });
  const keys = await fetchKeys(manifest);
  const r = scoreSession({ manifest, matrix, keys, chapterNameOf: (id) => nameById[id] || id, mode: normalizeMode(s.mode) });

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('training_sessions')
    .update({
      status: 'completed',
      ended_at: now,
      last_activity_at: now,
      responses: r.responses,
      chapter_stats: r.chapterStats,
      subject_names: r.subjectNames,
      chapter_names: r.chapterNames,
      answered_count: r.answeredCount,
      correct_count: r.correctCount,
      skipped_count: r.skippedCount,
      total_time_ms: r.totalTimeMs,
      marks_obtained: r.marksObtained,
      marks_total: r.marksTotal,
      exam_state: null,                    // autosave no longer needed once submitted
    })
    .eq('id', s.id).eq('status', 'active')
    .select('id').maybeSingle();
  if (error) throw error;
  // data === null means another tab finished it first: still fine, same review URL.
  void data;
  return json(reviewUrl);
}

/* GET /api/exam/review?token=trn_...  (user already authenticated) */
export async function trainingReview(user, token) {
  const s = await loadTrainingByToken(token, 'id, student_id, status, question_manifest, responses, started_at, ended_at');
  if (!s || s.student_id !== user.email) return json({ error: 'Invalid or unauthorized exam token.' }, 403);
  if (s.status !== 'completed') return json({ error: 'This attempt has not been submitted yet.' }, 403);

  const manifest = asArray(s.question_manifest);
  const responses = asArray(s.responses);
  const respByQ = new Map(responses.map((r) => [r.q_id, r]));

  // Only THIS attempt's questions are read out of the bank (one RPC, ids only).
  const bank = await fetchQuestions(manifest);
  const answerManifest = manifest.map((m) => {
    const q = bank.get(m.q_id);
    const r = respByQ.get(m.q_id);
    return {
      q_id: m.q_id,
      sub_id: m.subject,
      test_q_num: m.q_num,
      answer_key: q?.correct_key || r?.correct_key || null,
      question_html: q?.question_html || '',
      options: q?.options || {},
      solution_html: q?.solution_html || null,
    };
  });

  return json({
    config: { title: 'Training Ground', sections: buildSections(manifest) },
    answerManifest,
    questionManifest: answerManifest,
    resultsHistory: [{
      id: s.id,
      test_id: TRAINING_TEST_ID,
      student_id: s.student_id,
      submitted_at: s.ended_at,
      created_at: s.started_at,
      raw_response_matrix: responsesToMatrix(responses),
    }],
    voidedQuestions: [],
  });
}

/* report-error: who owns this training token? -> { student_id, test_id } or null */
export async function trainingReportOwner(token) {
  const s = await loadTrainingByToken(token, 'student_id');
  return s ? { student_id: s.student_id, test_id: TRAINING_TEST_ID } : null;
}
