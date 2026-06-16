"use client";

import Script from "next/script";
import { useAnalyticsConsent } from "@/hooks/useAnalyticsConsent";

const GA_MEASUREMENT_ID = "G-13MH57QZWG";

/**
 * Shows the consent banner and loads Google Analytics only after the visitor
 * opts in (GDPR consent requirement for an EU publisher). The same consent
 * choice also gates advertising (see AdSenseScript), so the banner covers both.
 */
export default function AnalyticsConsent() {
  const { consent, hydrated, choose } = useAnalyticsConsent();

  return (
    <>
      {consent === "accepted" && (
        <>
          <Script
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          />
          <Script
            id="gtag-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}', {
                  page_path: window.location.pathname,
                });
              `,
            }}
          />
        </>
      )}
      {hydrated && consent === null && (
        <div className="fixed bottom-0 inset-x-0 z-[100] bg-gray-900/95 backdrop-blur-md border-t border-white/10 text-white px-4 py-4 sm:px-6">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-4">
            <p className="text-sm text-gray-300 text-center sm:text-left">
              We use Google Analytics and advertising cookies to understand how
              visitors use this site and to keep it free. They only run if you
              accept. See our{" "}
              <a href="/privacy-policy" className="underline hover:text-white">
                Privacy Policy
              </a>{" "}
              for details.
            </p>
            <div className="flex gap-3 shrink-0">
              <button
                type="button"
                onClick={() => choose("declined")}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-white/20 hover:bg-white/10 transition-all"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => choose("accepted")}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
