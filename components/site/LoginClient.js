'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Ico } from './icons';
import { SITE } from '@/lib/siteConfig';
import s from './login.module.css';

// Sign-in.
//  - "Continue with Google" -> Supabase OAuth, returning straight to /dashboard
//  - any live session on this page -> session cookie is synced (respecting the
//    cookie-consent choice) and the student is sent to /dashboard
const AFTER_LOGIN = '/dashboard';

function syncSessionCookie(session) {
  try {
    let consent = null;
    const m = document.cookie.match(/(?:^|; )cookie_consent=([^;]*)/);
    consent = m ? decodeURIComponent(m[1]) : null;
    let c = `cet_session_token=${session.access_token}; path=/; SameSite=Lax`;
    if (consent === 'accepted') c += `; max-age=${60 * 60 * 24 * 7}`;
    if (window.location.protocol === 'https:') c += '; Secure';
    document.cookie = c;
  } catch (e) {}
}

const FEATURES = [
  { icon: 'book', t: 'Chapter-wise practice', d: 'Topic tests in the exam pattern' },
  { icon: 'chart', t: 'Performance analytics', d: 'Track accuracy, speed and weak areas' },
  { icon: 'file', t: 'Notes & study material', d: 'Organised by subject and chapter' },
];

export default function LoginClient() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try { setDark(document.documentElement.getAttribute('data-theme') === 'dark'); } catch (e) {}
    const go = (session) => {
      if (!session) return;
      syncSessionCookie(session);
      window.location.replace(AFTER_LOGIN);
    };
    supabase.auth.getSession().then(({ data }) => go(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => go(session));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn() {
    if (loading) return;
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${AFTER_LOGIN}` },
    });
    if (err) {
      console.error('OAuth Authentication Core Error:', err.message);
      setError('We could not start Google sign-in. Please try again.');
      setLoading(false);
    }
  }

  function toggleTheme() {
    const next = dark ? 'light' : 'dark';
    setDark(!dark);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
  }

  return (
    <div className={s.root}>
      {/* LEFT: brand panel */}
      <section className={s.panel}>
        <div className={s.brand}>
          <img className={s.brandLogo} src={SITE.logo} alt="Logo" />
        </div>

        <div className={s.mid}>
          <span className={s.pill}>Student portal</span>
          <h1 className={s.h1}>Learn smarter. <em>Practise better.</em></h1>
          <p className={s.lead}>Sign in to open your batches, attempt tests, review your performance and study from organised notes, all in one place.</p>
          <ul className={s.features}>
            {FEATURES.map((f) => (
              <li key={f.t}>
                <span className={s.featIcon}><Ico name={f.icon} size={18} /></span>
                <span><b>{f.t}</b><i>{f.d}</i></span>
              </li>
            ))}
          </ul>
        </div>

        <p className={s.copy}>© {new Date().getFullYear()} All rights reserved.</p>
      </section>

      {/* RIGHT: sign-in */}
      <section className={s.side}>
        <button type="button" className={s.theme} onClick={toggleTheme} aria-label="Toggle dark mode">
          <Ico name={dark ? 'moon' : 'sun'} size={19} />
        </button>

        <div className={s.card}>
          <img className={s.cardLogo} src={SITE.logo} alt="" />
          <h2 className={s.head}>Welcome</h2>
          <p className={s.sub}>Sign in with your Google account to continue to your dashboard. Your student account is created automatically the first time you sign in.</p>

          <button type="button" className={s.google} onClick={signIn} disabled={loading}>
            {loading ? (
              <span className={s.spin} aria-hidden="true" />
            ) : (
              <span className={s.gIcon}>
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84c-.21 1.12-.84 2.07-1.79 2.7v2.25h2.9c1.69-1.55 2.69-3.83 2.69-6.58z" fill="#4285F4" />
                  <path d="M9 18c2.43 0 4.47-.8 5.96-2.22l-2.9-2.25c-.8.54-1.83.87-3.06.87-2.35 0-4.34-1.58-5.05-3.71H.92v2.32C2.4 15.93 5.46 18 9 18z" fill="#34A853" />
                  <path d="M3.95 10.69c-.18-.54-.28-1.12-.28-1.69s.1-1.15.28-1.69V5.01H.92A8.993 8.993 0 0 0 0 9c0 1.45.35 2.82.92 4.04l3.03-2.35z" fill="#FBBC05" />
                  <path d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.8 11.43 0 9 0 5.46 0 2.4 2.07.92 5.01l3.03 2.32C4.66 5.16 6.65 3.58 9 3.58z" fill="#EA4335" />
                </svg>
              </span>
            )}
            {loading ? 'Opening Google…' : 'Continue with Google'}
          </button>
          {error && <p className={s.error} role="alert">{error}</p>}

          <ul className={s.trust}>
            <li><Ico name="lock" size={15} /> Secure sign-in</li>
            <li><Ico name="shield" size={15} /> We never see your password</li>
            <li><Ico name="bolt" size={15} /> Instant access</li>
          </ul>

          <p className={s.note}>Use the Google account registered with your institute. Need help? Contact your administrator.</p>
        </div>
      </section>
    </div>
  );
}
