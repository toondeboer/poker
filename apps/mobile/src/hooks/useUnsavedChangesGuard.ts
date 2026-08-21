// src/hooks/useUnsavedChangesGuard.ts
import { useEffect } from "react";
import { Alert } from "react-native";
import { useNavigation } from "expo-router";

/**
 * Intercept leaving a screen while an edit is unapplied, and ask what to do.
 *
 * One `beforeRemove` listener covers all three ways off the screen — the header
 * back button, Android's hardware back, and iOS's swipe-back gesture (which
 * springs back when the event is prevented).
 *
 * Asking (rather than silently keeping the draft) is what makes the draft model
 * comprehensible: the draft is persisted, so an abandoned one would otherwise
 * leave an "Unapplied changes" badge sitting on Settings indefinitely with no
 * record of what was changed.
 */
export function useUnsavedChangesGuard({
  enabled,
  onApply,
  onDiscard,
}: {
  enabled: boolean;
  onApply: () => void;
  onDiscard: () => void;
}) {
  const navigation = useNavigation();

  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = navigation.addListener(
      // Typed loosely: expo-router's re-export doesn't surface the navigation
      // event map that carries `beforeRemove`.
      "beforeRemove" as never,
      ((event: {
        preventDefault: () => void;
        data: { action: Parameters<typeof navigation.dispatch>[0] };
      }) => {
        event.preventDefault();
        Alert.alert(
          "Unapplied changes",
          "Apply your blind structure changes before leaving?",
          [
            {
              text: "Apply",
              onPress: () => {
                onApply();
                navigation.dispatch(event.data.action);
              },
            },
            {
              text: "Discard",
              style: "destructive",
              onPress: () => {
                onDiscard();
                navigation.dispatch(event.data.action);
              },
            },
            { text: "Keep editing", style: "cancel" },
          ],
        );
      }) as never,
    );

    return unsubscribe;
  }, [enabled, navigation, onApply, onDiscard]);
}
