import { Stack } from "expo-router";
import { TimerProvider } from "@/contexts/TimerContext";
import { BlindsProvider } from "@/contexts/BlindsContext";

export default function RootLayout() {
  return (
    <TimerProvider>
      <BlindsProvider>
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: "#fff",
            },
            headerTintColor: "#000",
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
