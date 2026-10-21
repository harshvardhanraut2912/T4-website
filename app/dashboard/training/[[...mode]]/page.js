// 📂 SAVE AT: app/dashboard/training/[[...mode]]/page.js   (REPLACE)
//
// /dashboard/training              -> Training home (SpeedRun / FreeFlow / Ultimate Practice cards)
// /dashboard/training/speedrun     -> SpeedRun setup + attempts
// /dashboard/training/freeflow     -> FreeFlow setup + attempts
// /dashboard/training/ultimate     -> Ultimate Practice: pick chapters + your accuracy
// Rendered inside app/dashboard/layout.js (navbar + left rail).
import TrainingClient from '@/app/training/TrainingClient';
import UltimateClient from '@/app/training/UltimateClient';

export const metadata = {
  title: 'Training',
  description: 'SpeedRun, FreeFlow and Ultimate Practice.',
};

export default async function DashboardTrainingPage({ params }) {
  const { mode } = await params;
  const first = Array.isArray(mode) ? mode[0] : mode;
  return first === 'ultimate' ? <UltimateClient /> : <TrainingClient />;
}
