// app/purchase/page.js  (new file)
import PurchaseClient from "./PurchaseClient";
import { fontVars } from "@/components/site/fonts";

export const metadata = {
  title: "Get Parikshiq for your institute | Parikshiq",
  description: "Tell us about your institute and we will set up your own exam platform, under your brand.",
};

export default function PurchasePage() {
  return (
    <div className={fontVars}>
      <PurchaseClient />
    </div>
  );
}
