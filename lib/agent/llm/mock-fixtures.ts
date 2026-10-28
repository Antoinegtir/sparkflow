import type { LLMPlan } from "../../shared";

/** Scripted sample app used when no model key is set: "Habitly", a habit tracker. */
export const MOCK_PLAN: LLMPlan = {
  name: "Habitly",
  theme: { primary: "#7C3AED", background: "#F6F5FB", font: null },
  dataModel: [
    { entity: "Habit", fields: [{ name: "id", type: "string" }, { name: "name", type: "string" }, { name: "icon", type: "string" }, { name: "done", type: "string[] (ISO dates)" }] },
  ],
  screens: [
    {
      route: "/(tabs)/index",
      file: "app/(tabs)/index.tsx",
      title: "Today",
      purpose: "Today's habits with a check button and the current streak of each.",
      components: ["Screen", "Header", "List", "ListItem", "ProgressBar", "Fab"],
      navigatesTo: ["/habit/[id]"],
      acceptance: [
        "A header reads \"Today\"",
        "At least three habit rows are listed, each with a check button",
        "A progress bar shows how many habits are done today",
        "A round add button floats at the bottom right",
      ],
      previewPath: "/",
    },
    {
      route: "/(tabs)/stats",
      file: "app/(tabs)/stats.tsx",
      title: "Stats",
      purpose: "Weekly completion chart and totals.",
      components: ["Screen", "Header", "Stat", "Card", "BarChart"],
      navigatesTo: [],
      acceptance: ["A header reads \"Stats\"", "Two stat tiles show totals", "A bar chart shows seven days"],
      previewPath: "/stats",
    },
    {
      route: "/(tabs)/settings",
      file: "app/(tabs)/settings.tsx",
      title: "Settings",
      purpose: "Reminders toggle and appearance.",
      components: ["Screen", "Header", "Toggle", "Segmented"],
      navigatesTo: [],
      acceptance: ["A header reads \"Settings\"", "A reminders toggle is visible", "An appearance control offers System, Light and Dark"],
      previewPath: "/settings",
    },
    {
      route: "/habit/[id]",
      file: "app/habit/[id].tsx",
      title: "Habit",
      purpose: "One habit: name, streak, and its last seven days.",
      components: ["Screen", "Header", "Stat", "Card", "BarChart", "Button"],
      navigatesTo: [],
      acceptance: ["A header with a back button shows the habit name", "A streak stat is visible", "A button marks the habit done today"],
      previewPath: "/habit/1",
    },
  ],
};

const STORE = `import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { uid } from "@/lib/id";
import { persistStorage } from "@/lib/storage";

export type Habit = { id: string; name: string; icon: string; done: string[] };

export const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
export const isDoneToday = (h: Habit) => h.done.includes(today());

export function streak(h: Habit) {
  let n = 0;
  while (h.done.includes(daysAgo(n + (isDoneToday(h) ? 0 : 1)))) n++;
  return n;
}

type State = { habits: Habit[]; add: (name: string) => void; toggle: (id: string) => void };

export const useStore = create<State>()(
  persist(
    (set) => ({
      habits: [
        { id: "1", name: "Read 20 pages", icon: "book-outline", done: [daysAgo(1), daysAgo(2), daysAgo(3)] },
        { id: "2", name: "Morning walk", icon: "walk-outline", done: [daysAgo(1)] },
        { id: "3", name: "Drink water", icon: "water-outline", done: [daysAgo(1), daysAgo(2)] },
      ],
      add: (name) => set((s) => ({ habits: [...s.habits, { id: uid(), name, icon: "sparkles-outline", done: [] }] })),
      toggle: (id) =>
        set((s) => ({
          habits: s.habits.map((h) =>
            h.id !== id ? h : { ...h, done: isDoneToday(h) ? h.done.filter((d) => d !== today()) : [...h.done, today()] },
          ),
        })),
    }),
    { name: "app-store-v1", storage: persistStorage },
  ),
);

export function useHabit(id: string | undefined) {
  const habits = useStore((s) => s.habits);
  return useMemo(() => habits.find((h) => h.id === id), [habits, id]);
}

export const lastWeek = (h: Habit) =>
  [6, 5, 4, 3, 2, 1, 0].map((n) => ({ label: new Date(Date.now() - n * 864e5).toDateString().slice(0, 2), value: h.done.includes(daysAgo(n)) ? 1 : 0 }));
`;

const TABS_LAYOUT = `import { Tabs } from "@/components/kit";

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: "Today", icon: { sf: "calendar", ion: "today-outline" } }} />
      <Tabs.Screen name="stats" options={{ title: "Stats", icon: { sf: "chart.bar.fill", ion: "stats-chart-outline" } }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", icon: { sf: "gearshape.fill", ion: "settings-outline" } }} />
    </Tabs>
  );
}
`;

const placeholder = (title: string, slug: string) => `import { Header, Screen } from "@/components/kit";

export default function Placeholder() {
  return (
    <Screen testID="${slug}-screen">
      <Header title="${title}" testID="${slug}-header" />
    </Screen>
  );
}
`;

export const MOCK_FOUNDATION: Record<string, string> = {
  "theme.json": JSON.stringify(
    {
      primary: "#7C3AED",
      background: "#F6F5FB",
      surface: "#FFFFFF",
      text: "#1E1B2E",
      muted: "#6B6880",
      border: "#E7E4F0",
      danger: "#DC2626",
      success: "#16A34A",
      radius: 16,
      dark: {},
    },
    null,
    2,
  ),
  "lib/store.ts": STORE,
  "app/(tabs)/_layout.tsx": TABS_LAYOUT,
  "app/(tabs)/index.tsx": placeholder("Today", "today"),
  "app/(tabs)/stats.tsx": placeholder("Stats", "stats"),
  "app/(tabs)/settings.tsx": placeholder("Settings", "settings"),
  "app/habit/[id].tsx": placeholder("Habit", "habit"),
};

// The first Today version has two accessibility issues on purpose (small, unlabeled check
// buttons) so the "Fix with the agent" flow has something to fix in mock mode.
const TODAY = (fixed: boolean) => `import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { Fab, Header, Icon, List, ListItem, ProgressBar, Screen, Text } from "@/components/kit";
import { useColors } from "@/constants/theme";
import { isDoneToday, streak, useStore } from "@/lib/store";

export default function Today() {
  const c = useColors();
  const habits = useStore((s) => s.habits);
  const toggle = useStore((s) => s.toggle);
  const add = useStore((s) => s.add);
  const done = useMemo(() => habits.filter(isDoneToday).length, [habits]);
  return (
    <Screen testID="today-screen">
      <Header title="Today" subtitle={\`\${done} of \${habits.length} done\`} testID="today-header" />
      <ProgressBar value={habits.length ? done / habits.length : 0} testID="today-progress" />
      <List testID="today-list">
        {habits.map((h) => (
          <ListItem
            key={h.id}
            testID={\`today-habit-\${h.id}\`}
            title={h.name}
            subtitle={\`\${streak(h)} day streak\`}
            icon={h.icon as never}
            onPress={() => router.push(\`/habit/\${h.id}\`)}
            right={
              <Pressable
                testID={\`today-check-\${h.id}\`}
                onPress={() => toggle(h.id)}
                accessibilityRole="checkbox"
                ${fixed ? "accessibilityLabel={`Mark ${h.name} done`}\n                " : ""}accessibilityState={{ checked: isDoneToday(h) }}
                className="${fixed ? "h-11 w-11" : "h-7 w-7"} items-center justify-center">
                <View className={isDoneToday(h) ? "h-7 w-7 items-center justify-center rounded-full bg-primary" : "h-7 w-7 rounded-full border-2 border-border"}>
                  {isDoneToday(h) ? <Icon name="checkmark" size={16} color={c.onPrimary} /> : null}
                </View>
              </Pressable>
            }
          />
        ))}
      </List>
      <Text variant="caption" className="text-center">Tap a habit to see its week.</Text>
      <Fab accessibilityLabel="Add a habit" testID="today-add" onPress={() => add("New habit")} />
    </Screen>
  );
}
`;

const STATS = `import { useMemo } from "react";
import { View } from "react-native";
import { BarChart, Card, Header, Screen, Stat, Text } from "@/components/kit";
import { streak, useStore } from "@/lib/store";

export default function Stats() {
  const habits = useStore((s) => s.habits);
  const week = useMemo(
    () =>
      [6, 5, 4, 3, 2, 1, 0].map((n) => {
        const d = new Date(Date.now() - n * 864e5);
        const key = d.toISOString().slice(0, 10);
        return { label: d.toDateString().slice(0, 2), value: habits.filter((h) => h.done.includes(key)).length };
      }),
    [habits],
  );
  const total = week.reduce((a, d) => a + d.value, 0);
  const best = Math.max(0, ...habits.map(streak));
  return (
    <Screen testID="stats-screen">
      <Header title="Stats" subtitle="Last 7 days" testID="stats-header" />
      <View className="flex-row gap-3">
        <Stat label="Check-ins" value={total} testID="stats-total" />
        <Stat label="Best streak" value={\`\${best}d\`} testID="stats-best" />
      </View>
      <Card testID="stats-week">
        <Text variant="subheading">This week</Text>
        <BarChart data={week} testID="stats-chart" />
      </Card>
    </Screen>
  );
}
`;

const SETTINGS = `import { useState } from "react";
import { Card, Header, Screen, Section, Segmented, Toggle } from "@/components/kit";
import { useAppearance } from "@/constants/theme";

export default function Settings() {
  const [reminders, setReminders] = useState(true);
  const { scheme, setScheme } = useAppearance();
  return (
    <Screen testID="settings-screen">
      <Header title="Settings" testID="settings-header" />
      <Section title="Reminders">
        <Card>
          <Toggle label="Daily reminder at 8:00" value={reminders} onValueChange={setReminders} testID="settings-reminders" />
        </Card>
      </Section>
      <Section title="Appearance">
        <Segmented
          testID="settings-appearance"
          value={scheme}
          onChange={setScheme}
          options={[
            { value: "system", label: "System" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
      </Section>
    </Screen>
  );
}
`;

const HABIT = `import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { BarChart, Button, Card, EmptyState, Header, Screen, Stat, Text } from "@/components/kit";
import { isDoneToday, lastWeek, streak, useHabit, useStore } from "@/lib/store";

export default function HabitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const habit = useHabit(id);
  const toggle = useStore((s) => s.toggle);
  if (!habit) {
    return (
      <Screen testID="habit-screen">
        <Header title="Habit" back testID="habit-header" />
        <EmptyState title="Not found" message="This habit no longer exists." testID="habit-missing" />
      </Screen>
    );
  }
  return (
    <Screen testID="habit-screen">
      <Header title={habit.name} back testID="habit-header" />
      <View className="flex-row gap-3">
        <Stat label="Streak" value={\`\${streak(habit)}d\`} testID="habit-streak" />
        <Stat label="Total" value={habit.done.length} testID="habit-total" />
      </View>
      <Card testID="habit-week">
        <Text variant="subheading">Last 7 days</Text>
        <BarChart data={lastWeek(habit)} height={80} testID="habit-chart" />
      </Card>
      <Button
        title={isDoneToday(habit) ? "Done today" : "Mark done today"}
        icon={isDoneToday(habit) ? "checkmark-circle" : "ellipse-outline"}
        variant={isDoneToday(habit) ? "secondary" : "primary"}
        onPress={() => toggle(habit.id)}
        testID="habit-toggle"
      />
    </Screen>
  );
}
`;

export const MOCK_SCREENS: Record<string, Record<string, string>> = {
  "/(tabs)/index": { "app/(tabs)/index.tsx": TODAY(false) },
  "/(tabs)/stats": { "app/(tabs)/stats.tsx": STATS },
  "/(tabs)/settings": { "app/(tabs)/settings.tsx": SETTINGS },
  "/habit/[id]": { "app/habit/[id].tsx": HABIT },
};

export const MOCK_A11Y_FIXES: Record<string, Record<string, string>> = {
  "/(tabs)/index": { "app/(tabs)/index.tsx": TODAY(true) },
};
