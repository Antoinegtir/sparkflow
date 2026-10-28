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
      <Header title="Profil" testID="profile-header" />
      <Card testID="profile-card">
        <View className="flex-row items-center gap-4">
          <Avatar name="Camille Martin" size="lg" />
          <View className="flex-1">
            <Text variant="heading">Camille Martin</Text>
            <Text variant="caption">Exploratrice niveau 4 · Paris</Text>
          </View>
        </View>
        <View className="gap-1.5">
          <View className="flex-row justify-between">
            <Text variant="caption">Objectif 2026 : 8 pays</Text>
            <Text variant="caption">{countries}/8</Text>
          </View>
          <ProgressBar value={countries / 8} />
        </View>
      </Card>
      <View className="flex-row gap-3">
        <Stat label="Voyages" value={String(trips.length)} />
        <Stat label="Favoris" value={String(saved)} />
        <Stat label="Pays" value={String(countries)} />
      </View>
      <Section title="Apparence">
        <Segmented
          testID="profile-scheme"
          value={scheme}
          onChange={setScheme}
          options={[
            { value: "system", label: "Auto" },
            { value: "light", label: "Clair" },
            { value: "dark", label: "Sombre" },
          ]}
        />
      </Section>
      <Section title="Préférences">
        <Toggle label="Alertes prix" value={alerts} onValueChange={setAlerts} testID="profile-alerts" />
        <List>
          <ListItem title="Devise" icon="cash-outline" right={<Text variant="caption">EUR €</Text>} />
          <ListItem title="Aéroport de départ" icon="airplane-outline" right={<Text variant="caption">CDG</Text>} />
          <ListItem title="Aide et contact" icon="help-circle-outline" chevron onPress={() => {}} />
        </List>
      </Section>
    </Screen>
  );
}
