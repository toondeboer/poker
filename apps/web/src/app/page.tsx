import { SITE_URL } from "@poker/core";
import LandingPage from "@/app/components/LandingPage";

const softwareApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Poker Blinds Buzzer",
  applicationCategory: "SportsApplication",
  operatingSystem: "iOS, Android, Web",
  url: SITE_URL,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        // Static, hand-written JSON — not user input.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationJsonLd),
        }}
      />
      <LandingPage />
    </>
  );
}
