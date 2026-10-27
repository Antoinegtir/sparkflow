import { Platform } from "react-native";
import { palettes } from "@/constants/theme";
import { colors } from "@/constants/theme";

/** Screen options for expo-router/js-tabs. Pass the scheme's palette from useColors(). */
export function tabsScreenOptions(c = colors) {
  return {
    headerShown: false,
    tabBarActiveTintColor: c.primary,
    tabBarInactiveTintColor: c.muted,
    tabBarStyle: {
      backgroundColor: c.surface,
      borderTopColor: c.border,
      // The default 49 clips label descenders on web.
      ...(Platform.OS === "web" ? { height: 60, paddingBottom: 6 } : {}),
    },
    tabBarLabelStyle: { fontSize: 11, fontWeight: "600" as const },
  };
}
export { palettes };
