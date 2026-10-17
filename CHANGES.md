# Training: SpeedRun + FreeFlow (dashboard-embedded)

## Install
1. Run `sql/2026-10-17_training_modes.sql` in the Supabase SQL editor (adds `training_sessions.mode`). Do this BEFORE deploying, the new routes select that column.
2. Copy these files over your project (same paths) and restart / redeploy.
3. Optional cleanup: the old retired routes `app/api/training/{answer,next,end,image}` can be deleted.

## What changed
- No more overall exam countdown for training (the 6:40:00). The header shows the clock of the question you are on.
- **FreeFlow**: no limit. Count-up stopwatch per question. Leave a question -> its clock stops; come back -> it continues from where it stopped.
- **SpeedRun**: 2 min per question, 3 min for Maths. Countdown per question (turns red at 15s). At 0 the selected answer is saved, the question is locked and the next opens; after the last question the attempt is submitted. One-way: no Previous, palette and subject tabs are display-only. Time is also clamped server-side on scoring.
- `/training` now redirects to `/dashboard/training` and runs inside the dashboard. In the Training space the left rail swaps to: SpeedRun, FreeFlow, Back to My Courses.
- Training home shows only the two mode cards; the subject / chapter / count setup lives inside each mode. "My attempts" is per mode.

## Files
NEW      sql/2026-10-17_training_modes.sql
NEW      app/dashboard/training/[[...mode]]/page.js
REPLACED app/training/page.js (redirect), app/training/TrainingClient.js, app/training/training.module.css
REPLACED app/dashboard/layout.js, components/dashboard/MainSidebar.js
REPLACED lib/training.js, lib/trainingExam.js
REPLACED app/api/training/{start,catalog,history}/route.js
REPLACED public/exam-engine.js, public/exam.html  (normal exams are untouched: every change is gated on the trn_ training token)
