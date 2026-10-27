import { createElement } from "react";
import { Platform } from "react-native";
import { GlassFill } from "./Glass";
import { palettes } from "@/constants/theme";
import { colors } from "@/constants/theme";

/**
 * Screen options for expo-router/js-tabs. Pass the scheme's palette from useColors().
 * `{ glass: true }`: a Liquid Glass tab bar floating over the content (the screens scroll under it).
 */
export function tabsScreenOptions(c = colors, opts: { glass?: boolean } = {}) {
  return {
    headerShown: false,
    tabBarActiveTintColor: c.primary,
    tabBarInactiveTintColor: c.muted,
    tabBarStyle: {
      backgroundColor: opts.glass ? "transparent" : c.surface,
      borderTopColor: opts.glass ? "transparent" : c.border,
      ...(opts.glass ? { position: "absolute" as const, elevation: 0 } : {}),
      // The default 49 clips label descenders on web.
      ...(Platform.OS === "web" ? { height: 60, paddingBottom: 6 } : {}),
    },
    ...(opts.glass ? { tabBarBackground: () => createElement(GlassFill) } : {}),
    tabBarLabelStyle: { fontSize: 11, fontWeight: "600" as const },
  };
}
export { palettes };
