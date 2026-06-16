import { Coffee } from "lucide-react";
import { TIP_JAR_URL } from "@/lib/monetization";

/**
 * "Buy me a coffee" support link. Renders nothing until a destination is
 * configured (NEXT_PUBLIC_TIP_JAR_URL), e.g. a Ko-fi or Buy Me a Coffee profile.
 * Web-only on purpose: Apple's guideline 3.2.1 forbids external donation links
 * in the iOS app, where support flows through the Pro in-app purchase instead.
 */
export default function TipJar({ className = "" }: { className?: string }) {
  if (!TIP_JAR_URL) return null;

  return (
    <a
      href={TIP_JAR_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 ${className}`}
    >
      <Coffee className="h-4 w-4" />
      Buy me a coffee
    </a>
  );
}
