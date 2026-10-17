// lib/siteConfig.js
//
// ONE place for the brand + contact details. This is the neutral DEMO build:
// no institute name is hard-coded anywhere else in the admin panel.
// When you hand the engine to a client class, change the values here
// (and drop their logo at public/images/other_images/class-logo.png).
//
// Used by the admin PDF generators:
//   SITE.short  -> default diagonal watermark text on exam PDFs
//                  (override per deployment with env PDF_WATERMARK_TEXT)
//   SITE.short  -> organisation name printed on the leaderboard PDF

export const SITE = {
  name: 'T4 Academy',
  short: 'T4 Academy',
  tagline: 'More Than A Coaching Class',
  teacher: 'Instructor',
  city: '',
  logo: '/images/other_images/class-logo.png',
  policiesUpdated: '',
};

export const CONTACT = {
  phone: '',
  phoneHref: '',
  whatsapp: '',
  whatsappHref: '',
  email: '',
  privacyEmail: '',
  addressLines: [],
  addressOneLine: '',
  landmark: '',
  timings: [],
  grievanceOfficer: '',
};

export const MAP = {
  embed: '',
  link: '',
  directions: '',
};

// Business terms (only read by the public policy pages, which are removed in the demo build).
export const POLICY = {
  onlineRefundDays: 3,
  classroomAdminFeePct: 10,
  ackHours: 48,
  decisionDays: 5,
  initiateDays: '3–5',
  failedReversalDays: '5–7',
  escalateDays: 10,
  dataRequestDays: 30,
  accessSession: 'one active session at a time',
};
