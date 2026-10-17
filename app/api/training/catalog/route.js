// 📂 SAVE AT: app/api/training/catalog/route.js   (REPLACE)
import { authenticateStudent, respond, supabaseAdmin, getCatalog } from '@/lib/training';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const auth = await authenticateStudent(request);
    if (auth.error) return auth.error;

    // Catalog comes from one tiny SQL function (cached 5 min in memory); the
    // unfinished-session lookup runs next to it.
    const [catalog, activeRes] = await Promise.all([
      getCatalog(),
      supabaseAdmin.from('training_sessions')
        .select('token, mode, started_at, question_count, subject_names')
        .eq('student_id', auth.email).eq('status', 'active')
        .order('started_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (activeRes.error) console.error('Training catalog: active lookup failed:', activeRes.error.message);

    const active = activeRes.data?.token
      ? {
          token: activeRes.data.token,
          mode: activeRes.data.mode === 'speedrun' ? 'speedrun' : 'freeflow',
          started_at: activeRes.data.started_at,
          question_count: activeRes.data.question_count || 0,
          subjects: Array.isArray(activeRes.data.subject_names) ? activeRes.data.subject_names : [],
        }
      : null;

    return respond({ subjects: catalog.subjects, active_session: active });
  } catch (err) {
    console.error('Training catalog error:', err);
    return respond({ error: 'Could not load the training catalog. Please try again.' }, 500);
  }
}
