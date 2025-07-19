import { Stack } from "expo-router";
import { TimerProvider } from "@/contexts/TimerContext";

export default function RootLayout() {
  return (
    <TimerProvider>
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
    </TimerProvider>
  );
}
