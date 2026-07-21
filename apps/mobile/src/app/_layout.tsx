// src/app/_layout.tsx
import { useEffect } from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TimerProvider } from "@/src/contexts/TimerContext";
import { BlindsProvider } from "@/src/contexts/BlindsContext";
import { AppStateProvider } from "@/src/contexts/AppStateContext";
import { PremiumProvider } from "@/src/contexts/PremiumContext";
import { SoundPackProvider } from "@/src/contexts/SoundPackContext";
import { initializeAds } from "@/src/services/ads";
import { configurePurchases } from "@/src/services/revenueCatProvider";

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
                </Stack>
              </TimerProvider>
            </SoundPackProvider>
          </BlindsProvider>
        </AppStateProvider>
      </PremiumProvider>
    </SafeAreaProvider>
  );
}
