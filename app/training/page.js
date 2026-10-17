// 📂 SAVE AT: app/training/page.js   (REPLACE)
// Training now lives inside the dashboard. Old links / bookmarks keep working.
import { redirect } from 'next/navigation';

export default function TrainingRedirect() {
  redirect('/dashboard/training');
}
