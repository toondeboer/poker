// src/components/ui/Sheet.tsx
import { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
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

/**
 * A bottom-sheet modal — the same shape as {@link Paywall}, extracted so other
 * sheets don't re-derive it. (Paywall itself is deliberately left alone: it owns
 * purchase/restore/error state and is the revenue path.)
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
        {/* `automaticallyAdjustKeyboardInsets` doesn't reach inside a Modal, so
            iOS needs an explicit avoider here. Android's manifest-level
            adjustResize already handles it. */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.avoider}
        >
          <View
            style={[styles.sheet, { paddingBottom: space.xl + insets.bottom }]}
          >
            <View style={styles.grabber} />
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
          </View>
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
  grabber: {
    alignSelf: "center",
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
  },
  title: { ...text.cardTitle, flex: 1 },
  scrollContent: { gap: space.lg, paddingBottom: space.xs },
  footer: { flexDirection: "row", gap: space.md },
});
