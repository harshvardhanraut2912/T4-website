# Ultimate Practice (Training Ground)

## Install order
1. Run `sql/2026-10-17_ultimate_practice.sql` in the Supabase SQL editor (safe to re-run). Do this BEFORE deploying.
2. Copy the files in this zip over your project (same paths).
3. Restart `npm run dev` / redeploy. No new env vars, no new packages, `proxy.js` is unchanged.

## Files
NEW      sql/2026-10-17_ultimate_practice.sql
NEW      lib/ultimate.js
NEW      app/api/ultimate/start/route.js
NEW      app/api/ultimate/question/route.js
NEW      app/api/ultimate/answer/route.js
NEW      app/api/ultimate/stats/route.js
NEW      app/api/ultimate/image/route.js
NEW      public/exam-ultimate.html            (the practice screen, exam look)
NEW      app/training/UltimateClient.js       (chapter picker + "My accuracy")
NEW      app/training/ultimate.module.css
REPLACED app/dashboard/training/[[...mode]]/page.js   (renders UltimateClient on /ultimate)
REPLACED app/training/TrainingClient.js                (3rd card on the Training home)
REPLACED components/dashboard/MainSidebar.js           ("Ultimate Practice" next to SpeedRun / FreeFlow)
REPLACED app/api/exam/report-error/route.js            (only adds an `ult_` token branch)

## How it works
- Training Ground -> Ultimate Practice -> pick subjects / chapters -> Start (opens /exam-ultimate.html).
- ONE question is on screen at a time. Submitting returns: the correct option, whether you were right,
  the solution, and the NEXT single question (so "Next" is instant). Nothing further ahead is fetched,
  and the whole question bank is never loaded.
- Answer + solution are shown right under the question (correct option green, your wrong pick red).
  There is no review page, no solutions page and no attempt history.
- "Skip" loads another question, counts nothing and does not reveal the answer.
- Unlimited: random picks avoid what this sitting already showed (kept in the browser's memory only);
  when a selection is exhausted it starts over.
- Questions are picked with the same `training_pick` / `training_get_questions` functions Training
  Ground already uses (voided/bonus questions are excluded the same way).

## What is stored (and what is not)
- `ultimate_practice_stats`: one row per student + chapter with `correct` and `wrong` counters,
  plus chapter name and subject. That is all that is kept about your answers.
- `ultimate_sessions`: ONE row per student, overwritten on every question. It holds only the question
  currently on screen, so each question can be answered once (double-click / second tab / replay
  cannot inflate the counters) and a page refresh shows the same question. It never accumulates.
- No question ids, chosen options, correctness per question or timestamps per answer are saved.

## Accuracy (My accuracy tab)
- Chapter accuracy  = correct / (correct + wrong)
- Subject accuracy  = correct / (correct + wrong) across all that subject's chapters
- Overall accuracy  = MEAN of the subject accuracies (each subject counts equally)
- Skipped questions are not counted.

## Quick test
1. /dashboard -> Training Ground -> Ultimate Practice -> choose a chapter -> Start.
2. Pick an option -> Submit: right answer + solution appear; click Next Question (or press Enter).
3. End practice & view accuracy -> the chapter / subject / overall numbers appear.
