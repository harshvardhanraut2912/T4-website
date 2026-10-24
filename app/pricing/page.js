// app/pricing/page.js
import PricingClient from "./PricingClient";
import { PLANS } from "@/lib/pricingPlans";
import { SITE_URL } from "@/lib/siteConfig";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Pricing | Parikshiq",
  description:
    "Simple pricing for coaching institutes: ₹25 per student per month, ₹250 per student per year, or ₹20,000 for up to 150 students and ₹30,000 for unlimited students. Every plan includes the student app, the teacher admin app and the website. Book a demo to get started.",
  alternates: { canonical: "/pricing" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "Parikshiq",
    url: "/pricing",
    title: "Pricing | Parikshiq",
    description: "₹25 per student a month, ₹250 per student a year, or unlimited students for ₹30,000. Book a demo.",
    images: ["/images/other_images/Parikshiq-name.png"],
  },
};

export default function PricingPage() {
  const offers = PLANS.map((p) => ({
    "@type": "Offer",
    name: p.tag,
    description: `${p.blurb} Billed ${p.unit}.`,
    price: String(p.price),
    priceCurrency: "INR",
    url: `${SITE_URL}/pricing`,
    availability: "https://schema.org/InStock",
  }));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Parikshiq white-label exam platform for coaching institutes",
    description:
      "Student app, teacher admin app and website under the institute's own brand, for MHT-CET, JEE and NEET preparation. Book a free demo to get started.",
    provider: { "@type": "Organization", name: "Parikshiq", url: SITE_URL },
    areaServed: { "@type": "Country", name: "India" },
    offers,
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <PricingClient />
    </>
  );
}
