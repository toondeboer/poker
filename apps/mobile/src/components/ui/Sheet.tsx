// src/components/ui/Sheet.tsx
import { ReactNode, useMemo, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, space, text } from "@/src/theme";

/** Drag far enough, or flick fast enough, and the sheet closes. */
const DISMISS_DISTANCE = 90;
const DISMISS_VELOCITY = 0.6;
/** Ignore the first few pixels so a tap on the handle isn't read as a drag. */
const DRAG_SLOP = 4;

/**
 * A bottom-sheet modal — the same shape as {@link Paywall}, extracted so other
 * sheets don't re-derive it. (Paywall itself is deliberately left alone: it owns
 * purchase/restore/error state and is the revenue path.)
 *
 * Dismissable three ways: the close button, a tap on the backdrop, and dragging
 * the grabber down. The grabber has to actually work — a sheet that shows the
 * handle without handling the gesture is advertising something it ignores.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  // Lazy useState rather than useRef: the value has to be created once and
  // stay stable, but reading a ref during render is a lint error here.
  const [translateY] = useState(() => new Animated.Value(0));

  // Reset the drag offset on the closed→open transition, during render rather
  // than in an effect.
  //
  // The Animated.Value outlives the modal (RN's Modal renders nothing while
  // hidden, so the sheet unmounts and its native animated node is recreated on
  // each open, initialised from this value). After a drag-dismiss it still holds
  // `height`. Resetting from a `useEffect` was too late on **iOS**, where the
  // modal is presented asynchronously by UIKit: the sheet remounted still offset
  // by a full screen and rendered off-screen — the modal was "open" but invisible
  // until some unrelated interaction forced another commit. Android attaches its
  // Dialog synchronously and never showed it.
  //
  // Doing it here guarantees the value is 0 *before* the content mounts.
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (visible) translateY.setValue(0);
  }

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
          if (g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY) {
            // Slide it the rest of the way out before unmounting, so the Modal's
            // own exit animation isn't fighting a half-dragged sheet.
            Animated.timing(translateY, {
              toValue: height,
              duration: 180,
              useNativeDriver: true,
            }).start(onClose);
          } else {
            springBack();
          }
        },
        onPanResponderTerminate: springBack,
      }),
    [height, onClose, springBack, translateY],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
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
      <View style={styles.backdrop}>
        {/* Rendered before the sheet so it sits behind it: taps outside land
            here, taps on the sheet don't reach it. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        {/* `automaticallyAdjustKeyboardInsets` doesn't reach inside a Modal, so
            iOS needs an explicit avoider here. Android's manifest-level
            adjustResize already handles it. */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.avoider}
        >
          <Animated.View
            style={[
              styles.sheet,
              {
                paddingBottom: space.xl + insets.bottom,
                transform: [{ translateY }],
              },
            ]}
          >
            {/* The drag is bound to the grabber alone. On the whole sheet it
                would fight the ScrollView for every vertical gesture, and on the
                title row it would compete with the close button. */}
            <View
              style={styles.grabberHitArea}
              {...panResponder.panHandlers}
              accessibilityRole="adjustable"
              accessibilityLabel="Drag down to close"
            >
              <View style={styles.grabber} />
            </View>
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {/* A scroller here is safe and deliberate: a Modal is its own
                scroll context, so this is never nested inside the screen's
                list. It only engages when the sheet's controls outgrow a short
                screen; the footer stays pinned below it either way. */}
            <ScrollView
              style={{ maxHeight: height * 0.6 }}
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
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    // No marginTop: the grabber is a sibling flex child now, so the sheet's own
    // `gap` already separates them.
  },
  title: { ...text.cardTitle, flex: 1 },
  scrollContent: { gap: space.lg, paddingBottom: space.xs },
  footer: { flexDirection: "row", gap: space.md },
});
