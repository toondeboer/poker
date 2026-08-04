// src/hooks/useKeyboardNudge.ts
import { RefObject, useEffect, useRef } from "react";
import { Dimensions, Keyboard, ScrollView, View } from "react-native";

/**
 * Scroll a button clear of the keyboard when a specific input is focused.
 *
 * `automaticallyAdjustKeyboardInsets` (on the settings ScrollView) makes all
 * content scrollable above the keyboard, but iOS only auto-scrolls the focused
 * *input* into view — a button sitting just below it stays hidden. This measures
 * against the keyboard's real height and scrolls by exactly the overflow, so
 * there's no dead space.
 *
 * The 150ms settle delay and the real-height measurement are both load-bearing:
 * the measurement has to happen *after* the automatic inset-scroll has moved
 * things, or it reads a stale position.
 */
export function useKeyboardNudge({
  scrollViewRef,
  scrollOffsetRef,
}: {
  scrollViewRef: RefObject<ScrollView | null>;
  scrollOffsetRef: RefObject<number>;
}) {
  // `measureInWindow` needs a host component — the caller puts this on a plain
  // <View> wrapper, not on a function component.
  const targetRef = useRef<View>(null);
  const activeRef = useRef(false);

  useEffect(() => {
    const subscription = Keyboard.addListener("keyboardDidShow", (e) => {
      if (!activeRef.current) return;
      const keyboardHeight = e.endCoordinates.height;
      // Let the automatic inset-scroll settle first, then measure + nudge.
      setTimeout(() => {
        targetRef.current?.measureInWindow((_x, y, _width, height) => {
          const visibleBottom =
            Dimensions.get("window").height - keyboardHeight;
          const overflow = y + height - visibleBottom;
          if (overflow > 0) {
            scrollViewRef.current?.scrollTo({
              y: scrollOffsetRef.current + overflow + 16,
              animated: true,
            });
          }
        });
      }, 150);
    });
    return () => subscription.remove();
  }, [scrollViewRef, scrollOffsetRef]);

  return {
    targetRef,
    setActive: (active: boolean) => {
      activeRef.current = active;
    },
  };
}
