import { ADSENSE_CLIENT } from "@/lib/monetization";

// Served at /ads.txt. Authorizes Google to sell this site's display-ad inventory
// (AdSense). Driven by NEXT_PUBLIC_ADSENSE_CLIENT, so it returns nothing until
// AdSense is configured. Note: ads.txt uses the bare "pub-…" seller id, i.e. the
// publisher id with the "ca-" prefix dropped.
export const dynamic = "force-static";

export function GET() {
  if (!ADSENSE_CLIENT) {
    return new Response("", { status: 404 });
  }

  const sellerId = ADSENSE_CLIENT.replace(/^ca-/, "");
  const body = `google.com, ${sellerId}, DIRECT, f08c47fec0942fa0\n`;

  return new Response(body, {
    headers: { "content-type": "text/plain" },
  });
}
