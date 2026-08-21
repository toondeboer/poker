// src/components/ads/BannerAdSlot.tsx
import { View, StyleSheet, ViewStyle, useWindowDimensions } from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { shouldShowAds } from "@poker/core";
import { usePremium } from "@/src/contexts/PremiumContext";
import { useAdsConsent } from "@/src/hooks/useAdsConsent";
import { BANNER_AD_UNIT_ID } from "@/src/services/ads";

// An anchored adaptive banner has no height until it has actually loaded, which
// can be well over half a second after first paint. Left to itself the slot
// therefore jumps 0 -> ~60pt with the screen already visible, and since
// PokerTimer sizes itself by measuring this column, that jump kicks off a fresh
// (and visibly oscillating) rescale of the whole card. Reserving the height up
// front means the slot is already its final size on the very first layout pass,
// so the ad arriving changes nothing.
//
// The SDK exposes no way to ask for that height synchronously, so estimate it.
// Google clamps anchored adaptive banners to 50..90dp, and the height tracks
// width closely — measured 402pt -> 63 (iOS) and 360dp -> 56 (Android), both
// matching this ratio. It doesn't need to be exact: PokerTimer ignores scale
// deltas under 0.01, which on a full-height column absorbs roughly ±8pt of
// error, so a few points either way still produces no reflow at all.
function estimateBannerHeight(width: number) {
  return Math.min(90, Math.max(50, Math.round(width * 0.156)));
}

// Once a real banner reports its height, prefer it over the estimate for any
// later mount in this session — self-correcting if the ratio above is ever off
// on some device, without needing to persist anything.
let observedBannerHeight: number | null = null;

/**
 * A single AdMob banner, gated by the shared `shouldShowAds` policy from
 * @poker/core — the same gate the web ad slots use. Renders nothing for premium
 * users or before the privacy gate resolves, so unlocking Pro in Phase 3 hides it
 * with no change here. Requests non-personalized ads to keep the privacy posture
 * simple until a full UMP/ATT flow is wired. Doesn't handle its own safe-area
 * inset — the caller positions it within the screen and owns that spacing.
 */
export function BannerAdSlot({ style }: { style?: ViewStyle }) {
  const { isPremium } = usePremium();
  const { consentResolved } = useAdsConsent();
  const { width } = useWindowDimensions();

  // Reserving is deliberately gated on `isPremium` alone rather than the full
  // `shouldShowAds` policy: that policy also waits on the consent gate, which
  // resolves asynchronously *after* the first layout pass, so keying the slot's
  // presence on it reintroduces exactly the 0 -> full-height jump this reservation
  // exists to prevent. `isPremium` starts false, so a free user gets stable space
  // from the very first pass. (A Pro user whose entitlement resolves late sees the
  // band collapse once — but that already happened before this change, and worse:
  // the slot used to mount and load a real ad before being removed.)
  if (isPremium) return null;

  const reservedHeight = observedBannerHeight ?? estimateBannerHeight(width);

  return (
    <View style={[styles.container, { height: reservedHeight }, style]}>
      {/* The space above is held regardless; only the ad itself waits for the
          consent gate, so it can appear inside an already-settled layout. */}
      {shouldShowAds({ isPremium, consentResolved }) && (
        <BannerAd
          unitId={BANNER_AD_UNIT_ID}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          // iOS reports via onAdLoaded, Android via onSizeChange — take whichever
          // arrives. Recorded for later mounts only; deliberately not state, since
          // re-rendering to a new height here is the reflow this slot exists to
          // avoid.
          onAdLoaded={({ height }) => {
            observedBannerHeight = height;
          }}
          onSizeChange={({ height }) => {
            observedBannerHeight = height;
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});
