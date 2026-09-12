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
 * Which of the two purchases the sheet was opened for.
 *
 * **Emphasis, never exclusion.** The other one is still on screen and still
 * buyable — hiding it would mean somebody who tapped the wrong entry point has
 * to back out and find the right one, and there is no right one to find when
 * the two were never distinguished in the first place. Focus only decides which
 * card comes first and which call to action is filled rather than outlined.
 */
export type PaywallFocus = "pro" | "club";

/**
 * What Pro actually buys, in the order somebody decides by.
 *
 * **This list has to be checked against the app every release.** It was found
 * selling the previous version's feature set during 1.2.0 — the screen where
 * people decide to pay was describing an app with fewer things in it than the
 * one they had just been using. Dealing a hand is the headline of this release
 * and was missing from here entirely.
 *
 * **Nothing shared belongs in here.** Everything on this list runs on the phone
 * that bought it, which is the whole reason Pro can be a single payment.
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
 * What Club adds, which is the part with a cost that keeps arriving.
 *
 * Each of these is a row on a server other people poll for as long as the table
 * runs — see `clubPolicy.ts`, which is where the line between the two lives.
 */
const CLUB_FEATURES = [
  "Share a leaderboard with the people you play with",
  "Put one clock on every phone at the table",
  "Invite by code — and remove anybody you invited",
];

/**
 * The upgrade sheet: **two purchases, two cards, one sheet.**
 *
 * It used to be one card titled "Poker Blinds Buzzer Pro" with the subscription
 * bolted underneath it, reached from buttons that all said "Unlock Pro". So the
 * only way to find out Club existed was to open a sheet about something else and
 * scroll, and the two were told apart by nothing at all — same colour, same
 * heading, adjacent buttons. Somebody meaning to pay once could start a
 * subscription without ever reading a word that distinguished them.
 *
 * The split it now draws is the one `clubPolicy.ts` already documents and the
 * app never showed: Pro is paid once and everything it unlocks runs here; Club
 * renews, because hosting is the only thing that costs something every month.
 * Joining what somebody else hosts stays free, and that sentence earns its place
 * on screen — it is the difference between an invite people accept and an invite
 * that asks five friends to subscribe to a poker timer.
 *
 * Uses the shared {@link Sheet} so there is one sheet implementation rather than
 * two that drift. Gesture dismissal is deliberately off: the paywall keeps its
 * explicit "Maybe later", since how easily it can be dismissed is a product
 * decision, not a styling one.
 */
export function Paywall({
  visible,
  onClose,
  focus = "pro",
}: {
  visible: boolean;
  onClose: () => void;
  focus?: PaywallFocus;
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

  // With no price, the button says what it does and the card already says
  // "One-time" — the old fallback rendered "Unlock Pro · one-time", which reads
  // as though "one-time" were the price.
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

  /**
   * **Whether Club is mentioned at all.**
   *
   * Absent entirely when there are no plans and none are held, which is the
   * state until the subscriptions are live in both stores. Advertising something
   * nobody can buy is worse than saying nothing — and a subscriber is shown the
   * card even with the fetch empty, because they still need the renewal terms
   * and the links to them.
   */
  const showClub = clubPlans.length > 0 || hasClub;
  const clubFocused = focus === "club" && showClub;

  const proCard = (
    <View key="pro" style={[styles.card, styles.proCard]}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>Pro</Text>
        <View style={[styles.kind, styles.proKind]}>
          <Text style={[styles.kindText, styles.proKindText]}>ONE-TIME</Text>
        </View>
      </View>
      <Text style={styles.cardBlurb}>
        Everything the app does on this phone. Paid once — no subscription, and
        nothing to cancel.
      </Text>

      <View style={styles.features}>
        {PRO_FEATURES.map((feature) => (
          <View key={feature} style={styles.featureRow}>
            <Text style={[styles.check, styles.proCheck]}>✓</Text>
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      {isPremium ? (
        <View style={styles.ownedBox}>
          <Text style={styles.ownedText}>
            {hasClub && !ownsProOutright
              ? "✓ Pro is included with Club — thank you!"
              : "✓ Pro unlocked — thank you!"}
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[
            styles.cta,
            clubFocused ? styles.proOutlined : styles.proFilled,
            purchasing && styles.disabled,
          ]}
          onPress={() => run(purchasePro)}
          disabled={purchasing}
          activeOpacity={0.85}
        >
          {purchasing ? (
            <ActivityIndicator
              color={clubFocused ? colors.pro : colors.textOnPro}
            />
          ) : (
            <Text
              style={[
                styles.ctaText,
                clubFocused ? styles.proOutlinedText : styles.proFilledText,
              ]}
            >
              {buyLabel}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  /**
   * **The Club card, and the four things Apple requires on it.**
   *
   * Guideline 3.1.2 wants a subscription's title, the length of its period and
   * its price shown *in the app* — not only in the store — plus working links to
   * the Terms of Use and the Privacy Policy. All of them are here, and the links
   * are the reason `/terms` exists. They stay on screen for a subscriber too:
   * the person most likely to want the cancellation terms is the one already
   * paying.
   */
  const clubCard = showClub ? (
    <View key="club" style={[styles.card, styles.clubCard]}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>Club</Text>
        <View style={[styles.kind, styles.clubKind]}>
          <Text style={[styles.kindText, styles.clubKindText]}>
            SUBSCRIPTION
          </Text>
        </View>
      </View>
      <Text style={styles.cardBlurb}>
        Everything in Pro, plus the parts that reach other people&apos;s phones.
      </Text>

      <View style={styles.features}>
        {CLUB_FEATURES.map((feature) => (
          <View key={feature} style={styles.featureRow}>
            <Text style={[styles.check, styles.clubCheck]}>✓</Text>
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      {/* The line that decides whether anybody at the table tries it. */}
      <Text style={styles.cardBlurb}>
        <Text style={styles.clubFree}>
          Joining a board or clock somebody shares is always free
        </Text>{" "}
        — only the person sharing subscribes.
      </Text>

      {hasClub ? (
        <View style={styles.ownedBox}>
          <Text style={styles.ownedText}>✓ Club active — thank you!</Text>
        </View>
      ) : (
        clubPlans.map((plan) => (
          <TouchableOpacity
            key={plan.id}
            style={[
              styles.cta,
              clubFocused ? styles.clubFilled : styles.clubOutlined,
              purchasing && styles.disabled,
            ]}
            onPress={() => run(() => purchaseClub(plan.id))}
            disabled={purchasing}
            activeOpacity={0.85}
          >
            {/* **The period once, not twice.** "Monthly · €2,99 / month" says
                it at both ends and reads like a stutter. The label carries the
                billing period, which is what 3.1.2 asks to be on screen, and the
                price then only has to be the price. */}
            <Text
              style={[
                styles.ctaText,
                clubFocused ? styles.clubFilledText : styles.clubOutlinedText,
              ]}
            >
              {plan.period === "monthly" ? "Monthly" : "Annual"} ·{" "}
              {plan.priceString}
            </Text>
          </TouchableOpacity>
        ))
      )}

      {/* Required wording: it renews until cancelled, and where to cancel. */}
      <Text style={styles.clubTerms}>
        Renews automatically until cancelled. Manage or cancel it in your{" "}
        {Platform.OS === "ios" ? "App Store" : "Play Store"} account settings.
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
  ) : null;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      gestureDismissible={false}
      maxContentHeightRatio={0.8}
    >
      <Text style={styles.title}>Poker Blinds Buzzer</Text>
      <Text style={styles.subtitle}>
        {showClub
          ? "Two separate purchases. Pro is paid once; Club renews and covers the sharing."
          : "One-time unlock. Yours forever."}
      </Text>

      {/* **The one somebody asked for comes first.** Order is the emphasis that
          survives a small screen — whichever card is second is below the fold on
          a phone, and putting the wrong one there is how a person tapping
          "Share this board" lands on a list of things they already own. */}
      {clubFocused ? [clubCard, proCard] : [proCard, clubCard]}

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

// No backdrop, corners, padding or safe-area handling here — Sheet owns all of
// the sheet chrome. Every colour comes from the theme: this file carried about
// twenty hardcoded hex values, which is exactly what `apps/mobile/src/theme`
// exists to stop, and it is why the two purchases were the same colour.
const styles = StyleSheet.create({
  title: {
    ...text.cardTitle,
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    ...text.meta,
    fontSize: 14,
    textAlign: "center",
    marginBottom: space.sm,
  },

  /** One purchase, one bordered block. The border is the tier's colour. */
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
  },
  proCard: {
    backgroundColor: colors.proSurfaceSoft,
    borderColor: colors.pro,
  },
  clubCard: {
    backgroundColor: colors.clubSurfaceSoft,
    borderColor: colors.club,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  cardTitle: { ...text.cardTitle, flex: 1 },
  cardBlurb: { ...text.body, color: colors.textMuted },

  /**
   * **"ONE-TIME" and "SUBSCRIPTION", said in the same place on both cards.**
   *
   * The shape of the payment is the single thing somebody must not get wrong,
   * so it sits beside the name rather than in the body text where it can be
   * skimmed past.
   */
  kind: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 3,
  },
  kindText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  proKind: { backgroundColor: colors.proSurface, borderColor: colors.pro },
  proKindText: { color: colors.pro },
  clubKind: { backgroundColor: colors.clubSurface, borderColor: colors.club },
  clubKindText: { color: colors.club },

  features: { gap: space.md },
  featureRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  check: { fontSize: 16, fontWeight: "700" },
  proCheck: { color: colors.pro },
  clubCheck: { color: colors.club },
  featureText: { ...text.body, fontSize: 15, color: colors.textLabel, flex: 1 },
  clubFree: { ...text.body, color: colors.text, fontWeight: "600" },

  /**
   * Filled for the card that was asked for, outlined for the other one — so
   * both remain buyable and only one is the obvious next tap.
   */
  cta: {
    borderWidth: 1,
    paddingVertical: space.lg,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { fontSize: 17, fontWeight: "700" },
  proFilled: { backgroundColor: colors.pro, borderColor: colors.pro },
  proFilledText: { color: colors.textOnPro },
  proOutlined: { backgroundColor: "transparent", borderColor: colors.pro },
  proOutlinedText: { color: colors.pro },
  clubFilled: { backgroundColor: colors.club, borderColor: colors.club },
  clubFilledText: { color: colors.textOnClub },
  clubOutlined: { backgroundColor: "transparent", borderColor: colors.club },
  clubOutlinedText: { color: colors.club },

  disabled: { opacity: 0.7 },
  ownedBox: {
    backgroundColor: colors.successSurface,
    borderRadius: radius.md,
    paddingVertical: space.lg,
    alignItems: "center",
  },
  ownedText: {
    ...text.body,
    fontSize: 16,
    fontWeight: "600",
    color: colors.successText,
  },

  clubTerms: { ...text.meta, textAlign: "center" },
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
  legalDot: text.meta,

  restoreButton: { paddingVertical: space.sm, alignItems: "center" },
  restoreText: { ...text.label, color: colors.textMuted },
  error: {
    ...text.meta,
    fontSize: 13,
    color: colors.danger,
    textAlign: "center",
  },
  closeButton: { paddingVertical: space.sm, alignItems: "center" },
  closeText: { ...text.label, fontSize: 16, color: colors.textLabel },
});
