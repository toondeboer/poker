// src/components/ads/BannerAdSlot.tsx
import { View, StyleSheet, ViewStyle } from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { shouldShowAds } from "@poker/core";
import { usePremium } from "@/src/contexts/PremiumContext";
import { useAdsConsent } from "@/src/hooks/useAdsConsent";
import { BANNER_AD_UNIT_ID } from "@/src/services/ads";

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

  if (!shouldShowAds({ isPremium, consentResolved })) return null;

  return (
    <View style={[styles.container, style]}>
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
});
