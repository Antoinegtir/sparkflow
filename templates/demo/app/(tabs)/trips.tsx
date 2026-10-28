import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { Card, EmptyState, Glass, Header, Icon, IconButton, Screen, Stat, Text } from "@/components/kit";
import { DIM } from "@/components/PlaceCard";
import { tap } from "@/lib/haptics";
import { euros, placeById, tripDates, useWander, type Trip } from "@/lib/store";

function daysUntil(iso: string) {
  return Math.ceil((new Date(`${iso}T12:00:00`).getTime() - Date.now()) / 86_400_000);
}

function TripCard({ trip, index }: { trip: Trip; index: number }) {
  const places = trip.placeIds.map(placeById).filter((p) => !!p);
  const cover = places[0];
  const left = daysUntil(trip.start);
  return (
    <Animated.View>
      <Pressable
        testID={`trips-card-${trip.id}`}
        accessibilityRole="button"
        accessibilityLabel={trip.title}
        onPress={() => cover && router.push(`/place/${cover.id}`)}
        className="h-[220px] overflow-hidden rounded-theme active:opacity-90">
        {cover && <Image source={cover.photo} contentFit="cover" style={StyleSheet.absoluteFill} />}
        <LinearGradient colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.7)"]} style={StyleSheet.absoluteFill} />
        <View className="flex-1 justify-between p-4">
          <View className="flex-row justify-between">
            <Glass tint={DIM} className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5">
              <Icon name="calendar-outline" size={13} color="#FFFFFF" />
              <Text className="text-[13px] font-semibold text-white">{tripDates(trip)}</Text>
            </Glass>
            <Glass tint={DIM} className="rounded-full px-3 py-1.5">
              <Text className="text-[13px] font-semibold text-white">{left > 0 ? `J-${left}` : left + trip.nights >= 0 ? "En cours" : "Terminé"}</Text>
            </Glass>
          </View>
          <View className="gap-1">
            <Text className="text-2xl font-bold text-white">{trip.title}</Text>
            <Text className="text-sm text-white/85">
              {places.map((p) => p.name).join(" · ")} · {trip.nights} nuits · {euros(trip.budget)}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function Trips() {
  const trips = useWander((s) => s.trips);
  const nights = trips.reduce((n, t) => n + t.nights, 0);
  const countries = new Set(trips.flatMap((t) => t.placeIds.map((id) => placeById(id)?.country))).size;
  const add = () => {
    tap();
    router.push("/trip/new");
  };
  return (
    <Screen testID="trips-screen">
      <Header title="Mes voyages" subtitle="Vos prochaines escapades" testID="trips-header" right={<IconButton icon="add" variant="filled" accessibilityLabel="Nouveau voyage" testID="trips-add" onPress={add} />} />
      <View className="flex-row gap-3">
        <Stat label="Voyages" value={String(trips.length)} />
        <Stat label="Nuits" value={String(nights)} />
        <Stat label="Pays" value={String(countries)} />
      </View>
      {trips.length ? (
        trips.map((t, i) => <TripCard key={t.id} trip={t} index={i} />)
      ) : (
        <EmptyState title="Aucun voyage" message="Planifiez votre première escapade." />
      )}
      <Card testID="trips-new-card" onPress={add} accessibilityLabel="Planifier un voyage">
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-full bg-primary/15">
            <Icon name="sparkles-outline" size={20} />
          </View>
          <View className="flex-1">
            <Text variant="subheading">Planifier un voyage</Text>
            <Text variant="caption">Choisissez vos destinations et vos dates</Text>
          </View>
          <Icon name="chevron-forward" size={18} />
        </View>
      </Card>
    </Screen>
  );
}
