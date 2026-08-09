// src/components/ui/Sheet.tsx
import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
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

/** Drag far enough, or flick fast enough, and the sheet closes. */
const DISMISS_DISTANCE = 90;
const DISMISS_VELOCITY = 0.6;
/** Ignore the first few pixels so a tap on the handle isn't read as a drag. */
const DRAG_SLOP = 4;

const ENTER_MS = 260;
const EXIT_MS = 200;

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

  // `KeyboardAvoidingView` (below) is a no-op for Android here: its height
  // adjustment compares against `Dimensions.get('window').height`, which
  // still reports the full screen when this renders inside a Modal's own
  // separate Android window — same root cause `useKeyboardNudge.ts`
  // documents for Presets. Confirmed via a temporary on-screen listener that
  // `keyboardDidShow`/`keyboardDidHide` themselves fire correctly (so this
  // isn't a missing-event problem) while `behavior="height"` still produced
  // a pixel-identical screenshot to `behavior={undefined}`. Tracking the
  // keyboard height ourselves and applying it directly sidesteps whatever
  // `KeyboardAvoidingView` gets wrong internally in this context.
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const showSub = Keyboard.addListener("keyboardDidShow", (e) =>
      setAndroidKeyboardHeight(e.endCoordinates.height),
    );
    const hideSub = Keyboard.addListener("keyboardDidHide", () =>
      setAndroidKeyboardHeight(0),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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
        {/* `automaticallyAdjustKeyboardInsets` doesn't reach inside a Modal, so
            iOS needs an explicit avoider here. Android's manifest-level
            adjustResize does NOT reach this Modal's own separate window
            (see the androidKeyboardHeight state above) - `behavior`
            deliberately stays undefined for Android since KeyboardAvoidingView
            itself is a no-op here anyway; the marginBottom below does the
            real work. */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.avoider}
        >
          <Animated.View
            style={[
              styles.sheet,
              {
                paddingBottom: space.xl + insets.bottom,
                marginBottom: androidKeyboardHeight,
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
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {/* A scroller here is safe and deliberate: a Modal is its own
                scroll context, so this is never nested inside the screen's
                list. It only engages when the sheet's controls outgrow a short
                screen; the footer stays pinned below it either way. */}
            <ScrollView
              style={{ maxHeight: height * maxContentHeightRatio }}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {children}
            </ScrollView>
            {footer && <View style={styles.footer}>{footer}</View>}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
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
  title: text.cardTitle,
  scrollContent: { gap: space.lg, paddingBottom: space.xs },
  footer: { flexDirection: "row", gap: space.md },
});
