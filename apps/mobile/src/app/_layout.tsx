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
import { PayoutProvider } from "@/src/contexts/PayoutContext";
import AppReadyGate from "@/src/components/AppReadyGate";
import { initializeAds } from "@/src/services/ads";
import { configurePurchases } from "@/src/services/revenueCatProvider";

// Runs at import time, before the first render, so the native splash
// screen stays up while contexts load and PokerTimer's initial
// scale-fit pass converges (see AppReadyGate) instead of resizing in
// the already-visible app.
void SplashScreen.preventAutoHideAsync();

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
              <PayoutProvider>
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
                    <Stack.Screen
                      name="payouts"
                      options={{
                        title: "Payouts",
                        headerBackTitle: "Settings",
                      }}
                    />
                  </Stack>
                </AppReadyGate>
              </TimerProvider>
              </PayoutProvider>
            </SoundPackProvider>
          </BlindsProvider>
        </AppStateProvider>
      </PremiumProvider>
    </SafeAreaProvider>
  );
}
