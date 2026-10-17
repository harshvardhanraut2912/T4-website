// 📂 SAVE AT: app/api/ultimate/start/route.js   (REPLACE)
//
// Starts an Ultimate Practice sitting for the chosen chapters. Creates/overwrites the student's
// ONE session row (no history). Questions are fetched one by one by /api/ultimate/question.
import { authenticateStudent, respond, supabaseAdmin, getCatalog, MAX_CHAPTERS } from '@/lib/training';
import { newUltimateToken } from '@/lib/ultimate';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    const raw = Array.isArray(body?.chapter_ids) ? body.chapter_ids : [];
    const requested = [...new Set(raw.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()))];
    if (!requested.length) return respond({ error: 'Select at least one chapter to start.' }, 400);
    if (requested.length > MAX_CHAPTERS) return respond({ error: `Please select at most ${MAX_CHAPTERS} chapters.` }, 400);

    const [auth, catalog] = await Promise.all([authenticateStudent(request), getCatalog()]);
    if (auth.error) return auth.error;

    const valid = requested.filter((id) => catalog.chapters[id]);
    if (!valid.length) return respond({ error: 'None of the selected chapters have practice questions yet.' }, 400);

    const token = newUltimateToken();
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from('ultimate_sessions').upsert({
      student_id: auth.email,
      token,
      chapter_ids: valid,
      pending_q_id: null,
      pending_chapter_id: null,
      pending_q_type: null,
      next_q_id: null,
      next_chapter_id: null,
      next_q_type: null,
      started_at: now,
      last_activity_at: now,
    }, { onConflict: 'student_id' });
    if (error) throw error;

    return respond({ url: `/exam-ultimate.html?token=${token}`, token });
  } catch (err) {
    console.error('Ultimate start error:', err);
    return respond({ error: 'Could not start Ultimate Practice. Please try again.' }, 500);
  }
}
