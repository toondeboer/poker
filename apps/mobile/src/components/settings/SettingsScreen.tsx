// src/components/settings/SettingsScreen.tsx
import { useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  colors,
  isTabletWidth,
  space,
  TABLET_MAX_WIDTH_SETTINGS,
} from "@/src/theme";
import { Paywall } from "@/src/components/paywall/Paywall";
import { ProCard } from "./ProCard";
import { TournamentCard } from "./TournamentCard";
import { PresetsCard } from "./PresetsCard";
import { SoundPackCard } from "./SoundPackCard";

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = isTabletWidth(width);

  const [showPaywall, setShowPaywall] = useState(false);
  const openPaywall = () => setShowPaywall(true);

  // Owned here (rather than in PresetsCard) because the nudge has to drive the
  // screen's scroller, which lives at this level.
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          isTablet && styles.contentTablet,
          {
            paddingLeft: space.lg + insets.left,
            paddingRight: space.lg + insets.right,
            paddingBottom: 40 + insets.bottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => {
          scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        // iOS: automatically inset the scroll area for the keyboard, so content
        // scrolls fully into view and the keyboard never covers it. Android does
        // the equivalent natively via `android:windowSoftInputMode="adjustResize"`
        // in the manifest, so no wrapper (KeyboardAvoidingView) is needed here.
        automaticallyAdjustKeyboardInsets={true}
      >
        <ProCard onRequestPro={openPaywall} />

        <View style={[styles.pair, isTablet && styles.pairTablet]}>
          <TournamentCard style={isTablet && styles.pairItem} />
          <PresetsCard
            onRequestPro={openPaywall}
            scrollViewRef={scrollViewRef}
            scrollOffsetRef={scrollOffsetRef}
            style={isTablet && styles.pairItem}
          />
        </View>

        <SoundPackCard onRequestPro={openPaywall} />
      </ScrollView>

      <Paywall visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollView: { flex: 1 },
  content: { paddingTop: space.lg, gap: space.xl },
  contentTablet: {
    maxWidth: TABLET_MAX_WIDTH_SETTINGS,
    alignSelf: "center",
    width: "100%",
  },
  pair: { gap: space.xl },
  pairTablet: { flexDirection: "row", alignItems: "flex-start" },
  pairItem: { flex: 1 },
});
