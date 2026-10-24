import Image from 'next/image';
import styles from './home.module.css';
import { MotionInit, BrandPreview, ExamFlow, PhoneShowcase } from './HomeClient';
import { HomeJsonLd, HomeDetails, HomeFaq } from './HomeSeoSections';
import { SITE_URL } from '@/lib/seoConfig';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Parikshiq | Your institute’s exam platform, under your brand',
  description: 'White-label exam platform for coaching institutes preparing students for MHT-CET, JEE and NEET: online mock tests, OMR exams checked from the teacher app, question PDFs in your format, a student practice app with 40,000+ MHT-CET questions and chapter-wise reports. Free demo available.',
  keywords: ['white-label exam platform', 'coaching institute software', 'MHT-CET online test platform', 'JEE NEET online exams for institutes', 'OMR sheet checking app', 'online test series for coaching classes', 'MHT-CET practice questions', 'PYQ practice', 'student performance reports', 'Parikshiq'],
  alternates: { canonical: '/' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  openGraph: {
    type: 'website',
    siteName: 'Parikshiq',
    url: '/',
    title: 'Parikshiq | Your institute’s exam platform, under your brand',
    description: 'Run exams, check OMR sheets and track every student under your own institute name.',
    images: ['/images/other_images/Parikshiq-name.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Parikshiq | Your institute’s exam platform, under your brand',
    description: 'White-label online exams, OMR checking and student practice for MHT-CET, JEE and NEET institutes.',
    images: ['/images/other_images/Parikshiq-name.png'],
  },
};

const capabilities = [
  { icon: '◈', title: 'Your brand, everywhere', description: 'Your institute’s name, logo and colours on the website, student app and teacher app. Parikshiq stays out of sight.' },
  { icon: '▤', title: 'Online mock tests in a few clicks', description: 'Pick questions, schedule the exam, deploy it to students and declare results when you are ready.' },
  { icon: '▣', title: 'OMR exams, no manual checking', description: 'Hand out OMR sheets, scan them in the teacher app, and answers are checked against the exam automatically.' },
  { icon: '✦', title: 'Question PDFs in your format', description: 'Generate printable question papers with your institute’s name and layout.' },
  { icon: '◷', title: 'Practice students come back to', description: 'A 40,000+ MHT-CET question bank with previous-year questions, in four practice modes.' },
  { icon: '↗', title: 'A report on every student', description: 'Scores for each exam and accuracy for each chapter, subject by subject.' },
];

const modes = [
  { key: 'speed', title: 'Speedrun', text: 'How fast you answer is what counts. Beat the clock, question after question.' },
  { key: 'flow', title: 'Freeflow', text: 'No rush. Accuracy is the score.' },
  { key: 'arena', title: 'PYQ Arena', text: 'Every previous-year question, sorted topic by topic.' },
  { key: 'ultimate', title: 'Ultimate Practice', text: 'Choose your topics and practise without limit.' },
];

const modeArt = {
  speed: <span className={styles.mRace}><b style={{ '--d': '1.2s' }} /><b style={{ '--d': '1.9s' }} /><b style={{ '--d': '2.6s' }} /></span>,
  flow: <span className={styles.mTicks}>{['✓', '✓', '✕', '✓', '✓'].map((t, k) => <i key={k} data-x={t === '✕' || undefined} style={{ '--k': k }}>{t}</i>)}<em>80%</em></span>,
  arena: <span className={styles.mChips}>{['Solutions', 'Chemical kinetics', 'Electrochemistry'].map((t, k) => <i key={t} style={{ '--k': k }}>{t}</i>)}</span>,
  ultimate: <span className={styles.mInf}>∞</span>,
};

const chapters = [
  { name: 'Solutions', value: 86 },
  { name: 'Electrochemistry', value: 78 },
  { name: 'Chemical kinetics', value: 61 },
  { name: 'Thermodynamics', value: 42 },
];

const platforms = [
  { title: 'Student app', label: 'For learners', text: 'Students take scheduled exams, practise in training mode and see their own progress.', glyph: '▣' },
  { title: 'Teacher app', label: 'For your teachers', text: 'Build papers, schedule exams, scan OMR sheets and review reports from one place.', glyph: '⌘' },
  { title: 'Institute website', label: 'For every screen', text: 'A website and student portal that carry your institute’s name and look.', glyph: '↗' },
];

const pricePoints = [
  { label: 'Student-wise · Monthly', price: '25', unit: 'per student / month' },
  { label: 'Student-wise · Yearly', price: '250', unit: 'per student / year' },
  { label: 'Up to 150 students', price: '20,000', unit: 'per year' },
  { label: 'Unlimited students', price: '30,000', unit: 'per year', dark: true },
];

export default function HomePage() {
  return (
    <main className={styles.site}>
      <MotionInit />
      <HomeJsonLd />
      <div className={styles.announcement}>
        <span className={styles.announcementDot} />
        Your brand, our engine: exam technology for coaching institutes
        <span className={styles.announcementArrow}>↗</span>
      </div>

      <header className={styles.header}>
        <a href="/" className={styles.brand} aria-label="Parikshiq home">
          <Image src="/images/other_images/class-logo.png" alt="" width={48} height={48} className={styles.logo} priority />
          <span>Parikshiq<span className={styles.brandDot}>.</span></span>
        </a>
        <nav className={styles.nav} aria-label="Main navigation">
          <a href="#solutions">Solutions</a>
          <a href="#flow">Exam flow</a>
          <a href="#student-app">Student app</a>
          <a href="#reports">Reports</a>
          <a href="#faq">FAQ</a>
          <a href="/pricing">Pricing</a>
        </nav>
        <div className={styles.headerActions}>
          <a className={styles.loginLink} href="/login">Student login <span>↗</span></a>
          <a className={styles.primaryButton} href="/purchase?demo=1">Get free demo <span>→</span></a>
        </div>
      </header>

      <section className={styles.hero} id="top">
        <div className={styles.heroGlow} />
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}><span className={styles.eyebrowIcon}>✳</span> White-label exam platform</div>
          <h1>Your institute.<br />Your exams.<br /><span>Your brand.</span></h1>
          <p className={styles.heroText}>Run online tests, check OMR sheets from the teacher app, print question papers in your format and give students a practice app. Our engine works behind the scenes. Students only ever see your name.</p>
          <div className={styles.heroButtons}>
            <a className={styles.primaryButton} href="/purchase?demo=1">Get free demo <span>→</span></a>
            <a className={styles.pricingButton} href="/pricing">See our pricing <span>₹</span></a>
            <a className={styles.secondaryButton} href="#flow"><span className={styles.playIcon}>▶</span> See how an exam runs</a>
          </div>
          <div className={styles.heroNote}><span className={styles.checkCircle}>✓</span> Built for teachers, institute teams and students.</div>
        </div>
        <BrandPreview />
      </section>

      <section className={styles.trustStrip} aria-label="Parikshiq capabilities">
        <span>WHAT YOU GET</span>
        <div><i>◈</i> Your name and logo</div><div><i>▣</i> Online and OMR exams</div><div><i>↗</i> Chapter-wise reports</div>
      </section>

      <section className={styles.featuresSection} id="solutions">
        <div className={styles.sectionIntro}>
          <span className={styles.sectionLabel}>The Parikshiq solution</span>
          <h2>Everything your institute needs, under your name.</h2>
          <p>From setting a paper to reading a student’s chapter report, it all lives in one platform that looks like yours.</p>
        </div>
        <div className={styles.featureGrid}>
          {capabilities.map((f) => (
            <article className={styles.featureCard} key={f.title}>
              <div className={styles.featureCardTop}><span className={styles.featureIcon}>{f.icon}</span></div>
              <h3>{f.title}</h3><p>{f.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.flowSection} id="flow">
        <div className={styles.sectionIntro}>
          <h2>Every exam you run, from paper to result</h2>
          <p>Choose how you want to run it. The steps stay short either way.</p>
        </div>
        <ExamFlow />
      </section>

      <section className={styles.studentSection} id="student-app">
        <div className={styles.studentCopy}>
          <span className={styles.sectionLabel}>Students app</span>
          <h2>Exams and practice, <span>in every student’s pocket.</span></h2>
          <p>One app that carries your institute’s name. Students sit the tests you set, and train on their own in between.</p>
          <div className={styles.studentPoint}>
            <i>📝</i>
            <div><h3>Mock tests scheduled by the teacher</h3><p>Students get the exam you scheduled, take it on their phone and see their result when you declare it.</p></div>
          </div>
          <div className={styles.studentPoint}>
            <i>🎯</i>
            <div>
              <h3>A training section with four modes</h3>
              <p>Students choose how many questions to practise and how, entirely on their own.</p>
              <div className={styles.trainTags}>
                <span className={`${styles.trainTag} ${styles.tFree}`}><b />Freeflow</span>
                <span className={`${styles.trainTag} ${styles.tSpeed}`}><b />Speedrun</span>
                <span className={`${styles.trainTag} ${styles.tPyq}`}><b />PYQ Arena</span>
                <span className={`${styles.trainTag} ${styles.tGold}`}><b />Ultimate Practice</span>
              </div>
            </div>
          </div>
          <div className={styles.studentPoint}>
            <i>📊</i>
            <div><h3>A detailed report after every session</h3><p>Chapter-wise accuracy, attempts and more, so students know exactly what to revise.</p></div>
          </div>
        </div>
        <PhoneShowcase />
      </section>

      <section className={styles.modesSection} id="practice-modes">
        <div className={styles.sectionIntro}>
          <span className={styles.sectionLabel}>The student app</span>
          <h2>Four ways for students to practise</h2>
          <p>Students sit the exams you schedule, and train in between with previous-year questions.</p>
        </div>
        <div className={styles.modeGrid} data-reveal>
          {modes.map((m, k) => (
            <article className={styles.modeCard} key={m.key} style={{ '--n': k }}>
              <div className={styles.modeArt}>{modeArt[m.key]}</div>
              <h3>{m.title}</h3>
              <p>{m.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.reportSection} id="reports">
        <div className={styles.processIntro}>
          <span className={styles.sectionLabel}>Teacher reports</span>
          <h2>See where each student stands</h2>
          <p>Open any student to see their score in every exam and their accuracy in every chapter of every subject. Spot weak chapters before the next test.</p>
        </div>
        <div className={styles.reportCard} data-reveal>
          <div className={styles.reportHead}><strong>Aarav Sharma</strong><span>Chemistry · chapter accuracy</span></div>
          {chapters.map((c, k) => (
            <div className={styles.reportRow} key={c.name} style={{ '--k': k }}>
              <span>{c.name}</span>
              <span className={styles.reportTrack}><b data-level={c.value >= 75 ? 'high' : c.value >= 50 ? 'mid' : 'low'} style={{ '--w': `${c.value}%` }} /></span>
              <em>{c.value}%</em>
            </div>
          ))}
          <div className={styles.reportExams}>
            <span>Last five exams</span>
            <div>{[58, 64, 61, 72, 78].map((v, k) => <i key={k} style={{ '--h': `${v}%`, '--k': k }}><b>{v}</b></i>)}</div>
          </div>
        </div>
      </section>

      <HomeDetails />

      <section className={styles.priceTeaser} id="pricing" data-reveal>
        <div className={styles.ptHead}>
          <span className={styles.sectionLabel}>Simple pricing</span>
          <h2>Pay per student, or one flat price.</h2>
          <p>Every plan includes the student app, the teacher admin app and the website.</p>
        </div>
        <div className={styles.ptGrid}>
          {pricePoints.map((p, k) => (
            <a href="/pricing" className={`${styles.ptCard} ${p.dark ? styles.ptDark : ''}`} key={p.label} style={{ '--n': k }}>
              <span>{p.label}</span>
              <strong><i>₹</i>{p.price}</strong>
              <small>{p.unit}</small>
            </a>
          ))}
        </div>
        <div className={styles.ptActions}>
          <a href="/pricing" className={styles.primaryButton}>See our pricing <span>→</span></a>
          <a href="/purchase?demo=1" className={styles.ptLink}>or get a free demo first <span>↗</span></a>
        </div>
      </section>

      <section className={styles.platformSection} id="platforms">
        <div className={styles.sectionIntro}>
          <span className={styles.sectionLabel}>Three connected products</span>
          <h2>One institute, three ways to connect</h2>
          <p>Each person gets the right experience, and every screen carries your branding.</p>
        </div>
        <div className={styles.platformGrid}>
          {platforms.map((p) => (
            <article className={styles.platformCard} key={p.title}>
              <div className={styles.platformTop}><span className={styles.platformGlyph}>{p.glyph}</span></div>
              <span className={styles.platformLabel}>{p.label}</span>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </article>
          ))}
        </div>
        <div className={styles.buildBanner}>
          <div><span className={styles.sectionLabel}>Built around your institute</span><h3>Want your own app and website?</h3><p>We set up the platform with your name, logo and colours, so students see your institute and nothing else.</p></div>
          <div className={styles.bannerBtns}>
            <a href="/purchase?demo=1" className={styles.primaryButton}>Get free demo <span>→</span></a>
            <a href="/pricing" className={styles.outlineButton}>See pricing <span>→</span></a>
          </div>
        </div>
      </section>

      <HomeFaq />

      <section className={styles.ctaSection} id="contact">
        <div className={styles.ctaPattern} />
        <div className={styles.ctaLogo}><Image src="/images/other_images/Parikshiq-name.png" alt="Parikshiq" width={160} height={160} /></div>
        <div className={styles.ctaCopy}><span>For coaching institutes</span><h2>Let’s build your institute’s exam platform.</h2><p>Online exams, OMR checking, question PDFs and student apps, all under your own brand.</p></div>
        <div className={styles.ctaBtns}>
          <a href="/purchase?demo=1" className={styles.ctaButton}>Get free demo <span>→</span></a>
          <a href="/pricing" className={styles.ctaGhost}>See our pricing <span>→</span></a>
        </div>
      </section>

      <footer className={styles.footer}>
        <a href="/" className={styles.footerBrand}><Image src="/images/other_images/class-logo.png" alt="" width={38} height={38} /><span>Parikshiq<span className={styles.brandDot}>.</span></span></a>
        <p>Exam technology and digital tools for coaching institutes.</p>
        <div><a href="#solutions">Solutions</a><a href="#flow">Exam flow</a><a href="#faq">FAQ</a><a href="/pricing">Pricing</a><a href="/login">Student login</a></div>
        <span className={styles.copyright}>© {new Date().getFullYear()} Parikshiq</span>
      </footer>
    </main>
  );
}
