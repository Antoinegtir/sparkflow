import Constants, { ExecutionEnvironment } from "expo-constants";
import { cssInterop } from "nativewind";
import { useState, type ReactNode } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useIsDark } from "@/constants/theme";
import { cn } from "@/lib/cn";
import { SurfaceContext } from "./surface";

// Expo Go doesn't ship @callstack/liquid-glass (loading it there throws "NativeLiquidGlassModule could
// not be found"): the app then runs with the blurred surface below instead.
const lg: typeof import("@callstack/liquid-glass") | null =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ? null : require("@callstack/liquid-glass");
const LiquidGlassView = (lg?.LiquidGlassView ?? View) as NonNullable<typeof lg>["LiquidGlassView"];

// Native views NativeWind doesn't know: without this their className (padding, radius) is dropped.
if (lg) cssInterop(lg.LiquidGlassView, { className: "style" });

/** True on iOS 26+, where Glass is Apple's real Liquid Glass. */
export const liquidGlass = Platform.OS === "ios" && !!lg?.isLiquidGlassSupported;

/**
 * Apple's Liquid Glass (iOS 26, @callstack/liquid-glass): a refracting, light-catching surface over the
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
  // UIGlassEffect draws nothing when the corner radius exceeds half the height (rounded-full is 9999):
  // pills get a measured capsule radius instead.
  const pill = !!className && /(^|\s)rounded-full(\s|$)/.test(className);
  const [height, setHeight] = useState(0);
  if (liquidGlass) {
    return (
      <LiquidGlassView
        testID={testID}
        effect={variant}
        // A light default tint keeps small glass legible over bright photos.
        tintColor={tint ?? (dark ? "rgba(20,22,28,0.35)" : "rgba(255,255,255,0.25)")}
        interactive={interactive}
        colorScheme={dark ? "dark" : "light"}
        // No overflow-hidden: clipping the effect view cuts its edge highlights and leaves it patchy.
        className={cn("rounded-theme", className)}
        onLayout={pill ? (e) => setHeight(e.nativeEvent.layout.height) : undefined}
        style={[style, pill ? { borderRadius: height / 2 } : null]}>
        {inner}
      </LiquidGlassView>
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
  if (liquidGlass) return <LiquidGlassView effect={variant} colorScheme={dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />;
  return <View className={variant === "clear" ? "bg-surface/40" : "bg-surface/80"} style={[StyleSheet.absoluteFill, fallback.glass]} />;
}

/**
 * Lays out a row of Glass controls. A plain View on purpose: liquid-glass 0.7's
 * LiquidGlassContainerView shifts its children (they render about one padding to the right).
 */
export function GlassGroup({ children, className, style }: { children?: ReactNode; spacing?: number; className?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View className={className} style={style}>
      {children}
    </View>
  );
}

const fallback = StyleSheet.create({
  glass: Platform.select({
    web: { backdropFilter: "blur(24px) saturate(180%)", WebkitBackdropFilter: "blur(24px) saturate(180%)" } as ViewStyle,
    default: {},
  })!,
});
