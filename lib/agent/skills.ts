/**
 * Mobile skills: short, exact recipes for iOS / Android features users ask for by name ("liquid
 * glass", "haptics", "bottom sheet"…). The Builder sees the index in its system prompt and reads a
 * skill with the `skill` tool; a request that names one gets it inlined in the task right away.
 *
 * Every recipe works in Expo Go (SDK 58) and keeps the web build rendering, since pages are
 * verified on web screenshots.
 */
export type Skill = {
  name: string;
  title: string;
  when: string;
  triggers: RegExp;
  body: string;
  /** Recipe for the user's own app (no Expo Router, NativeWind or kit); without it `body` is adapted. */
  native?: string;
};

const INSTALL = (pkg: string) =>
  `Installed in new apps. If \`${pkg}\` is missing from package.json (older app), run \`npx expo install ${pkg}\` first (allowed: it edits package.json for you).`;

export const SKILLS: Skill[] = [
  {
    name: "liquid-glass",
    title: "Liquid Glass (iOS 26)",
    when: "liquid glass, glass, glassy / translucent iOS 26 look, frosted cards or bars",
    triggers: /liquid\s*glass|\bglass(y|morphism)?\b|\bverre\b|ios\s*26|translucid|translucent/i,
    body: `Apple's real Liquid Glass comes from expo-glass-effect (in Expo Go). Never fake it with bg-surface/60, backdrop-blur or borders.

- Kit (new apps): \`<Card glass>\`, \`<Glass variant="regular" | "clear" interactive? tint?>\`, \`<GlassFill />\` (fills its parent), \`liquidGlass\` (true on iOS 26). They fall back to a blurred translucent surface on web, Android and older iOS.
- Older app without components/kit/Glass.tsx: write \`components/glass.tsx\`:
\`\`\`tsx
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { cssInterop } from "nativewind";
import { Platform, View, type ViewProps } from "react-native";
cssInterop(GlassView, { className: "style" }); // required, see below
const real = Platform.OS === "ios" && isLiquidGlassAvailable();
export function Glass({ className, ...p }: ViewProps & { className?: string }) {
  return real ? <GlassView glassEffectStyle="regular" className={\`rounded-theme overflow-hidden \${className ?? ""}\`} {...p} />
    : <View className={\`rounded-theme overflow-hidden border border-white/30 bg-surface/70 \${className ?? ""}\`} {...p} />;
}
\`\`\`
- GlassView is a native view: NativeWind ignores its className unless it is registered once with \`cssInterop(GlassView, { className: "style" })\` (the kit does it). Without it, padding and rounded corners vanish and the cards look flat and broken.
- Don't put glass inside a kit List or Card (they draw their own solid surface): use glass cards directly on the screen.
- Glass shows what is behind it: give the screen a colored or image background (a LinearGradient in Screen's background, see "gradients"), or let content scroll under a floating glass bar. Over a flat color it is nearly invisible.
- Glass tab bar: \`tabsScreenOptions(c, { glass: true })\`; it floats, so end each tab screen with \`<View className="h-24" />\`.
- Keep text \`text-text\` / \`text-muted\` (4.5:1 contrast).`,
    native: `Liquid Glass is a native iOS 26 material: it must come from a native view. Never fake it with rgba backgrounds, borders, shadows, backdrop-filter, BlurView or a gradient: that is NOT Liquid Glass.

Use the glass package the project already has (see its dependencies):
- @callstack/liquid-glass:
\`\`\`tsx
import { LiquidGlassView, LiquidGlassContainerView, isLiquidGlassSupported } from "@callstack/liquid-glass";
<LiquidGlassView effect="regular" interactive tintColor={undefined} style={[{ borderRadius: 24, padding: 16 }, !isLiquidGlassSupported && { backgroundColor: "rgba(255,255,255,0.8)" }]}>…</LiquidGlassView>
// Shapes that merge when close: wrap them in <LiquidGlassContainerView spacing={12}>.
\`\`\`
- expo-glass-effect:
\`\`\`tsx
import { GlassView, GlassContainer, isLiquidGlassAvailable } from "expo-glass-effect";
<GlassView glassEffectStyle="regular" isInteractive style={[{ borderRadius: 24, padding: 16 }, !isLiquidGlassAvailable() && { backgroundColor: "rgba(255,255,255,0.8)" }]}>…</GlassView>
\`\`\`
- Style glass with \`style\` (radius, padding, overflow). The solid fallback is only for devices without iOS 26.
- Native tab bars (@bottom-tabs/react-navigation, expo-router/unstable-native-tabs) and native headers / UIKit controls already become Liquid Glass on iOS 26: don't paint a background over them (remove opaque tabBarStyle / headerStyle backgrounds instead).
- Glass shows what is behind it: put it over scrolling content, an image or a colored background, not over a flat color.
- If neither package is installed: don't imitate it. Finish and tell the user to run \`npx expo install expo-glass-effect\` (Expo) or \`npm i @callstack/liquid-glass\` + pod install, then ask again.`,
  },
  {
    name: "haptics",
    title: "Haptic feedback",
    when: "haptics, vibration, tactile feedback, a tap that should feel physical",
    triggers: /haptic|vibrat|tactile|taptic/i,
    body: `${INSTALL("expo-haptics")}

\`\`\`ts
import * as Haptics from "expo-haptics";
Haptics.selectionAsync();                                             // toggles, segmented, pickers
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);               // buttons, cards (Medium / Heavy for bigger actions)
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);  // task done, saved (Warning / Error)
\`\`\`
- Fire it in the press handler, before the state change. It is a no-op on web: no guard needed, but never await it.
- Use it for meaningful moments (complete, delete, toggle), not on every tap.`,
  },
  {
    name: "animations",
    title: "Animations (Reanimated 4)",
    when: "animations, transitions, smooth / lively / fluid UI, items appearing, springy buttons",
    triggers: /anim|transition|smooth|fluid|fluide|lively|vivant|spring|bounce|micro.?interaction/i,
    body: `react-native-reanimated 4 is installed (works on web too).

- Lists and cards appearing / leaving / reordering:
\`\`\`tsx
import Animated, { FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";
{items.map((it, i) => (
  <Animated.View key={it.id} entering={FadeInDown.delay(i * 50).springify()} exiting={FadeOut} layout={LinearTransition.springify()}>
    <Card …/>
  </Animated.View>
))}
\`\`\`
- Press scale:
\`\`\`tsx
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
const s = useSharedValue(1);
const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
<Pressable onPressIn={() => (s.value = withSpring(0.96))} onPressOut={() => (s.value = withSpring(1))} …>
  <Animated.View style={style}>…</Animated.View>
</Pressable>
\`\`\`
- Progress / numbers: animate a shared value with \`withTiming(v, { duration: 600 })\` and read it in \`useAnimatedStyle\` (width as a percentage string).
- Put animated values in \`style\`; keep NativeWind classes on a plain inner View.
- Keep it short (150–400 ms) and avoid animating every element at once.`,
  },
  {
    name: "gestures",
    title: "Gestures: swipe actions, drag",
    when: "swipe to delete / complete, drag, pan, long press, pinch",
    triggers: /swipe|glisser|drag|pan\b|pinch|long.?press|appui long|gesture|geste/i,
    body: `react-native-gesture-handler 3 is installed. Gestures need the root wrapped once, in app/_layout.tsx:
\`\`\`tsx
import { GestureHandlerRootView } from "react-native-gesture-handler";
return <GestureHandlerRootView style={{ flex: 1 }}>{/* StatusBar + Stack */}</GestureHandlerRootView>;
\`\`\`
- Swipe actions on a row:
\`\`\`tsx
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
<ReanimatedSwipeable friction={2} rightThreshold={40} renderRightActions={() => (
  <Pressable accessibilityRole="button" accessibilityLabel="Delete" onPress={remove} className="w-20 items-center justify-center bg-danger"><Icon name="trash-outline" color="white" /></Pressable>
)}>{row}</ReanimatedSwipeable>
\`\`\`
- Custom drag: \`Gesture.Pan().onUpdate(e => { x.value = e.translationX })\` inside \`<GestureDetector gesture={pan}>\` with an Animated.View.
- Swipes don't happen in web screenshots: keep a visible button for the same action (accessibility too).`,
  },
  {
    name: "sheets",
    title: "Bottom sheets and modals",
    when: "bottom sheet, modal, sheet, popup form, half-screen panel",
    triggers: /bottom.?sheet|\bsheets?\b|\bmodale?s?\b|pop.?up|feuille|panneau/i,
    body: `Use the native sheet from expo-router (iOS form sheet with detents and grabber; a modal page on Android and web).

1. The sheet is a route, e.g. app/new-task.tsx (outside (tabs)).
2. In app/_layout.tsx declare it on the Stack:
\`\`\`tsx
<Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }}>
  <Stack.Screen name="new-task" options={{ presentation: "formSheet", sheetAllowedDetents: [0.5, 1], sheetGrabberVisible: true, sheetCornerRadius: 24 }} />
</Stack>
\`\`\`
3. Open it with \`router.push("/new-task")\`, close with \`router.back()\`.
- Inside, use \`<Screen>\` with a short header; a form's submit button stays visible at 50 %.
- A full-screen modal: \`presentation: "modal"\`.`,
  },
  {
    name: "blur",
    title: "Blur",
    when: "blur, frosted header / overlay (not Liquid Glass)",
    triggers: /\bblur|flou|frosted/i,
    body: `${INSTALL("expo-blur")}

\`\`\`tsx
import { BlurView } from "expo-blur";
<BlurView intensity={40} tint="systemChromeMaterial" style={StyleSheet.absoluteFill} />   // or "light" / "dark" / "default"
\`\`\`
- Works on web (CSS backdrop-filter). On Android add \`experimentalBlurMethod="dimezisBlurView"\` for a real blur.
- For iOS 26 Liquid Glass use the "liquid-glass" skill instead.`,
  },
  {
    name: "sf-symbols",
    title: "SF Symbols / platform icons",
    when: "SF Symbols, native iOS icons, Apple-style icons",
    triggers: /sf.?symbol|symbol|ic[oô]ne?s? (ios|apple|natives?)/i,
    body: `${INSTALL("expo-symbols")}

\`\`\`tsx
import { SymbolView } from "expo-symbols";
<SymbolView name="heart.fill" tintColor={c.primary} size={22} fallback={<Icon name="heart" color={c.primary} />} />
\`\`\`
- SF Symbols render on iOS only: always pass the Ionicons \`fallback\` (Android and the web screenshots use it).
- Animated symbols: \`animationSpec={{ effect: { type: "bounce" } }}\`.`,
  },
  {
    name: "gradients",
    title: "Gradients",
    when: "gradient, colorful / vivid background, mesh-like hero",
    triggers: /gradient|d[ée]grad[ée]|colorful|vivid|color[ée]/i,
    body: `${INSTALL("expo-linear-gradient")}

\`\`\`tsx
import { LinearGradient } from "expo-linear-gradient";
<LinearGradient colors={[withAlpha("primary", 0.35), withAlpha("primary", 0.05)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
\`\`\`
- Colors from \`withAlpha(...)\` / \`useColors()\`, never hex math. Works on web.
- As a screen background: put it first inside the screen's root View (absolute), content above it.`,
  },
  {
    name: "photos",
    title: "Photo picker and camera",
    when: "pick a photo, avatar upload, image from library, take a picture",
    triggers: /photo|picture|image picker|avatar|galerie|gallery|camera|cam[ée]ra/i,
    body: `${INSTALL("expo-image-picker")}

\`\`\`ts
import * as ImagePicker from "expo-image-picker";
const pick = async () => {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
  if (!r.canceled) setUri(r.assets[0].uri);
};
// Camera: await ImagePicker.requestCameraPermissionsAsync(); then launchCameraAsync({ … }).
\`\`\`
- Show the image with expo-image (\`<Image source={{ uri }} contentFit="cover" />\`), keep a placeholder (Avatar initials) until one is picked.
- Store the uri in the zustand store.`,
  },
  {
    name: "notifications",
    title: "Local notifications and reminders",
    when: "reminders, daily notification, alarm-like alerts (local, no server)",
    triggers: /notif|reminder|rappel|alarm/i,
    body: `Run \`npx expo install expo-notifications\` (not preinstalled). Local notifications work in Expo Go; remote push does not.

\`\`\`ts
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
export async function scheduleDaily(hour: number, minute: number, title: string) {
  if (Platform.OS === "web") return;
  const { granted } = await Notifications.requestPermissionsAsync();
  if (!granted) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({ content: { title }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute } });
}
\`\`\`
- Call it from the settings toggle / time picker, never on render. Unsupported on web: always guard Platform.OS.`,
  },
  {
    name: "share-clipboard",
    title: "Share sheet, clipboard, links",
    when: "share, copy to clipboard, open a link / email / phone",
    triggers: /share|partag|clipboard|copy|copier|presse.?papier|open (a |the )?link|mailto|tel:/i,
    body: `- Share sheet (core RN, works everywhere): \`import { Share } from "react-native"; await Share.share({ message: "…" });\`
- Clipboard: ${INSTALL("expo-clipboard")} \`import * as Clipboard from "expo-clipboard"; await Clipboard.setStringAsync(text);\` then a short confirmation (Badge / toast text).
- Links: \`import { openURL } from "expo-linking"; openURL("mailto:…")\`.`,
  },
  {
    name: "platform",
    title: "iOS vs Android conventions",
    when: "native feel, iOS-like / Material / Android-specific design, platform differences",
    triggers: /native feel|natif|material|android|ios.?like|look ios|style ios|apple.?like|platform/i,
    body: `- \`Platform.select({ ios: …, android: …, default: … })\` or \`Platform.OS\` for differences. Web counts as "default".
- iOS: large bold titles, grouped inset lists (kit List), SF Symbols (skill "sf-symbols"), sheets with grabbers (skill "sheets"), subtle haptics (skill "haptics"), swipe actions on rows.
- Android: ripple on pressables (\`android_ripple={{ color: withAlpha("primary", 0.12) }}\`), FAB for the main action (kit Fab), back button handled by the Stack.
- Keep one design system: adapt details, don't build two UIs.`,
  },
  {
    name: "lists",
    title: "Long lists, pull to refresh",
    when: "long list, feed, infinite scroll, pull to refresh, sections",
    triggers: /feed|infinite|pull.?to.?refresh|rafra[iî]ch|long list|beaucoup d'?[ée]l[ée]ments|section list/i,
    body: `- More than ~30 rows: \`FlatList\` (or \`SectionList\`) instead of mapping in a ScrollView; \`keyExtractor={(i) => i.id}\`, \`contentContainerClassName="px-5 gap-3 pb-24"\`.
- A FlatList scrolls by itself: use \`<Screen scroll={false}>\` around it.
- Pull to refresh: \`refreshControl={<RefreshControl refreshing={busy} onRefresh={reload} tintColor={c.primary} />}\`.
- Empty: \`ListEmptyComponent={<EmptyState … />}\`.`,
  },
  {
    name: "keyboard-forms",
    title: "Forms and keyboard",
    when: "forms, text inputs, login / sign-up, chat input, keyboard covering fields",
    triggers: /\bforms?\b|formulaire|\binputs?\b|login|sign.?up|inscription|connexion|keyboard|clavier|\bchat\b/i,
    body: `- Wrap form screens' content in \`<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>\` and set \`keyboardShouldPersistTaps="handled"\` on scroll views.
- Chain fields: \`returnKeyType="next"\` + \`onSubmitEditing={() => next.current?.focus()}\`; last field \`returnKeyType="done"\` submits.
- Right keyboards: \`keyboardType="email-address"\`, \`autoCapitalize="none"\`, \`textContentType="emailAddress" | "password"\`, \`secureTextEntry\` for passwords.
- Disable the submit button until the form is valid; show errors under the field in \`text-danger\`.`,
  },
];

/** Reminds the model the result is a phone app: native features come from native modules. */
export const MOBILE_CONTEXT = `# You are building a native mobile app

This is a real iOS / Android app running on a phone (Expo Go or the simulator), not a website. A web preview is only used for screenshots.
- Words like "liquid glass", "haptics", "sheet", "blur", "SF Symbols", "native tabs" name native iOS / Android features. Implement them with the native module from the matching skill, never with a CSS look-alike (semi-transparent backgrounds, borders, shadows, backdrop-filter, gradients). If a native effect doesn't show on the web preview, that is expected.
- Follow Apple's Human Interface Guidelines and Material Design: safe areas, 44 pt touch targets, native navigation (stacks, tabs, sheets), system fonts, dynamic type, dark mode, haptics on meaningful actions.
- Think like a mobile designer: thumb reach, one primary action per screen, content scrolling under translucent bars.`;

/** Index for the system prompt: what exists and when to read it. */
export function skillsIndex(native = false) {
  return `# Mobile skills

Exact recipes for iOS / Android features. When a request touches one of these, read it with the \`skill\` tool before writing code and follow it${native ? ", adapted to this project (its own styling and navigation, only packages it already has)" : " (it may add packages and components beyond the kit)"}. Look at what the user really wants: "make it feel native", "more alive", "like iOS 26" map to these.

${SKILLS.map((s) => `- ${s.name}: ${s.title}. Use for: ${s.when}.`).join("\n")}`;
}

export const skillByName = (name: string) => SKILLS.find((s) => s.name === name.trim().toLowerCase());

const NATIVE_NOTE = "Written for Expo Router + NativeWind + the Sparkflow kit: keep the native modules and APIs, but use this project's own styling and navigation, and only packages it already has (otherwise tell the user what to install).";

/** A skill's text; `native`: for the user's own app. */
export function skillBody(s: Skill, native = false) {
  if (!native) return s.body;
  return s.native ?? `${NATIVE_NOTE}\n\n${s.body}`;
}

/** Skills a request names outright, inlined in its task so the Builder starts with them. */
export function skillsFor(text: string, max = 3, native = false) {
  const hits = SKILLS.filter((s) => s.triggers.test(text)).slice(0, max);
  if (!hits.length) return "";
  return `\nSkills for this request (follow them):\n\n${hits.map((s) => `## ${s.title} (${s.name})\n\n${skillBody(s, native)}`).join("\n\n")}\n`;
}
