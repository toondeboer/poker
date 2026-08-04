// src/hooks/useKeyboardNudge.ts
import { RefObject, useEffect, useRef } from "react";
import { Dimensions, Keyboard, Platform, ScrollView, View } from "react-native";

/**
 * Scroll a button clear of the keyboard when a specific input is focused.
 *
 * iOS's `automaticallyAdjustKeyboardInsets` (on the settings ScrollView) makes
 * all content scrollable above the keyboard, but it only auto-scrolls the
 * focused *input* into view — a button sitting just below it stays hidden. This
 * measures the overflow and scrolls by exactly that much, so there's no dead
 * space.
 *
 * The visible bottom is the smaller of two measurements, because the platforms
 * hide content in different ways:
 *
 *  - **Android** (`adjustResize`) shrinks the *window*, so the container's own
 *    measured bottom is the truth. `Dimensions.get("window").height` still
 *    reports the full screen there, so deriving the bottom from it alone
 *    overestimates the visible area by roughly the system bars and concludes
 *    there's nothing to scroll — measured at 365dp when the real cutoff was
 *    342dp, which is exactly why the button stayed hidden on Android.
 *  - **iOS** doesn't resize anything; the container still reaches the bottom of
 *    the screen and only the keyboard's own height says what's covered.
 *
 * Taking the minimum is correct on both.
 *
 * The 150ms settle delay is load-bearing: the measurement has to happen *after*
 * the platform's own inset/resize has moved things, or it reads a stale layout.
 */
/** Extra gap so the button clears the keyboard rather than touching it. */
const BREATHING_ROOM = 24;

export function useKeyboardNudge({
  scrollViewRef,
  scrollOffsetRef,
  containerRef,
  bottomInset,
}: {
  scrollViewRef: RefObject<ScrollView | null>;
  scrollOffsetRef: RefObject<number>;
  /** The screen's flex:1 root — it shrinks with the window on Android. */
  containerRef: RefObject<View | null>;
  /** Safe-area bottom inset; Android's keyboard height excludes it. */
  bottomInset: number;
}) {
  // `measureInWindow` needs a host component — the caller puts this on a plain
  // <View> wrapper, not on a function component.
  const targetRef = useRef<View>(null);
  const activeRef = useRef(false);

  useEffect(() => {
    const subscription = Keyboard.addListener("keyboardDidShow", (e) => {
      if (!activeRef.current) return;
      const keyboardHeight = e.endCoordinates.height;
      // Let the automatic inset-scroll / window resize settle, then measure.
      setTimeout(() => {
        containerRef.current?.measureInWindow(
          (_cx, containerY, _cw, containerHeight) => {
            // Android reports the keyboard height *excluding* the navigation
            // bar, so the covered strip is really `keyboard + bottom inset`
            // (measured: 640dp window, 275dp keyboard, but content cut off at
            // 342.5dp — the missing 22.5dp is the nav bar). iOS's keyboard
            // height already spans the home indicator, so it adds nothing there.
            const covered =
              keyboardHeight + (Platform.OS === "android" ? bottomInset : 0);
            const visibleBottom = Math.min(
              containerY + containerHeight,
              Dimensions.get("window").height - covered,
            );
            targetRef.current?.measureInWindow((_x, y, _width, height) => {
              const overflow = y + height - visibleBottom;
              if (overflow > 0) {
                scrollViewRef.current?.scrollTo({
                  y: scrollOffsetRef.current + overflow + BREATHING_ROOM,
                  animated: true,
                });
              }
            });
          },
        );
      }, 150);
    });
    return () => subscription.remove();
  }, [scrollViewRef, scrollOffsetRef, containerRef, bottomInset]);

  return {
    targetRef,
    setActive: (active: boolean) => {
      activeRef.current = active;
    },
  };
}
