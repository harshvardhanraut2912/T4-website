// 📂 SAVE AT: app/api/training/history/route.js   (NEW FILE)
//
// A student's finished Training Ground attempts, newest first. Selects only the small
// summary columns (never `responses` / `question_manifest`), so it stays fast. The
// per-question detail (options chosen, correct option, marks, time) is opened on the
// normal review page: /review.html?token=<token>.
import { authenticateStudent, respond, supabaseAdmin, MODES } from '@/lib/training';

export const dynamic = 'force-dynamic';
const PAGE = 20;

export async function GET(request) {
  try {
    const auth = await authenticateStudent(request);
    if (auth.error) return auth.error;

    const params = new URL(request.url).searchParams;
    const before = params.get('before');
    const mode = params.get('mode');
    let query = supabaseAdmin.from('training_sessions')
      .select('token, mode, started_at, ended_at, subject_names, chapter_names, chapter_stats, question_count, answered_count, correct_count, skipped_count, marks_obtained, marks_total, total_time_ms')
      .eq('student_id', auth.email).eq('status', 'completed').not('token', 'is', null)
      .order('ended_at', { ascending: false }).limit(PAGE + 1);
    if (MODES.includes(mode)) query = query.eq('mode', mode);
    if (before && !Number.isNaN(Date.parse(before))) query = query.lt('ended_at', before);

    const { data, error } = await query;
    if (error) throw error;
    const rows = data || [];
    const page = rows.slice(0, PAGE);
    return respond({
      sessions: page.map((r) => ({
        token: r.token,
        mode: r.mode === 'speedrun' ? 'speedrun' : 'freeflow',
        started_at: r.started_at,
        ended_at: r.ended_at,
        subjects: r.subject_names || [],
        chapter_stats: r.chapter_stats || [],
        question_count: r.question_count || 0,
        answered: r.answered_count || 0,
        correct: r.correct_count || 0,
        wrong: Math.max(0, (r.answered_count || 0) - (r.correct_count || 0)),
        unanswered: r.skipped_count || 0,
        marks_obtained: r.marks_obtained,
        marks_total: r.marks_total,
        total_time_ms: r.total_time_ms || 0,
      })),
      next_before: rows.length > PAGE ? page[page.length - 1].ended_at : null,
    });
  } catch (err) {
    console.error('Training history error:', err);
    return respond({ error: 'Could not load your earlier attempts. Please try again.' }, 500);
  }
}
