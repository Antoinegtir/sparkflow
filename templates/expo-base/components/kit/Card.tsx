import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { cn } from "@/lib/cn";
import { Glass } from "./Glass";
import { shadow, SurfaceContext } from "./surface";

export function Card({
  children,
  onPress,
  testID,
  accessibilityLabel,
  className,
  glass,
}: {
  children: ReactNode;
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
  className?: string;
  /** Liquid Glass instead of a solid surface (see Glass). */
  glass?: boolean;
}) {
  if (glass) {
    const body = (
      <Glass testID={onPress ? undefined : testID} interactive={!!onPress} className={cn("p-4 gap-3", className)}>
        {children}
      </Glass>
    );
    return onPress ? (
      <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} className="active:opacity-80">
        {body}
      </Pressable>
    ) : (
      body
    );
  }
  const box = cn("rounded-theme bg-surface p-4 gap-3", className);
  const inner = <SurfaceContext.Provider value="card">{children}</SurfaceContext.Provider>;
  return onPress ? (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} className={cn(box, "active:opacity-80")} style={shadow.card}>
      {inner}
    </Pressable>
  ) : (
    <View testID={testID} className={box} style={shadow.card}>
      {inner}
    </View>
  );
}
