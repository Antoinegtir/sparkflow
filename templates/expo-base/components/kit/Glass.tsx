import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import type { ReactNode } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useIsDark } from "@/constants/theme";
import { cn } from "@/lib/cn";
import { SurfaceContext } from "./surface";

/** True on iOS 26+, where Glass is Apple's real Liquid Glass. */
export const liquidGlass = Platform.OS === "ios" && isLiquidGlassAvailable();

/**
 * Apple's Liquid Glass (iOS 26, expo-glass-effect): a refracting, light-catching surface over the
 * content behind it. Elsewhere (web, Android, older iOS) a translucent blurred surface stands in.
 * Put it over something (a scroll, an image, a colored background): over a flat color glass shows little.
 */
export function Glass({
  children,
  testID,
  className,
  style,
  variant = "regular",
  tint,
  interactive = false,
}: {
  children?: ReactNode;
  testID?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
  /** "clear" lets more of the background through. */
  variant?: "regular" | "clear";
  /** A color to tint the glass (e.g. the primary color with some alpha). */
  tint?: string;
  /** Reacts to touches (buttons, chips). */
  interactive?: boolean;
}) {
  const dark = useIsDark();
  const inner = <SurfaceContext.Provider value="card">{children}</SurfaceContext.Provider>;
  if (liquidGlass) {
    return (
      <GlassView
        testID={testID}
        glassEffectStyle={variant}
        tintColor={tint}
        isInteractive={interactive}
        colorScheme={dark ? "dark" : "light"}
        className={cn("rounded-theme overflow-hidden", className)}
        style={style}>
        {inner}
      </GlassView>
    );
  }
  return (
    <View
      testID={testID}
      className={cn("rounded-theme overflow-hidden border border-white/30", variant === "clear" ? "bg-surface/40" : "bg-surface/70", className)}
      style={[fallback.glass, tint ? { backgroundColor: tint } : null, style]}>
      {inner}
    </View>
  );
}

/** Glass filling its parent, for backgrounds (tab bar, headers). */
export function GlassFill({ variant = "regular" }: { variant?: "regular" | "clear" }) {
  const dark = useIsDark();
  if (liquidGlass) return <GlassView glassEffectStyle={variant} colorScheme={dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />;
  return <View className={variant === "clear" ? "bg-surface/40" : "bg-surface/80"} style={[StyleSheet.absoluteFill, fallback.glass]} />;
}

const fallback = StyleSheet.create({
  glass: Platform.select({
    web: { backdropFilter: "blur(24px) saturate(180%)", WebkitBackdropFilter: "blur(24px) saturate(180%)" } as ViewStyle,
    default: {},
  })!,
});
