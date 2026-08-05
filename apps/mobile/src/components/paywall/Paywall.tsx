// src/components/paywall/Paywall.tsx
import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePremium } from "@/src/contexts/PremiumContext";
import { SheetHeader } from "@/src/components/ui/SheetHeader";

const PRO_FEATURES = [
  "Remove all ads — a clean, full-screen timer",
  "Save & load tournament presets",
  "Choose your alarm sound",
  "Support an indie developer",
];

/**
 * The Pro upgrade sheet. Wired to {@link usePremium} so it works against the
 * stub today and against RevenueCat once that's added — no change needed here.
 * Includes Restore Purchases, which Apple requires for non-consumable IAPs.
 *
 * Presented as a native form sheet (see the route options in `_layout.tsx`), so
 * the grabber, backdrop and drag-to-dismiss come from the platform. Purchase,
 * restore and error handling below are unchanged — only the presentation moved.
 */
export function Paywall() {
  const router = useRouter();
  const onClose = () => router.back();
  const insets = useSafeAreaInsets();
  const { isPremium, purchasing, proPriceString, purchasePro, restore } =
    usePremium();
  const [error, setError] = useState<string | null>(null);

  const priceLabel = proPriceString ? `${proPriceString} one-time` : "one-time";

  const run = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 36 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* No title here — the headline below is the paywall's own. */}
        <SheetHeader onClose={onClose} />
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
            <Text style={styles.unlockedText}>✓ Pro unlocked — thank you!</Text>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.buyButton, purchasing && styles.disabled]}
              onPress={() => run(purchasePro)}
              disabled={purchasing}
              activeOpacity={0.85}
            >
              {purchasing ? (
                <ActivityIndicator color="#1f2937" />
              ) : (
                <Text style={styles.buyButtonText}>
                  Unlock Pro · {priceLabel}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.restoreButton}
              onPress={() => run(restore)}
              disabled={purchasing}
              activeOpacity={0.7}
            >
              <Text style={styles.restoreText}>Restore purchases</Text>
            </TouchableOpacity>
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>
            {isPremium ? "Done" : "Maybe later"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // No backdrop or rounded corners here any more — the form-sheet presentation
  // provides the sheet chrome, backdrop and drag-to-dismiss.
  container: { flex: 1, backgroundColor: "#1e293b" },
  content: { padding: 24, paddingBottom: 36, gap: 16 },
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
