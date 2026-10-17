// 📂 SAVE AT: app/api/ultimate/stats/route.js   (NEW FILE)
//
// GET -> the student's Ultimate Practice accuracy:
//   chapter  : correct / (correct + wrong)
//   subject  : correct / (correct + wrong) over all of that subject's chapters
//   overall  : MEAN of the subject accuracies (every subject counts equally)
import { authenticateStudent, respond, supabaseAdmin } from '@/lib/training';
import { pct } from '@/lib/ultimate';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const auth = await authenticateStudent(request);
    if (auth.error) return auth.error;

    const { data, error } = await supabaseAdmin
      .from('ultimate_practice_stats')
      .select('chapter_id, chapter_name, subject, correct, wrong')
      .eq('student_id', auth.email);
    if (error) throw error;

    const bySubject = new Map();
    for (const r of data || []) {
      const attempted = (r.correct || 0) + (r.wrong || 0);
      if (!attempted) continue;
      const name = r.subject || 'Other';
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
      });
    }

    const subjects = [...bySubject.values()]
      .map((s) => ({
        name: s.name,
        correct: s.correct,
        wrong: s.wrong,
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
    };

    return respond({ overall, subjects });
  } catch (err) {
    console.error('Ultimate stats error:', err);
    return respond({ error: 'Could not load your accuracy. Please try again.' }, 500);
  }
}
