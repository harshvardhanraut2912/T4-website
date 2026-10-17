// 📂 SAVE AT: app/api/ultimate/next/route.js   (NEW FILE)
//
// POST { token, seen?: [q_id...] } -> { bundle, slot, recycled, exhausted }
// Prefetch: the browser calls this while the student is still working on the current question,
// so the following question is already there. It fills the first free server slot (current, then
// next) and is idempotent: if both slots are taken it simply returns the held "next" bundle again.
import { authenticateStudent, respond, getCatalog } from '@/lib/training';
import {
  isUltimateToken, loadUltimateSession, cleanSeen, fillSlot, bundleForEntry, nextEntry,
} from '@/lib/ultimate';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    const token = body?.token;
    if (!isUltimateToken(token)) return respond({ error: 'Invalid practice link.' }, 400);

    const [auth, catalog] = await Promise.all([authenticateStudent(request), getCatalog()]);
    if (auth.error) return auth.error;

    const session = await loadUltimateSession(token, auth.email);
    if (!session) return respond({ error: 'This practice session was replaced or does not exist.' }, 403);
    const chapterIds = (session.chapter_ids || []).filter((id) => catalog.chapters[id]);
    if (!chapterIds.length) return respond({ error: 'The chapters of this session no longer have questions.' }, 404);

    // Both slots already taken: hand back the held next question again (browser de-duplicates).
    if (session.pending_q_id && session.next_q_id) {
      const held = await bundleForEntry(token, nextEntry(session), catalog);
      return respond({ bundle: held, slot: 'full', recycled: false, exhausted: false });
    }

    const filled = await fillSlot({ token, studentId: auth.email, session, chapterIds, seen: cleanSeen(body?.seen), catalog });
    if (filled.bundle) return respond({ bundle: filled.bundle, slot: filled.slot, recycled: filled.recycled, exhausted: false });

    if (filled.slot === 'full') {
      const fresh = await loadUltimateSession(token, auth.email);
      const held = await bundleForEntry(token, nextEntry(fresh), catalog);
      return respond({ bundle: held, slot: 'full', recycled: false, exhausted: false });
    }
    if (filled.slot === 'none') return respond({ error: 'This practice session was replaced or does not exist.' }, 403);
    return respond({ bundle: null, slot: 'empty', recycled: false, exhausted: true });
  } catch (err) {
    console.error('Ultimate next error:', err);
    return respond({ error: 'Could not load the next question. Please try again.' }, 500);
  }
}
