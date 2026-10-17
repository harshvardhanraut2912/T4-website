# Ultimate Practice v2: encrypted answer + prefetched next question

## Install order
1. Run `sql/2026-10-18_ultimate_prefetch.sql` in the Supabase SQL editor (safe to re-run; needs the earlier 2026-10-17 ultimate SQL already run). Do this BEFORE deploying.
2. Copy these files over the project (same paths) and redeploy.

## Files
NEW      sql/2026-10-18_ultimate_prefetch.sql
NEW      app/api/ultimate/next/route.js
REPLACED lib/ultimate.js
REPLACED public/exam-ultimate.html
REPLACED app/api/ultimate/start/route.js
REPLACED app/api/ultimate/question/route.js
REPLACED app/api/ultimate/answer/route.js

## What changed
- Each question now arrives as one bundle: the question AND its answer + solution, together.
  The answer part is AES-GCM ciphertext under a per-question key the browser does not have, so the
  Network tab / page memory / DOM show only ciphertext until the question is submitted.
- On Submit the server checks the option, counts it once for the chapter, and only then returns that
  question's key (a tiny call). The browser opens the answer it already holds, so no question or
  solution is fetched at that moment.
- The next question is prefetched (via /api/ultimate/next) while the student is still on the current
  one, so Next / Skip open instantly. Skip opens the next question at once and tells the server in the
  background.
- Still stored: only per-chapter correct/wrong counters + one session row (now current + next pointer).
