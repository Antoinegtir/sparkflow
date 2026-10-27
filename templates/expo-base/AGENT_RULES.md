# Rules for this Expo project

You are editing an Expo Router app (Expo SDK 58, React Native 0.88, NativeWind 4, zustand 5). Follow every rule below.

## Routes

- Every screen is a file under `app/`. Route = file path without `app/` and the extension (`app/habit/[id].tsx` → `/habit/[id]`).
- Groups in parentheses do not appear in URLs: `app/(tabs)/stats.tsx` is opened at `/stats`.
- `index.tsx` is the folder's root: `app/(tabs)/index.tsx` is `/`. Never have both `app/index.tsx` and `app/(tabs)/index.tsx`.
- Bottom tabs: put tab screens in `app/(tabs)/` with this layout, and keep detail screens outside the group:

```tsx
// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router/js-tabs";
import { Icon, tabsScreenOptions } from "@/components/kit";
import { useColors } from "@/constants/theme";

export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs screenOptions={tabsScreenOptions(c)}>
      <Tabs.Screen name="index" options={{ title: "Today", tabBarIcon: ({ color }) => <Icon name="today-outline" color={color} /> }} />
      <Tabs.Screen name="stats" options={{ title: "Stats", tabBarIcon: ({ color }) => <Icon name="stats-chart-outline" color={color} /> }} />
    </Tabs>
  );
}
```

- Import with the `@/` alias (`@/components/kit`, `@/lib/store`, `@/constants/theme`).

## Never edit

`app/+html.tsx`, `components/kit/`, `components/sparkflow/`, `constants/theme.ts`, `constants/palette.js`, `constants/palette.d.ts`, `babel.config.js`, `metro.config.js`, `tailwind.config.js`, `tsconfig.json`, `package.json`, `package-lock.json`, `global.css`, this file.

`theme.json` may be rewritten, keeping the same keys.

## UI

- Build screens only from the kit (`@/components/kit`) and plain `View` / `Pressable`. Use Ionicons names for icons.
- Colors come from theme tokens only: `bg-background`, `bg-surface`, `bg-primary`, `text-text`, `text-muted`, `text-primary`, `text-danger`, `text-success`, `text-on-primary`, `border-border`, `rounded-theme`. Opacity modifiers work (`bg-primary/10`).
- Class names must be literal strings. Put dynamic numbers (widths, heights) in `style`.
- In JS, use `useColors()` for a color and `withAlpha("primary", 0.2)` for a translucent one. Never do string math on colors: on web they are CSS variables.
- All text goes inside the kit `<Text>`.
- No `window`, `document`, `localStorage` or `Alert.alert` (the web build renders on the server).

## Dark mode

Dark mode is automatic: tokens switch by themselves. Never write `dark:` classes or check `useColorScheme()`.
The root layout already sets the StatusBar and the screen background. If the app has a Settings screen, add an appearance control:

```tsx
const { scheme, setScheme } = useAppearance();
<Segmented testID="settings-appearance" value={scheme} onChange={setScheme}
  options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
```

## Accessibility

- Every pressable has `accessibilityRole` and `accessibilityLabel`.
- Touch targets are at least 44×44 (`h-11 w-11`); `hitSlop` does not count.
- Text contrast is at least 4.5:1 (3:1 for large text). Use `text-text` or `text-muted` on `bg-surface`/`bg-background`.
- Nothing may overflow horizontally at 390 px wide.

## testID

Every meaningful element gets a unique `testID` prefixed with the screen slug: `home-screen` on the `<Screen>`, `home-add-button`, `home-habit-${id}`.
Kit components derive child ids from yours: `${id}-input` (Input), `${id}-switch` (Toggle), `${id}-${value}` (Segmented), `${id}-back` and `${id}-title` (Header), `${id}-action` (EmptyState).

## Navigation

Use `<Link href="/habit/1">` or `router.push("/habit/1")` with real URL paths, never group names. Detail screens use `<Header back />`.

## Data

Keep app data in a zustand store with persistence:

```ts
// lib/store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { persistStorage } from "@/lib/storage";
import { uid } from "@/lib/id";

type Habit = { id: string; name: string };
type State = { habits: Habit[]; add: (name: string) => void };

export const useStore = create<State>()(
  persist(
    (set) => ({
      habits: [{ id: "1", name: "Read" }, { id: "2", name: "Walk" }, { id: "3", name: "Water" }],
      add: (name) => set((s) => ({ habits: [...s.habits, { id: uid(), name }] })),
    }),
    { name: "app-store-v1", storage: persistStorage },
  ),
);
```

- Seed at least 3 items with ids "1", "2", "3" so dynamic routes like `/habit/1` work on first launch.
- Bump the store name (`app-store-v2`) when the shape of the data changes.
- Selectors must not build new arrays or objects (`useStore((s) => s.habits.filter(...))` loops forever). Select the raw array, then derive with `useMemo`.
- Never throw during render. A missing item shows `<EmptyState title="Not found" />`.

## Kit reference

- `Screen({ testID, scroll? })`: page container with safe area, scroll, 20 px gutters and 16 px gap. A `Fab` child floats above the content.
- `Header({ title, subtitle?, back?, right?, testID })`
- `Text({ variant?: "title" | "heading" | "subheading" | "body" | "caption" | "label", className? })`
- `Card({ onPress?, testID, accessibilityLabel?, className? })`
- `List({ testID })` wraps `ListItem({ title, subtitle?, icon?, left?, right?, chevron?, onPress?, testID })`
- `Section({ title, right?, testID })`
- `Button({ title, onPress, variant?: "primary" | "secondary" | "ghost" | "danger", icon?, loading?, disabled?, testID })`
- `IconButton({ icon, onPress, accessibilityLabel, variant?: "plain" | "filled" | "tinted", testID })`
- `Fab({ icon?, onPress, accessibilityLabel, testID })`
- `Input({ label?, icon?, value, onChangeText, placeholder?, testID })`
- `Segmented({ options: { value, label }[], value, onChange, testID })`
- `Toggle({ label, value, onValueChange, testID })`, `Switch({ value, onValueChange, accessibilityLabel, testID })`
- `EmptyState({ icon?, title, message?, actionTitle?, onAction?, testID })`
- `BarChart({ data: { label, value }[], height?, testID })`, `ProgressBar({ value: 0..1, testID })`
- `Stat({ label, value, hint?, testID })`, `Badge({ label, tone?: "primary" | "success" | "danger" | "neutral" })`
- `Avatar({ name, uri?, size?: "sm" | "md" | "lg" })`, `Icon({ name, size?, color? })`, `Divider({ inset? })`
- `tabsScreenOptions(colors)` for `expo-router/js-tabs`.

## Packages

Use only the packages already installed. Never run `npm install`.

## Done means

- `npx tsc --noEmit` passes.
- Every route renders at 390×844 without errors.
- Dynamic routes work with the seeded ids.
- Every interactive element has a testID.
