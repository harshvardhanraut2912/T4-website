import './globals.css';
import Script from "next/script";
import PresenceTracker from '@/components/common/PresenceTracker';
import ProfileOnboarding from '@/components/onboarding/ProfileOnboarding';

export const metadata = {
  title: 'Parikshiq | Prepare smarter. Perform better.',
  description: 'A focused learning and exam practice platform for students. Practise with purpose and progress with confidence.',
  icons: {
    icon: '/images/other_images/class-logo.png',
    shortcut: '/images/other_images/class-logo.png',
    apple: '/images/other_images/class-logo.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

  <Script
    src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs/loader.min.js"
    strategy="beforeInteractive"
  />

  <Script
    id="theme-init"
    strategy="beforeInteractive"
    dangerouslySetInnerHTML={{
      __html: `
        (function() {
          try {
            var t = localStorage.getItem('theme') || 'light';
            document.documentElement.setAttribute('data-theme', t);
          } catch (e) {}
        })();
      `,
    }}
  />
</head>
      <body>
        {/* Notice: Navbar and Footer are GONE. It only renders the page now. */}
        <PresenceTracker />
        <ProfileOnboarding />
        {children}
      </body>
    </html>
  );
}