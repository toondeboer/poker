// src/components/ui/StickyFooter.tsx
import { ReactNode } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, space } from "@/src/theme";

/**
 * A bar pinned to the bottom of a screen, over a scrolling list.
 *
 * Reports its own measured height so the list underneath can pad by exactly
 * that much — otherwise the last row sits permanently under the bar.
 */
export function StickyFooter({
  children,
  onHeightChange,
  contentStyle,
}: {
  children: ReactNode;
  onHeightChange?: (height: number) => void;
  contentStyle?: object;
}) {
  const insets = useSafeAreaInsets();

  const handleLayout = (event: LayoutChangeEvent) => {
    onHeightChange?.(event.nativeEvent.layout.height);
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(180)}
      exiting={FadeOutDown.duration(140)}
      style={[styles.bar, { paddingBottom: space.md + insets.bottom }]}
      onLayout={handleLayout}
    >
      <View style={[styles.content, contentStyle]}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: space.md,
    paddingHorizontal: space.lg,
    gap: space.sm,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  content: { gap: space.sm },
});
