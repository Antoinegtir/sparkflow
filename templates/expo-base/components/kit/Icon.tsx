import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";
import { useColors } from "@/constants/theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

/** Ionicons glyph. `color` also takes the ColorValue that tab bars pass to tabBarIcon. */
export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: ColorValue }) {
  const c = useColors();
  return <Ionicons name={name} size={size} color={(color ?? c.text) as string} />;
}
