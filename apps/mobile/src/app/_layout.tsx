import { Stack } from "expo-router";
import { TimerProvider } from "@/src/contexts/TimerContext";
import { BlindsProvider } from "@/src/contexts/BlindsContext";

export default function RootLayout() {
  return (
    <TimerProvider>
      <BlindsProvider>
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
      </BlindsProvider>
    </TimerProvider>
  );
}
