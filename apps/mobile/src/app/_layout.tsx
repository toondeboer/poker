// src/app/_layout.tsx
import { useEffect } from "react";
import { Stack } from "expo-router";
import { TimerProvider } from "@/src/contexts/TimerContext";
import { BlindsProvider } from "@/src/contexts/BlindsContext";
import { AppStateProvider } from "@/src/contexts/AppStateContext";
import { PremiumProvider } from "@/src/contexts/PremiumContext";
import { initializeAds } from "@/src/services/ads";

export default function RootLayout() {
  useEffect(() => {
    void initializeAds();
  }, []);

  return (
    <PremiumProvider>
      <AppStateProvider>
        <BlindsProvider>
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
        </BlindsProvider>
      </AppStateProvider>
    </PremiumProvider>
  );
}
