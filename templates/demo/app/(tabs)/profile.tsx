import { View } from "react-native";
import { Avatar, Card, Header, List, ListItem, ProgressBar, Screen, Section, Segmented, Stat, Text, Toggle } from "@/components/kit";
import { useAppearance } from "@/constants/theme";
import { useState } from "react";
import { placeById, useWander } from "@/lib/store";

export default function Profile() {
  const { scheme, setScheme } = useAppearance();
  const trips = useWander((s) => s.trips);
  const saved = useWander((s) => s.saved.length);
  const [alerts, setAlerts] = useState(true);
  const countries = new Set(trips.flatMap((t) => t.placeIds.map((id) => placeById(id)?.country))).size;
  return (
    <Screen testID="profile-screen">
      <Header title="Profile" testID="profile-header" />
      <Card testID="profile-card">
        <View className="flex-row items-center gap-4">
          <Avatar name="Camille Martin" size="lg" />
          <View className="flex-1">
            <Text variant="heading">Camille Martin</Text>
            <Text variant="caption">Level 4 Explorer · Paris</Text>
          </View>
        </View>
        <View className="gap-1.5">
          <View className="flex-row justify-between">
            <Text variant="caption">2026 goal: 8 countries</Text>
            <Text variant="caption">{countries}/8</Text>
          </View>
          <ProgressBar value={countries / 8} />
        </View>
      </Card>
      <View className="flex-row gap-3">
        <Stat label="Trips" value={String(trips.length)} />
        <Stat label="Saved" value={String(saved)} />
        <Stat label="Countries" value={String(countries)} />
      </View>
      <Section title="Appearance">
        <Segmented
          testID="profile-scheme"
          value={scheme}
          onChange={setScheme}
          options={[
            { value: "system", label: "Auto" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
      </Section>
      <Section title="Preferences">
        <Toggle label="Price alerts" value={alerts} onValueChange={setAlerts} testID="profile-alerts" />
        <List>
          <ListItem title="Currency" icon="cash-outline" right={<Text variant="caption">EUR €</Text>} />
          <ListItem title="Home airport" icon="airplane-outline" right={<Text variant="caption">CDG</Text>} />
          <ListItem title="Help & contact" icon="help-circle-outline" chevron onPress={() => {}} />
        </List>
      </Section>
    </Screen>
  );
}
