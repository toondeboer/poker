// src/app/_layout.tsx
import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TimerProvider } from "@/src/contexts/TimerContext";
import { BlindsProvider } from "@/src/contexts/BlindsContext";
import { AppStateProvider } from "@/src/contexts/AppStateContext";
import { PremiumProvider } from "@/src/contexts/PremiumContext";
import { SoundPackProvider } from "@/src/contexts/SoundPackContext";
import AppReadyGate from "@/src/components/AppReadyGate";
import { initializeAds } from "@/src/services/ads";
import { configurePurchases } from "@/src/services/revenueCatProvider";

// Runs at import time, before the first render, so the native splash
// screen stays up while contexts load and PokerTimer's initial
// scale-fit pass converges (see AppReadyGate) instead of resizing in
// the already-visible app.
void SplashScreen.preventAutoHideAsync();

/** Shared options for every screen presented as a native bottom sheet. */
const SHEET_OPTIONS = {
  presentation: "formSheet",
  // Size to the content rather than a fixed half/full detent — these sheets are
  // forms, and a fixed detent would either clip them or leave dead space.
  sheetAllowedDetents: "fitToContents",
  sheetGrabberVisible: true,
  sheetCornerRadius: 24,
  // Dim the screen behind at every detent; without this the backdrop is clear
  // and the sheet reads as part of the page rather than over it.
  sheetLargestUndimmedDetentIndex: "none",
  headerShown: false,
} as const;

export default function RootLayout() {
  useEffect(() => {
    configurePurchases();
    void initializeAds();
  }, []);

  return (
    <SafeAreaProvider>
      <PremiumProvider>
        <AppStateProvider>
          <BlindsProvider>
            <SoundPackProvider>
              <TimerProvider>
                <AppReadyGate>
                  <Stack
                    screenOptions={{
                      headerStyle: {
                        backgroundColor: "#0f172a",
                      },
                      headerTintColor: "#fff",
                      headerTitleStyle: {
                        fontWeight: "bold",
                      },
                    }}
                  >
                    <Stack.Screen
                      name="index"
                      options={{
                        headerShown: false,
                      }}
                    />
                    <Stack.Screen
                      name="settings"
                      options={{
                        title: "Settings",
                        headerBackTitle: "Back",
                      }}
                    />
                    <Stack.Screen
                      name="blinds"
                      options={{
                        title: "Blind structure",
                        headerBackTitle: "Settings",
                      }}
                    />
                    {/* Presented by react-native-screens as a real platform
                        sheet — UISheetPresentationController on iOS, a Material
                        BottomSheetBehavior on Android. Verified on both; the
                        expo-router docstring claiming Android falls back to a
                        full-screen modal is out of date. This is why there is no
                        hand-rolled sheet component any more. */}
                    <Stack.Screen
                      name="generate-structure"
                      options={SHEET_OPTIONS}
                    />
                    <Stack.Screen name="paywall" options={SHEET_OPTIONS} />
                  </Stack>
                </AppReadyGate>
              </TimerProvider>
            </SoundPackProvider>
          </BlindsProvider>
        </AppStateProvider>
      </PremiumProvider>
    </SafeAreaProvider>
  );
}
