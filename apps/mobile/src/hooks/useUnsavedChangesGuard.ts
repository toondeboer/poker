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

  /**
   * **Turn the swipe-back gesture off while the guard is armed.**
   *
   * `beforeRemove` + `preventDefault` works cleanly for a plain back event, but
   * not for iOS's interactive gesture: by the time the listener runs the swipe
   * has already begun committing, and re-dispatching its action after the
   * screen springs back leaves the navigator's current route out of step with
   * what is on screen. The symptom is that the screen cannot be opened again —
   * pushing it reads as already-current and does nothing — until some other
   * navigation resets it. A screen you cannot get back to, with no error.
   *
   * Android is unaffected either way: its back is an event with no gesture in
   * flight, and the same sequence there re-opens the screen immediately. This
   * option is iOS-only in practice, so it costs Android nothing.
   *
   * **The trade is that swipe-back no longer raises the dialog on iOS** — it
   * does nothing at all while there are unapplied changes, and the header back
   * button is the way out. That is the better failure of the two: a swipe that
   * does nothing is recoverable and obvious, and it also means an unapplied
   * draft cannot be swiped away by accident.
   */
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !enabled });
  }, [enabled, navigation]);

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
