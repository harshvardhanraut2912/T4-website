// app/HomeSeoSections.js  (new file)
// Server component: the detailed "what we do" section, the FAQ, and the JSON-LD
// structured data for the homepage. All text comes from lib/homeSeoContent.js.
import styles from './homeSeo.module.css';
import { DETAIL_BLOCKS, FAQ, EXAMS_COVERED, homeJsonLd } from '@/lib/homeSeoContent';

export function HomeJsonLd() {
  // "<" is escaped so the JSON can never close the script tag early.
  const json = JSON.stringify(homeJsonLd()).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export function HomeDetails() {
  return (
    <section className={styles.detailSection} id="in-detail" aria-labelledby="in-detail-title">
      <div className={styles.intro}>
        <span className={styles.label}>Parikshiq in detail</span>
        <h2 id="in-detail-title">Everything Parikshiq does for coaching institutes</h2>
        <p>
          Parikshiq prepares students for {EXAMS_COVERED.join(', ')} and runs the whole exam side of an institute
          under the institute’s own brand. We build it, host it and manage it, for a fee well below other platforms.
        </p>
      </div>
      <div className={styles.detailGrid}>
        {DETAIL_BLOCKS.map((b) => (
          <article className={styles.detailCard} key={b.id} id={b.id}>
            <h3>{b.title}</h3>
            <ul>
              {b.points.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

export function HomeFaq() {
  return (
    <section className={styles.faqSection} id="faq" aria-labelledby="faq-title">
      <div className={styles.intro}>
        <span className={styles.label}>Questions</span>
        <h2 id="faq-title">Frequently asked questions</h2>
        <p>Short answers about how Parikshiq works for your institute.</p>
      </div>
      <div className={styles.faqList}>
        {FAQ.map((f) => (
          <details className={styles.faqItem} key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
