import LoginClient from '@/components/site/LoginClient';
import { fontVars } from '@/components/site/fonts';

export const metadata = {
  title: 'Student Login | T4 Academy',
  description: 'Sign in to the T4 Academy student portal to access your batches, tests, analytics and notes.',
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <div className={fontVars}>
      <LoginClient />
    </div>
  );
}
