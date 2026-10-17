// 📂 SAVE AT: app/api/ultimate/answer/route.js   (REPLACE)
//
// NOTE (v3): the browser now reveals the answer instantly from its prefetched, encrypted copy and
// calls this route in the BACKGROUND only to count the answer and advance the session.
//
// POST { token, q_id, selected: 0..3 | null }
//   selected = null -> "Skip": nothing is counted, no answer key is released.
//   otherwise       -> the answer is checked HERE (the server decides right/wrong and bumps the
//                      chapter counter exactly once), and only now is the per-question key handed
//                      over so the browser can open the answer + solution it already holds as
//                      ciphertext. The next question is NOT sent here (it is prefetched via
//                      /api/ultimate/next), so this call is tiny and fast.
import { authenticateStudent, respond, getCatalog, fetchQuestions, supabaseAdmin } from '@/lib/training';
import { isUltimateToken, loadUltimateSession, pendingEntry } from '@/lib/ultimate';

export const dynamic = 'force-dynamic';
const LETTERS = ['A', 'B', 'C', 'D'];

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    const token = body?.token;
    const qId = typeof body?.q_id === 'string' ? body.q_id : '';
    if (!isUltimateToken(token) || !qId) return respond({ error: 'Invalid request.' }, 400);

    const skip = body.selected === null || body.selected === undefined;
    const idx = skip ? -1 : parseInt(body.selected, 10);
    if (!skip && !(Number.isInteger(idx) && idx >= 0 && idx <= 3)) return respond({ error: 'Invalid option.' }, 400);

    const [auth, catalog] = await Promise.all([authenticateStudent(request), getCatalog()]);
    if (auth.error) return auth.error;

    const session = await loadUltimateSession(token, auth.email);
    if (!session) return respond({ error: 'This practice session was replaced or does not exist.' }, 403);
    if (session.pending_q_id !== qId || !session.pending_chapter_id) {
      return respond({ error: 'stale', message: 'This question was already answered.' }, 409);
    }

    const entry = pendingEntry(session);
    const chapter = catalog.chapters[entry.chapter_id];

    let isCorrect = false;
    if (!skip) {
      const q = (await fetchQuestions([entry])).get(qId);
      if (!q) return respond({ error: 'unavailable', message: 'This question is no longer available. Please skip it.' }, 409);
      if (!q.options[LETTERS[idx]]) return respond({ error: 'Invalid option.' }, 400);
      isCorrect = LETTERS[idx] === q.correct_key;
    }

    // Claim + count in ONE transaction and promote "next" to current. A second request for the
    // same question gets false here and nothing is counted twice.
    const claim = await supabaseAdmin.rpc('ultimate_submit', {
      p_token: token,
      p_student: auth.email,
      p_q_id: qId,
      p_chapter_name: chapter?.name || entry.chapter_id,
      p_subject: chapter?.subject || 'Other',
      p_is_correct: isCorrect,
      p_count: !skip,
    });
    if (claim.error) throw claim.error;
    if (claim.data !== true) return respond({ error: 'stale', message: 'This question was already answered.' }, 409);

    if (skip) return respond({ skipped: true });
    return respond({ skipped: false, is_correct: isCorrect });
  } catch (err) {
    console.error('Ultimate answer error:', err);
    return respond({ error: 'Could not submit your answer. Please try again.' }, 500);
  }
}
