// src/components/ui/Sheet.tsx
import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, space, text } from "@/src/theme";
import { InsideSheetContext } from "./SheetContext";

/** Drag far enough, or flick fast enough, and the sheet closes. */
const DISMISS_DISTANCE = 90;
const DISMISS_VELOCITY = 0.6;
/** Ignore the first few pixels so a tap on the handle isn't read as a drag. */
const DRAG_SLOP = 4;

const ENTER_MS = 260;
const EXIT_MS = 200;

/**
 * Floor for the scroll region once the keyboard is up. Below this the sheet is
 * unusable anyway, and letting it go to zero would hide the field being typed
 * into — better to overflow slightly and stay scrollable.
 */
const MIN_SCROLL_HEIGHT = 120;

/**
 * A bottom-sheet modal, dismissable three ways: the close button, a tap on the
 * backdrop, and dragging the grabber down.
 *
 * **The enter/exit animation is ours, not the Modal's.** `animationType="slide"`
 * translates the *entire* modal content, which includes the backdrop — so the
 * scrim slid up from the bottom with the sheet instead of fading in place. Real
 * sheets (iOS `UISheetPresentationController`, Android's `BottomSheetDialog`)
 * treat them as two separate animations, because the scrim means "the app behind
 * is inert", which is a property of the whole screen and shouldn't move. So the
 * Modal animates nothing and we drive both halves.
 *
 * Both halves come off a single `translateY`: the sheet is translated by it, and
 * the backdrop's opacity is interpolated from it. That gets the fade-in, the
 * fade-out *and* the proportional lightening while you drag for free, with one
 * value and no chance of the two drifting out of sync.
 *
 * (`react-native-screens`' native `presentation: "formSheet"` would give all of
 * this from the platform, and was tried — see CLAUDE.md for why it's reverted.)
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
  gestureDismissible = true,
  maxContentHeightRatio = 0.6,
}: {
  visible: boolean;
  onClose: () => void;
  /** Omit when the content renders its own headline. */
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * Whether the grabber, drag-to-dismiss and backdrop tap are offered. The
   * paywall opts out: it keeps an explicit "Maybe later", and how easily it can
   * be dismissed is a product decision rather than a styling one.
   */
  gestureDismissible?: boolean;
  /** Share of the screen the scrollable region may occupy. */
  maxContentHeightRatio?: number;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  // Both platforms track the keyboard themselves rather than delegating to
  // `KeyboardAvoidingView`.
  //
  // Android had to: KAV is a no-op here, because its height adjustment compares
  // against `Dimensions.get('window').height`, which still reports the full
  // screen when this renders inside a Modal's own separate Android window —
  // same root cause `useKeyboardNudge.ts` documents for Presets. Confirmed via
  // a temporary on-screen listener that `keyboardDidShow`/`keyboardDidHide`
  // themselves fire correctly (so this isn't a missing-event problem) while
  // `behavior="height"` still produced a pixel-identical screenshot to
  // `behavior={undefined}`.
  //
  // iOS now does too, because `behavior="padding"` only *moves* the sheet — it
  // never tells the scroll region below that it has less room, so the region
  // kept its full-window `maxHeight`, didn't believe it was overflowing, refused
  // to scroll, and pushed the sheet's own top off the top of the screen. Feeding
  // one measured keyboard height into both the offset and the scroll cap fixes
  // that, and leaves one code path instead of two that drift.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    // iOS's `will` events are driven by the same animation curve as the
    // keyboard itself, so the sheet travels with it instead of after it.
    // Android only has the `did` pair.
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (e) =>
      setKeyboardHeight(e.endCoordinates.height),
    );
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Everything in the sheet that isn't the scroll region — grabber, title,
  // footer, padding, the gaps between them. Derived from one layout pass
  // (sheet height minus scroll height) rather than estimated from the styles,
  // because it varies with the title's presence, the footer's contents and the
  // bottom inset, and an estimate that runs even slightly small puts the sheet's
  // top back off-screen. Converges immediately: chrome doesn't depend on the
  // cap it feeds.
  const [sheetHeight, setSheetHeight] = useState(0);
  const [scrollHeight, setScrollHeight] = useState(0);
  const chromeHeight =
    sheetHeight && scrollHeight ? sheetHeight - scrollHeight : 0;

  // With the keyboard up, the sheet may occupy only what's above it, so the
  // scroll region takes the space left after the chrome — which is what makes
  // it overflow and therefore actually scroll. MIN_SCROLL keeps a usable
  // window on a small phone whose keyboard leaves almost nothing.
  const scrollMaxHeight =
    keyboardHeight > 0
      ? Math.max(MIN_SCROLL_HEIGHT, height - keyboardHeight - chromeHeight)
      : height * maxContentHeightRatio;

  // Lazy useState rather than useRef: the value has to be created once and stay
  // stable, but reading a ref during render is a lint error here.
  const [translateY] = useState(() => new Animated.Value(height));

  // The Modal has to outlive `visible` so the exit animation can play before the
  // content unmounts. `rendered` is what actually drives it.
  const [rendered, setRendered] = useState(visible);
  if (visible && !rendered) {
    setRendered(true);
    // Park it off-screen *before* the content mounts. Setting this from an
    // effect instead was too late on iOS, where UIKit presents the modal
    // asynchronously — the sheet mounted at rest and the entry animation had
    // nothing to travel.
    translateY.setValue(height);
  }

  useEffect(() => {
    if (visible) {
      Animated.timing(translateY, {
        toValue: 0,
        duration: ENTER_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (rendered) {
      Animated.timing(translateY, {
        toValue: height,
        duration: EXIT_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setRendered(false));
    }
  }, [visible, rendered, height, translateY]);

  // One value drives both halves: fade in, fade out, and the proportional
  // lightening as the sheet is dragged down.
  const backdropOpacity = translateY.interpolate({
    inputRange: [0, height],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const springBack = useMemo(
    () => () =>
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
      }).start(),
    [translateY],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Claim on touch-down. This is bound to the grabber alone, which holds
        // nothing tappable, so there's no gesture to compete for — and relying
        // on `onMoveShouldSetPanResponder` instead left the view outside the
        // responder chain, so the drag never registered at all.
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > DRAG_SLOP,
        onPanResponderGrant: () => Keyboard.dismiss(),
        // Downward only — dragging up shouldn't lift the sheet off the bottom.
        onPanResponderMove: (_e, g) => {
          if (g.dy > 0) translateY.setValue(g.dy);
        },
        onPanResponderRelease: (_e, g) => {
          // Past the threshold, just ask the parent to close — the exit effect
          // above animates the rest of the way from wherever the drag left it,
          // so the backdrop keeps fading with it.
          if (g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY) onClose();
          else springBack();
        },
        onPanResponderTerminate: springBack,
      }),
    [onClose, springBack, translateY],
  );

  return (
    <InsideSheetContext.Provider value={true}>
      <Modal
        visible={rendered}
        // We animate both halves ourselves; see the note above.
        animationType="none"
        transparent
        // Android renders a Modal in its own window, which by default stops above
        // the navigation bar — leaving a strip at the bottom where the screen
        // behind shows through below the sheet. These make the modal window go
        // edge-to-edge like the rest of the app. RN warns if the navigation bar is
        // made translucent without the status bar, so both are required.
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={onClose}
      >
        <View style={styles.fill}>
          {/* Rendered before the sheet so it sits behind it: taps outside land
            here, taps on the sheet don't reach it. */}
          <Animated.View
            style={[styles.backdrop, { opacity: backdropOpacity }]}
            pointerEvents="none"
          />
          {gestureDismissible && (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
            />
          )}
          {/* No `KeyboardAvoidingView`: neither platform's version of it works
            inside a Modal's own window (see the keyboardHeight state above).
            The marginBottom lifts the sheet clear of the keyboard and the
            scroll cap below shrinks the region to match, which is the half
            KAV never did. The bottom inset is dropped while the keyboard is
            up — the keyboard already covers the home indicator, so keeping it
            would just waste room the fields need. */}
          <View style={styles.avoider}>
            <Animated.View
              onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
              style={[
                styles.sheet,
                {
                  paddingBottom:
                    space.xl + (keyboardHeight > 0 ? 0 : insets.bottom),
                  marginBottom: keyboardHeight,
                  transform: [{ translateY }],
                },
              ]}
            >
              {/* The drag is bound to the grabber alone. On the whole sheet it
                would fight the ScrollView for every vertical gesture, and on the
                title row it would compete with the close button. */}
              {gestureDismissible && (
                <View
                  style={styles.grabberHitArea}
                  {...panResponder.panHandlers}
                  accessibilityRole="adjustable"
                  accessibilityLabel="Drag down to close"
                >
                  <View style={styles.grabber} />
                </View>
              )}
              {/* No close icon: every sheet already offers a labelled way out —
                the generator a Cancel button, the paywall "Maybe later" — plus
                the grabber and backdrop where gestures are enabled. A second,
                unlabelled affordance was just visual noise. */}
              {/* Done lives here rather than on the keyboard — see InsideSheetContext. Only while
                the keypad is actually up, and it shares the title's row so it costs no height.
                A sheet with no title still gets the row, since the control has to go somewhere. */}
              {title || keyboardHeight > 0 ? (
                <View style={styles.titleRow}>
                  <Text style={styles.title}>{title ?? ""}</Text>
                  {keyboardHeight > 0 && (
                    <Pressable
                      onPress={() => Keyboard.dismiss()}
                      accessibilityRole="button"
                      accessibilityLabel="Done editing"
                      hitSlop={space.sm}
                    >
                      <Text style={styles.doneText}>Done</Text>
                    </Pressable>
                  )}
                </View>
              ) : null}
              {/* A scroller here is safe and deliberate: a Modal is its own
                scroll context, so this is never nested inside the screen's
                list. It only engages when the sheet's controls outgrow a short
                screen; the footer stays pinned below it either way. */}
              <ScrollView
                onLayout={(e) => setScrollHeight(e.nativeEvent.layout.height)}
                style={{ maxHeight: scrollMaxHeight }}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                // "none", not "on-drag". A sheet like this is a *form*: the fields
                // above and below the one you're typing in are the reason you'd
                // scroll at all, and "on-drag" put the keyboard away the instant
                // you tried — so the content jumped, the field you were editing
                // moved, and reaching the next field cost two gestures instead of
                // one. That mode belongs to scrolling *content* (Messages, Mail's
                // list), where the keyboard is incidental to what you're reading;
                // iOS form sheets keep it up and offer an explicit Done, which is
                // what the title row's Done button above is.
                keyboardDismissMode="none"
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {children}
              </ScrollView>
              {footer && <View style={styles.footer}>{footer}</View>}
            </Animated.View>
          </View>
        </View>
      </Modal>
    </InsideSheetContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "flex-end" },
  // Fades in place; it must never be inside anything that translates.
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
  },
  avoider: { justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surfaceSolid,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    gap: space.lg,
  },
  // The bar itself is 4pt tall; this gives the drag a target you can actually hit.
  grabberHitArea: {
    alignItems: "center",
    paddingVertical: space.sm,
    marginTop: -space.sm,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderInputCompact,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
  },
  title: { ...text.cardTitle, flexShrink: 1 },
  doneText: {
    ...text.label,
    color: colors.accent,
    fontWeight: "600",
    fontSize: 16,
  },
  scrollContent: { gap: space.lg, paddingBottom: space.xs },
  footer: { flexDirection: "row", gap: space.md },
});
