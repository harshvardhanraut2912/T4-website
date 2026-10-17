// 📂 SAVE AT: app/api/training/start/route.js   (REPLACE)
//
// Creates ONE training_sessions row (no attempt_sessions row) holding the full list of
// picked questions, and returns the exam-engine URL for it.
import {
  authenticateStudent, respond, supabaseAdmin, getCatalog, getVoidedQIds, pickQuestions,
  newTrainingToken, normalizeMode, MAX_CHAPTERS, MAX_QUESTIONS, MIN_QUESTIONS, DEFAULT_QUESTIONS,
} from '@/lib/training';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    const raw = Array.isArray(body?.chapter_ids) ? body.chapter_ids : [];
    const requested = [...new Set(raw.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()))];
    if (!requested.length) return respond({ error: 'Select at least one chapter to start training.' }, 400);
    if (requested.length > MAX_CHAPTERS) return respond({ error: `Please select at most ${MAX_CHAPTERS} chapters.` }, 400);
    const mode = normalizeMode(body?.mode);
    const wanted = Math.round(Number(body?.count));
    const count = Math.min(Math.max(Number.isFinite(wanted) ? wanted : DEFAULT_QUESTIONS, MIN_QUESTIONS), MAX_QUESTIONS);

    // Auth, catalog and void list are independent: run them together.
    const [auth, catalog, voided] = await Promise.all([authenticateStudent(request), getCatalog(), getVoidedQIds()]);
    if (auth.error) return auth.error;

    const valid = requested.filter((id) => catalog.chapters[id]);
    if (!valid.length) return respond({ error: 'None of the selected chapters have practice questions yet.' }, 400);

    // Close any unfinished attempt and pick questions at the same time.
    const now = new Date().toISOString();
    const [closeRes, picks] = await Promise.all([
      supabaseAdmin.from('training_sessions')
        .update({ status: 'abandoned', ended_at: now, last_activity_at: now })
        .eq('student_id', auth.email).eq('status', 'active'),
      pickQuestions(valid, count, [...voided]),
    ]);
    if (closeRes.error) throw closeRes.error;
    if (!picks.length) return respond({ error: 'No usable questions were found in the selected chapters.' }, 400);

    // Exam order: grouped by subject (A-Z), random order inside; numbered 1..N.
    const withSubject = picks.map((p) => ({
      q_id: p.q_id, chapter_id: p.chapter_id, q_type: p.question_type || null,
      subject: catalog.chapters[p.chapter_id]?.subject || 'Other',
    }));
    const subjects = [...new Set(withSubject.map((q) => q.subject))].sort((a, b) => a.localeCompare(b));
    const manifest = [];
    subjects.forEach((s) => withSubject.filter((q) => q.subject === s).forEach((q) => manifest.push(q)));
    manifest.forEach((q, i) => { q.q_num = i + 1; });

    const chapterIds = [...new Set(manifest.map((q) => q.chapter_id))];
    const chapterNames = chapterIds.map((id) => ({
      id, name: catalog.chapters[id]?.name || id, subject: catalog.chapters[id]?.subject || 'Other',
    }));

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = newTrainingToken();
      const { error: insertErr } = await supabaseAdmin.from('training_sessions').insert({
        student_id: auth.email,
        token,
        mode,
        subjects,
        chapter_ids: chapterIds,
        subject_names: subjects,
        chapter_names: chapterNames,
        question_manifest: manifest,
        question_count: manifest.length,
      });
      if (!insertErr) return respond({ url: `/exam.html?token=${token}`, token, mode, question_count: manifest.length });
      if (insertErr.code !== '23505') throw insertErr;
      // 23505 = a parallel start won the "one active session" race; close it and retry once.
      await supabaseAdmin.from('training_sessions')
        .update({ status: 'abandoned', ended_at: new Date().toISOString() })
        .eq('student_id', auth.email).eq('status', 'active');
    }
    return respond({ error: 'Could not start a new session. Please try again.' }, 409);
  } catch (err) {
    console.error('Training start error:', err);
    return respond({ error: 'Could not start training. Please try again.' }, 500);
  }
}
