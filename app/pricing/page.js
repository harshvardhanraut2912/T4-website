// app/pricing/page.js  (new file)
import PricingClient from "./PricingClient";

export const metadata = {
  title: "Pricing | Parikshiq",
  description:
    "Simple pricing for coaching institutes: ₹25 per student per month, ₹250 per student per year, or ₹20,000 for unlimited students. Every plan includes the student app, the teacher admin app and the website.",
  openGraph: {
    title: "Pricing | Parikshiq",
    description: "₹25 per student a month, ₹250 per student a year, or unlimited students for ₹20,000.",
    images: ["/images/other_images/Parikshiq-name.png"],
  },
};

export default function PricingPage() {
  return <PricingClient />;
}
