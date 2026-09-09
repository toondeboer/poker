// src/components/paywall/Paywall.tsx
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SITE_URL } from "@poker/core";
import { colors, radius, space, text } from "@/src/theme";
import { usePremium } from "@/src/contexts/PremiumContext";
import { Sheet } from "@/src/components/ui/Sheet";

/**
 * What Pro actually buys, in the order somebody decides by.
 *
 * **This list has to be checked against the app every release.** It was found
 * selling the previous version's feature set during 1.2.0 — the screen where
 * people decide to pay was describing an app with fewer things in it than the
 * one they had just been using. Dealing a hand is the headline of this release
 * and was missing from here entirely.
 */
const PRO_FEATURES = [
  "Remove all ads — a clean, full-screen timer",
  "Deal the cards when you have chips but nothing to deal",
  "Work out buy-ins, payouts and bounties",
  "Keep a leaderboard for every group you play with",
  "Save & load tournament presets",
  "Choose your alarm sound",
  "Support an indie developer",
];

/**
 * The Pro upgrade sheet. Wired to {@link usePremium} so it works against the
 * stub today and against RevenueCat once that's added — no change needed here.
 * Includes Restore Purchases, which Apple requires for non-consumable IAPs.
 *
 * Uses the shared {@link Sheet} so there is one sheet implementation rather than
 * two that drift — the backdrop was fixed to fade in place in `Sheet` and this
 * screen kept sliding it because it had its own copy. Gesture dismissal is
 * deliberately off: the paywall keeps its explicit "Maybe later", since how
 * easily it can be dismissed is a product decision, not a styling one.
 */
export function Paywall({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const {
    isPremium,
    hasClub,
    ownsProOutright,
    purchasing,
    proPriceString,
    refreshProPrice,
    purchasePro,
    clubPlans,
    refreshClubPlans,
    purchaseClub,
    restore,
  } = usePremium();
  const [error, setError] = useState<string | null>(null);

  // Re-attempt the price every time the sheet opens. The launch-time fetch can
  // lose a race with SDK configuration or a cold network, and it used to be the
  // only one — so the sheet stayed price-less for the whole session even though
  // the offering resolves fine by the time anyone taps Unlock. Tracked on the
  // closed→open edge during render (same pattern as GenerateStructureSheet's
  // seeding) so the request is already in flight as the sheet animates in.
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (visible) {
      refreshProPrice();
      // Same edge, same reason: the plans are wanted before the sheet has
      // finished animating in, not after somebody has looked at an empty space.
      refreshClubPlans();
    }
  }

  // With no price, the button says what it does and the subtitle already says
  // "One-time unlock" — the old fallback rendered "Unlock Pro · one-time",
  // which reads as though "one-time" were the price.
  const buyLabel = proPriceString
    ? `Unlock Pro · ${proPriceString}`
    : "Unlock Pro";

  const run = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      gestureDismissible={false}
      maxContentHeightRatio={0.72}
    >
      <Text style={styles.title}>Poker Blinds Buzzer Pro</Text>
      <Text style={styles.subtitle}>One-time unlock. Yours forever.</Text>

      <View style={styles.features}>
        {PRO_FEATURES.map((feature) => (
          <View key={feature} style={styles.featureRow}>
            <Text style={styles.check}>✓</Text>
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      {isPremium ? (
        <View style={styles.unlockedBox}>
          <Text style={styles.unlockedText}>
            {hasClub && !ownsProOutright
              ? "✓ Pro is included with Club — thank you!"
              : "✓ Pro unlocked — thank you!"}
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.buyButton, purchasing && styles.disabled]}
          onPress={() => run(purchasePro)}
          disabled={purchasing}
          activeOpacity={0.85}
        >
          {purchasing ? (
            <ActivityIndicator color="#1f2937" />
          ) : (
            <Text style={styles.buyButtonText}>{buyLabel}</Text>
          )}
        </TouchableOpacity>
      )}

      {/**
       * **The Club section, and the three things Apple requires on it.**
       *
       * Guideline 3.1.2 wants a subscription's title, the length of its
       * period and its price shown *in the app* — not only in the store — plus
       * working links to the Terms of Use and the Privacy Policy. All five are
       * here, and the links are the reason `/terms` exists.
       *
       * Absent entirely when there are no plans, which is the state until the
       * subscriptions are live in both stores. Advertising something nobody can
       * buy is worse than saying nothing.
       */}
      {clubPlans.length > 0 && !hasClub ? (
        <View style={styles.club}>
          <Text style={styles.clubTitle}>Club</Text>
          <Text style={styles.clubBlurb}>
            Share a leaderboard and your clock with the people you play with.
            {"\n"}
            <Text style={styles.clubFree}>
              Joining a board somebody shares is always free
            </Text>{" "}
            — only the person sharing subscribes. Includes everything in Pro.
          </Text>

          {clubPlans.map((plan) => (
            <TouchableOpacity
              key={plan.id}
              style={[styles.clubButton, purchasing && styles.disabled]}
              onPress={() => run(() => purchaseClub(plan.id))}
              disabled={purchasing}
              activeOpacity={0.85}
            >
              <Text style={styles.clubButtonText}>
                {plan.period === "monthly" ? "Monthly" : "Annual"} ·{" "}
                {plan.priceString}
                {plan.period === "monthly" ? " / month" : " / year"}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Required wording: it renews until cancelled, and where to cancel. */}
          <Text style={styles.clubTerms}>
            Renews automatically until cancelled. Manage or cancel it in your{" "}
            {Platform.OS === "ios" ? "App Store" : "Play Store"} account
            settings.
          </Text>

          {/* **Functional links, not text.** 3.1.2 asks for links that work. */}
          <View style={styles.legalRow}>
            <TouchableOpacity
              onPress={() => void Linking.openURL(`${SITE_URL}/terms`)}
              activeOpacity={0.7}
            >
              <Text style={styles.legalLink}>Terms of Use</Text>
            </TouchableOpacity>
            <Text style={styles.legalDot}>·</Text>
            <TouchableOpacity
              onPress={() => void Linking.openURL(`${SITE_URL}/privacy-policy`)}
              activeOpacity={0.7}
            >
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/**
       * **Always offered, never hidden behind `isPremium`.**
       *
       * Apple requires a restore path for a non-consumable, and hiding it from
       * anybody the app *believes* is unlocked is precisely backwards: the
       * person who most needs it is the one whose purchase this device has not
       * recognised. Club made that reachable — a subscriber reads as unlocked,
       * so a Pro purchase made on another device had no way back.
       */}
      <TouchableOpacity
        style={styles.restoreButton}
        onPress={() => run(restore)}
        disabled={purchasing}
        activeOpacity={0.7}
      >
        <Text style={styles.restoreText}>Restore purchases</Text>
      </TouchableOpacity>

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeText}>
          {isPremium ? "Done" : "Maybe later"}
        </Text>
      </TouchableOpacity>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  club: {
    marginTop: space.lg,
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: space.sm,
  },
  clubTitle: { ...text.cardTitle, textAlign: "center" },
  clubBlurb: { ...text.body, color: colors.textMuted, textAlign: "center" },
  // The line that decides whether anybody at the table tries it.
  clubFree: { ...text.body, color: colors.text, fontWeight: "600" },
  clubButton: {
    backgroundColor: colors.surfaceSolid,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space.md,
    alignItems: "center",
  },
  clubButtonText: { ...text.body, color: colors.text, fontWeight: "600" },
  clubTerms: { ...text.meta, color: colors.textMuted, textAlign: "center" },
  legalRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: space.sm,
  },
  legalLink: {
    ...text.meta,
    color: colors.accent,
    textDecorationLine: "underline",
  },
  legalDot: { ...text.meta, color: colors.textMuted },
  // No backdrop, corners, padding or safe-area handling here — Sheet owns all of
  // the sheet chrome now.
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
  },
  features: {
    gap: 12,
    marginVertical: 8,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  check: {
    fontSize: 16,
    color: "#10b981",
    fontWeight: "700",
  },
  featureText: {
    fontSize: 16,
    color: "#e2e8f0",
    flex: 1,
  },
  buyButton: {
    backgroundColor: "#f59e0b",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buyButtonText: {
    color: "#1f2937",
    fontSize: 17,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.7,
  },
  restoreButton: {
    paddingVertical: 8,
    alignItems: "center",
  },
  restoreText: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "500",
  },
  unlockedBox: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  unlockedText: {
    color: "#34d399",
    fontSize: 16,
    fontWeight: "600",
  },
  error: {
    color: "#f87171",
    fontSize: 13,
    textAlign: "center",
  },
  closeButton: {
    paddingVertical: 8,
    alignItems: "center",
  },
  closeText: {
    color: "#cbd5e1",
    fontSize: 16,
    fontWeight: "500",
  },
});
