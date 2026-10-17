// 📂 SAVE AT: app/api/ultimate/question/route.js   (REPLACE)
//
// POST { token }  -> { k, chapters, current: bundle, next: bundle|null }
// Boot / resync. Returns the question currently on screen for this sitting (a page reload shows
// the same one) and, if one is already held, the prefetched next one. Bundles contain the question
// in the clear-after-decrypt form and the answer ONLY as ciphertext (see lib/ultimate.js).
import { authenticateStudent, respond, getCatalog, supabaseAdmin } from '@/lib/training';
import {
  isUltimateToken, loadUltimateSession, fillSlot, bundleForEntry, pendingEntry, nextEntry, sessionKeyB64,
} from '@/lib/ultimate';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    const token = body?.token;
    if (!isUltimateToken(token)) return respond({ error: 'Invalid practice link.' }, 400);

    const [auth, catalog] = await Promise.all([authenticateStudent(request), getCatalog()]);
    if (auth.error) return auth.error;

    let session = await loadUltimateSession(token, auth.email);
    if (!session) return respond({ error: 'This practice session was replaced or does not exist. Start again from Training Ground.' }, 403);

    const chapterIds = (session.chapter_ids || []).filter((id) => catalog.chapters[id]);
    if (!chapterIds.length) return respond({ error: 'The chapters of this session no longer have questions.' }, 404);
    const chapters = chapterIds.map((id) => ({ id, name: catalog.chapters[id].name, subject: catalog.chapters[id].subject }));

    let current = await bundleForEntry(token, pendingEntry(session), catalog);
    if (!current) {
      // nothing on screen yet (or the question left the bank): free the slot and pick one
      if (session.pending_q_id) {
        await supabaseAdmin.from('ultimate_sessions')
          .update({ pending_q_id: null, pending_chapter_id: null, pending_q_type: null })
          .eq('token', token).eq('student_id', auth.email);
        session = { ...session, pending_q_id: null, pending_chapter_id: null, pending_q_type: null };
      }
      const filled = await fillSlot({ token, studentId: auth.email, session, chapterIds, seen: [], catalog });
      current = filled.bundle;
      if (!current) {
        // lost a race with another tab: use whatever is pending now
        session = await loadUltimateSession(token, auth.email);
        current = await bundleForEntry(token, pendingEntry(session), catalog);
      }
    }
    if (!current) return respond({ error: 'No usable questions were found in the selected chapters.' }, 404);

    session = (await loadUltimateSession(token, auth.email)) || session;
    const next = await bundleForEntry(token, nextEntry(session), catalog);
    return respond({ k: sessionKeyB64(token), chapters, current, next });
  } catch (err) {
    console.error('Ultimate question error:', err);
    return respond({ error: 'Could not load the question. Please try again.' }, 500);
  }
}
