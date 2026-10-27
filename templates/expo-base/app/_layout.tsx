import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColors, useIsDark } from "@/constants/theme";

export default function RootLayout() {
  const c = useColors();
  const dark = useIsDark();
  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }} />
    </>
  );
}
