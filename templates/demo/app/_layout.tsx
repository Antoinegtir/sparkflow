import "../global.css";
import { router, Stack, useRootNavigationState } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useColors, useIsDark } from "@/constants/theme";
import { useWander, useWanderHydrated } from "@/lib/store";

/**
 * First launch on iOS/Android: once the saved store has loaded, open the welcome slides if they were
 * never seen. Never on web: the preview opens every page by URL and must land on the page it asked for.
 */
function useFirstLaunchWelcome() {
  const hydrated = useWanderHydrated();
  const onboarded = useWander((s) => s.onboarded);
  const navReady = !!useRootNavigationState()?.key;
  const decided = useRef(false);
  useEffect(() => {
    if (Platform.OS === "web" || decided.current || !hydrated || !navReady) return;
    decided.current = true;
    if (!onboarded) router.replace("/welcome");
  }, [hydrated, navReady, onboarded]);
}

export default function RootLayout() {
  const c = useColors();
  const dark = useIsDark();
  useFirstLaunchWelcome();
  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="place/[id]" />
        <Stack.Screen
          name="trip/new"
          options={{ presentation: "formSheet", sheetAllowedDetents: [0.75, 1], sheetGrabberVisible: true, sheetCornerRadius: 28 }}
        />
        <Stack.Screen name="welcome" options={{ animation: "fade", gestureEnabled: false, contentStyle: { backgroundColor: "#000000" } }} />
      </Stack>
    </>
  );
}
