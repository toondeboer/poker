// src/hooks/useKeyboardFocusScroll.ts
import { RefObject, useEffect, useRef, useState } from "react";
import { Dimensions, Keyboard, Platform, TextInput, View } from "react-native";

/** Extra gap so the field clears the keyboard rather than touching it. */
const BREATHING_ROOM = 24;
/**
 * The measurement has to happen *after* the platform's own inset work has moved
 * things, or it reads a stale layout. Same 150ms {@link useKeyboardNudge} uses.
 */
const SETTLE_MS = 150;

/**
 * Keep the focused input visible when the keyboard opens — **Android only**.
 *
 * iOS is handled by `automaticallyAdjustKeyboardInsets` on the scrollers, which
 * both insets the scroll area and scrolls the focused input into view. Android
 * used to get the equivalent for free from
 * `android:windowSoftInputMode="adjustResize"`: the window shrank, so the native
 * ScrollView shrank with it and Android's own focus handling scrolled the field
 * back into view.
 *
 * **That stopped being true under edge-to-edge.** Android 15 (API 35) makes
 * edge-to-edge mandatory and `adjustResize` a no-op with it — the window keeps
 * its full height and the keyboard arrives as an inset the app is expected to
 * consume itself. Nothing consumed it, so a field near the bottom of the screen
 * simply ended up underneath the keypad with no way to scroll to it: the content
 * had no room below to scroll into, and nothing was asking it to scroll anyway.
 * This is the same root cause `Sheet.tsx` works around for its own modal window.
 *
 * So this hook does both halves the platform no longer does:
 *
 *  - returns `keyboardInset`, to add to the scroller's content padding, giving
 *    the bottom-most field somewhere to scroll to;
 *  - scrolls the focused input up by however much the keyboard covers it.
 *
 * The visible-bottom maths mirrors {@link useKeyboardNudge}, including its two
 * hard-won corrections: Android reports the keyboard height *excluding* the
 * navigation bar, and its `measureInWindow` frame starts below the status bar
 * while `Dimensions.get("window").height` includes it.
 */
export function useKeyboardFocusScroll({
  scrollBy,
  containerRef,
  bottomInset,
  topInset,
}: {
  /** Scroll the list/view down by `delta` points from where it is now. */
  scrollBy: (delta: number) => void;
  /** The screen's flex:1 root, for measuring the visible area. */
  containerRef: RefObject<View | null>;
  /** Safe-area bottom inset; Android's keyboard height excludes it. */
  bottomInset: number;
  /** Safe-area top inset; see the coordinate-frame note above. */
  topInset: number;
}) {
  const [keyboardInset, setKeyboardInset] = useState(0);
  // The callback is recreated every render by every caller; a ref keeps this
  // effect from re-subscribing (and dropping keyboard events) on each one.
  const scrollByRef = useRef(scrollBy);
  useEffect(() => {
    scrollByRef.current = scrollBy;
  });

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const showSub = Keyboard.addListener("keyboardDidShow", (e) => {
      const keyboardHeight = e.endCoordinates.height;
      setKeyboardInset(keyboardHeight);

      setTimeout(() => {
        const focused = TextInput.State.currentlyFocusedInput();
        if (!focused) return;

        containerRef.current?.measureInWindow(
          (_cx, containerY, _cw, containerHeight) => {
            const covered = keyboardHeight + bottomInset;
            const windowHeight = Dimensions.get("window").height - topInset;
            const visibleBottom = Math.min(
              containerY + containerHeight,
              windowHeight - covered,
            );

            focused.measureInWindow((_x, y, _width, height) => {
              const overflow = y + height - visibleBottom;
              if (overflow > 0) scrollByRef.current(overflow + BREATHING_ROOM);
            });
          },
        );
      }, SETTLE_MS);
    });

    const hideSub = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardInset(0),
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [containerRef, bottomInset, topInset]);

  return { keyboardInset };
}
