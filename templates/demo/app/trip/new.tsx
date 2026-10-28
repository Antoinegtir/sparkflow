import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Icon, IconButton, Input, Segmented, Text } from "@/components/kit";
import { success, tap } from "@/lib/haptics";
import { PLACES, euros, useWander } from "@/lib/store";

const MONTHS = [
  { value: "2026-12-12", label: "Déc." },
  { value: "2027-02-06", label: "Févr." },
  { value: "2027-04-10", label: "Avr." },
  { value: "2027-06-19", label: "Juin" },
];

export default function NewTrip() {
  const params = useLocalSearchParams<{ place?: string }>();
  const insets = useSafeAreaInsets();
  const addTrip = useWander((s) => s.addTrip);
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<string[]>(params.place ? [params.place] : ["lisbon"]);
  const [start, setStart] = useState(MONTHS[2].value);
  const [nights, setNights] = useState(7);
  const budget = PLACES.filter((p) => picked.includes(p.id)).reduce((n, p) => n + p.price, 0) + nights * 40;
  const close = () => (router.canGoBack() ? router.back() : router.replace("/trips"));
  const create = () => {
    success();
    addTrip({ title: title.trim() || "Nouvelle escapade", placeIds: picked, start, nights, budget });
    router.replace("/trips");
  };

  return (
    <ScrollView testID="newtrip-screen" className="flex-1 bg-background" contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
      <View className="flex-row items-center justify-between">
        <Text variant="title">Nouveau voyage</Text>
        <IconButton icon="close" accessibilityLabel="Fermer" testID="newtrip-close" onPress={close} />
      </View>
      <Input label="Nom du voyage" placeholder="Escapade de printemps" value={title} onChangeText={setTitle} icon="create-outline" testID="newtrip-title" />

      <View className="gap-2">
        <Text variant="label">Destinations</Text>
        <View className="flex-row flex-wrap gap-2">
          {PLACES.map((p) => {
            const on = picked.includes(p.id);
            return (
              <Pressable
                key={p.id}
                testID={`newtrip-place-${p.id}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={p.name}
                onPress={() => {
                  tap();
                  setPicked((x) => (on ? x.filter((i) => i !== p.id) : [...x, p.id]));
                }}
                className={on ? "flex-row items-center gap-2 rounded-full border-2 border-primary bg-primary/10 py-1 pl-1 pr-3" : "flex-row items-center gap-2 rounded-full border-2 border-border bg-surface py-1 pl-1 pr-3"}>
                <Image source={p.photo} contentFit="cover" style={{ width: 28, height: 28, borderRadius: 14 }} />
                <Text className="text-sm font-semibold text-text">{p.name}</Text>
                {on && <Icon name="checkmark-circle" size={16} />}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="gap-2">
        <Text variant="label">Départ</Text>
        <Segmented testID="newtrip-month" value={start} onChange={setStart} options={MONTHS} />
      </View>

      <View className="flex-row items-center justify-between rounded-theme bg-surface p-4">
        <View>
          <Text variant="subheading">Durée</Text>
          <Text variant="caption">{nights} nuits</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <IconButton icon="remove" variant="tinted" accessibilityLabel="Moins de nuits" testID="newtrip-minus" onPress={() => setNights((n) => Math.max(1, n - 1))} />
          <Text testID="newtrip-nights" className="w-8 text-center text-xl font-bold text-text">
            {nights}
          </Text>
          <IconButton icon="add" variant="tinted" accessibilityLabel="Plus de nuits" testID="newtrip-plus" onPress={() => setNights((n) => Math.min(30, n + 1))} />
        </View>
      </View>

      <View className="flex-row items-center justify-between">
        <Text variant="caption">Budget estimé</Text>
        <Text testID="newtrip-budget" className="text-2xl font-extrabold text-primary">
          {euros(budget)}
        </Text>
      </View>
      <Button title="Créer le voyage" icon="airplane" testID="newtrip-create" disabled={!picked.length} onPress={create} />
    </ScrollView>
  );
}
