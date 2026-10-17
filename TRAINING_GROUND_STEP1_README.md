# Training Ground — Step 1 (exam engine + per-attempt rows + history + speed)

## Install order
1. Run `sql/2026-10-17_training_ground_v2.sql` in the Supabase SQL editor (safe to re-run).
2. Copy the files in this zip over your project (same paths).
3. Restart `npm run dev` / redeploy.

## Files
NEW      sql/2026-10-17_training_ground_v2.sql
NEW      lib/trainingExam.js
NEW      app/api/training/history/route.js
REPLACED lib/training.js
REPLACED app/training/TrainingClient.js
REPLACED app/training/training.module.css   (only additions at the bottom)
REPLACED app/api/training/catalog/route.js
REPLACED app/api/training/start/route.js
RETIRED  app/api/training/{answer,next,end,image}/route.js   (now return 410; safe to delete the folders)
PATCHED  app/api/exam/{manifest,question-chunk,save-progress,submit,review,leaderboard,image-proxy,report-error,start}/route.js
         (each only gets an early `if (isTrainingToken(token))` branch; exam behaviour is unchanged)
