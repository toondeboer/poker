// src/app/blinds.tsx
import { useState } from "react";
import { Stack } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useReportContentSettledOnMount } from "@/src/components/AppReadyGate";
import { BlindStructureScreen } from "@/src/components/blinds/BlindStructureScreen";
import { colors } from "@/src/theme";

export default function BlindsRoute() {
  const [generatorVisible, setGeneratorVisible] = useState(false);

  // Like Settings: this screen has no measure-and-rescale pass, so mounting is
  // as settled as it gets. Without it, a launch restored straight onto this
  // route (or a `pokerkit://blinds` deep link) would sit behind the splash until
  // AppReadyGate's 4s ceiling fired.
  useReportContentSettledOnMount();

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setGeneratorVisible(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Generate a blind structure"
            >
              <Ionicons name="sparkles" size={22} color={colors.text} />
            </TouchableOpacity>
          ),
        }}
      />
      <BlindStructureScreen
        generatorVisible={generatorVisible}
        onOpenGenerator={() => setGeneratorVisible(true)}
        onCloseGenerator={() => setGeneratorVisible(false)}
      />
    </>
  );
}
