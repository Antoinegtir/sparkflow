// Kit gallery placeholder. The orchestrator deletes this file unless the plan uses "/".
import { useState } from "react";
import { View } from "react-native";
import { Avatar, Badge, BarChart, Button, Card, EmptyState, Header, Input, List, ListItem, ProgressBar, Screen, Section, Segmented, Stat, Toggle } from "@/components/kit";
import { useAppearance } from "@/constants/theme";

export default function Gallery() {
  const [on, setOn] = useState(true);
  const { scheme, setScheme } = useAppearance();
  return (
    <Screen testID="gallery-screen">
      <Header title="Kit" subtitle="Sparkflow components" testID="gallery-header" right={<Avatar name="Spark Flow" />} />
      <Segmented
        testID="gallery-scheme"
        value={scheme}
        onChange={setScheme}
        options={[
          { value: "system", label: "System" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
      />
      <View className="flex-row gap-3">
        <Stat label="Streak" value="12" hint="days" />
        <Stat label="Done" value="84%" />
      </View>
      <Card testID="gallery-card">
        <BarChart data={["M", "T", "W", "T", "F", "S", "S"].map((label, i) => ({ label, value: [3, 5, 2, 6, 4, 1, 5][i] }))} />
        <ProgressBar value={0.6} />
      </Card>
      <Section title="List">
        <List>
          <ListItem title="Notifications" icon="notifications-outline" chevron onPress={() => {}} />
          <ListItem title="Status" right={<Badge label="New" />} icon="star-outline" />
        </List>
      </Section>
      <Input label="Search" icon="search" placeholder="Type here" testID="gallery-search" />
      <Toggle label="Reminders" value={on} onValueChange={setOn} testID="gallery-reminders" />
      <Button title="Primary" icon="add" testID="gallery-button" />
      <EmptyState title="Nothing yet" message="Your items will show up here." />
    </Screen>
  );
}
