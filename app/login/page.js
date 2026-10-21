import LoginClient from '@/components/site/LoginClient';
import { fontVars } from '@/components/site/fonts';

export const metadata = {
  title: 'Student Login',
  description: 'Sign in to the student portal to access your batches, tests, analytics and notes.',
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <div className={fontVars}>
      <LoginClient />
    </div>
  );
}
