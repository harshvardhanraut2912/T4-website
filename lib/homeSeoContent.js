// lib/homeSeoContent.js  (new file)
// All the detailed information about Parikshiq, written once and used for:
//   1. the visible "In detail" and FAQ sections on the homepage,
//   2. the JSON-LD structured data (read by Google and by AI crawlers),
//   3. /llms.txt (a plain-text summary for AI assistants).
// To change a fact, edit it here.

import { PLANS } from '@/lib/pricingPlans';
import { SITE_URL, SITE_NAME, LOGO_URL } from '@/lib/seoConfig';

export const EXAMS_COVERED = ['MHT-CET', 'JEE', 'NEET'];

export const SUMMARY =
  'Parikshiq is a white-label online exam and practice platform for coaching institutes and tutors in India. ' +
  'It prepares students for MHT-CET, JEE and NEET. Institutes get a student app, a teacher admin app and a website, ' +
  'all running under the institute’s own name, logo and colours. Parikshiq stays invisible to students. ' +
  'Everything is built, hosted and managed by Parikshiq for a small fee.';

/* Visible "in detail" blocks on the homepage */
export const DETAIL_BLOCKS = [
  {
    id: 'what-we-do',
    title: 'What Parikshiq does for institutes',
    points: [
      'Prepares students for MHT-CET, JEE and NEET exams, on a platform an institute can run as its own.',
      'Lets an institute host online exams, host online lectures, take exams of its students and share study resources with them.',
      'Provides three connected products: a student app, an app for the institute and its teachers, and a website with a student portal.',
      'Builds, hosts and manages everything. The institute has no servers, software or manual checking to look after.',
      'Takes requested changes to an institute’s portal, and supports the pages Parikshiq hosts for it.',
    ],
  },
  {
    id: 'white-label',
    title: 'Under your institute’s brand only',
    points: [
      'Parikshiq’s logo and name are not shown anywhere on an institute’s pages or apps.',
      'Students see the institute’s own name, logo and colours on the website, the student app and the teacher app.',
      'Nobody needs to know the exams are conducted using Parikshiq.',
    ],
  },
  {
    id: 'student-features',
    title: 'What students get',
    points: [
      'A personal dashboard on the institute’s website, with a login and password for each student.',
      'Scheduled online mock tests, taken on a phone or computer.',
      'A detailed result after every test: marks, and how much was scored in each chapter of each subject.',
      'Review of the full question paper after the test.',
      'Unlimited MHT-CET practice from a question bank of 40,000+ questions, with previous-year questions (PYQs) kept up to date in the database.',
      'Four practice modes: Freeflow (no time pressure, accuracy is the score), Speedrun (beat the clock), PYQ Arena (previous-year questions topic by topic) and Ultimate Practice (pick your topics and practise without limit).',
      'Exams made from previous-year questions, so students can sit a PYQ paper as a real test.',
    ],
  },
  {
    id: 'teacher-features',
    title: 'What the institute and teachers get',
    points: [
      'Create papers by choosing questions, schedule exams and deploy them to students.',
      'See every student’s current progress and every exam’s marks.',
      'Open any student to see their score in each exam, their strongest subject and their weakest subject, and chapter-wise accuracy.',
      'Print a report for any student.',
      'Print the leaderboard of any exam.',
      'Review each student’s paper, the same way the student can.',
    ],
  },
  {
    id: 'offline-omr',
    title: 'Offline exams and OMR checking',
    points: [
      'Generate question paper PDFs in the institute’s own format and run the exam offline, at the coaching centre.',
      'Print an OMR sheet for every student on plain A4 paper.',
      'Scan the OMR sheets with the teacher app. Answers are checked against the exam automatically, with no manual work.',
      'Declare results when ready, and students see them in their app.',
    ],
  },
  {
    id: 'managed-service',
    title: 'Fully managed, with demo and support',
    points: [
      'Everything is automated and managed by Parikshiq.',
      'Changes to an institute’s portal can be requested and Parikshiq makes them.',
      'A demo is available for any institute before it books. Use the demo request form.',
      'Priced well below other platforms that offer the same features to coaching institutes.',
    ],
  },
];

export const FAQ = [
  {
    q: 'What is Parikshiq?',
    a: 'Parikshiq is a white-label exam platform for coaching institutes and tutors. It gives an institute a student app, a teacher admin app and a website, all under the institute’s own brand, to run online exams, offline OMR exams and student practice for MHT-CET, JEE and NEET.',
  },
  {
    q: 'Which exams does Parikshiq prepare students for?',
    a: 'MHT-CET, JEE and NEET. The practice question bank for MHT-CET has more than 40,000 questions, including previous-year questions.',
  },
  {
    q: 'Will our students see the Parikshiq brand?',
    a: 'No. Every page and app carries only your institute’s name, logo and colours. Students and parents see your institute, and nothing says the exams run on Parikshiq.',
  },
  {
    q: 'Can we run online exams and offline exams?',
    a: 'Yes. For online exams you build the paper, schedule it, and students take it on their phones. For offline exams you generate the question paper PDF and an OMR sheet per student, print them, and scan the OMR sheets with the teacher app. Answers are checked automatically.',
  },
  {
    q: 'What can students practise on their own?',
    a: 'Students get unlimited MHT-CET questions in four modes: Freeflow, Speedrun, PYQ Arena and Ultimate Practice. They also see a detailed report after each session, with chapter-wise accuracy.',
  },
  {
    q: 'What can teachers see about each student?',
    a: 'Every student’s progress, marks in every exam, strongest and weakest subject, chapter-wise accuracy, and the student’s paper review. Teachers can print a student report and the leaderboard of any exam.',
  },
  {
    q: 'Can we host online lectures and share resources?',
    a: 'Yes. Institutes can host online lectures and provide study resources to their students through the platform. Ask for a demo to see how it is set up for your institute.',
  },
  {
    q: 'How much does Parikshiq cost?',
    a: 'Student-wise plans cost ₹25 per student per month or ₹250 per student per year. Flat plans cost ₹20,000 per year for up to 150 students or ₹30,000 per year for unlimited students. Every plan includes the student app, the teacher admin app and the website. Book a demo and we confirm the plan that fits your institute.',
  },
  {
    q: 'Can we get a demo first?',
    a: 'Yes. Request a free demo and we show you the apps and website with your institute’s name on them before you choose a plan.',
  },
  {
    q: 'Who manages the platform and makes changes?',
    a: 'Parikshiq builds, hosts and manages it. If your institute wants a change in its portal, ask us and we make it. We also support the pages we host for you.',
  },
];

/* ---------------- JSON-LD (structured data) ---------------- */

export function homeJsonLd() {
  const offers = PLANS.map((p) => ({
    '@type': 'Offer',
    name: p.tag,
    description: `${p.blurb} Billed ${p.unit}.`,
    price: String(p.price),
    priceCurrency: 'INR',
    url: `${SITE_URL}/pricing`,
    availability: 'https://schema.org/InStock',
  }));

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: LOGO_URL,
        description: SUMMARY,
        areaServed: { '@type': 'Country', name: 'India' },
        knowsAbout: ['MHT-CET preparation', 'JEE preparation', 'NEET preparation', 'online exams', 'OMR sheet checking', 'white-label exam platform for coaching institutes'],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: SUMMARY,
        inLanguage: 'en-IN',
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'WebPage',
        '@id': `${SITE_URL}/#webpage`,
        url: SITE_URL,
        name: 'Parikshiq | White-label exam platform for coaching institutes',
        isPartOf: { '@id': `${SITE_URL}/#website` },
        about: { '@id': `${SITE_URL}/#service` },
        inLanguage: 'en-IN',
      },
      {
        '@type': 'Service',
        '@id': `${SITE_URL}/#service`,
        name: 'Parikshiq white-label exam platform for coaching institutes',
        serviceType: 'Online exam, OMR checking and student practice platform',
        provider: { '@id': `${SITE_URL}/#organization` },
        areaServed: { '@type': 'Country', name: 'India' },
        audience: { '@type': 'Audience', audienceType: 'Coaching institutes, tutors, teachers and students preparing for MHT-CET, JEE and NEET' },
        description: SUMMARY,
        brand: { '@type': 'Brand', name: SITE_NAME },
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: 'Parikshiq plans',
          itemListElement: offers,
        },
        offers,
        potentialAction: { '@type': 'ReserveAction', name: 'Book a free demo', target: `${SITE_URL}/purchase?demo=1` },
      },
      {
        '@type': 'ItemList',
        '@id': `${SITE_URL}/#features`,
        name: 'What Parikshiq offers',
        itemListElement: DETAIL_BLOCKS.flatMap((b) => b.points.map((pt) => ({ title: b.title, pt }))).map((x, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: x.title,
          description: x.pt,
        })),
      },
      {
        '@type': 'FAQPage',
        '@id': `${SITE_URL}/#faq`,
        mainEntity: FAQ.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };
}

/* ---------------- llms.txt text ---------------- */

export function llmsText() {
  const lines = [];
  lines.push(`# ${SITE_NAME}`, '', `> ${SUMMARY}`, '');
  lines.push(`Website: ${SITE_URL}`, `Exams covered: ${EXAMS_COVERED.join(', ')}`, '');
  for (const b of DETAIL_BLOCKS) {
    lines.push(`## ${b.title}`);
    b.points.forEach((p) => lines.push(`- ${p}`));
    lines.push('');
  }
  lines.push('## Pricing (INR)');
  PLANS.forEach((p) => lines.push(`- ${p.tag}: ₹${p.price.toLocaleString('en-IN')} ${p.unit}`));
  lines.push('- Every plan includes the student app, the teacher admin app and the website. Book a demo and we confirm the plan.', '');
  lines.push('## Pages');
  lines.push(`- Home: ${SITE_URL}/`, `- Pricing: ${SITE_URL}/pricing`, `- Book a free demo: ${SITE_URL}/purchase?demo=1`, '');
  lines.push('## Frequently asked questions');
  FAQ.forEach((f) => lines.push(`### ${f.q}`, f.a, ''));
  return lines.join('\n');
}
