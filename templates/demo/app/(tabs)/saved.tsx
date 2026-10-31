import { router } from "expo-router";
import { View } from "react-native";
import { Button, EmptyState, Header, Screen } from "@/components/kit";
import { PlaceCard } from "@/components/PlaceCard";
import { placeById, useWander } from "@/lib/store";

export default function Saved() {
  const saved = useWander((s) => s.saved);
  const places = saved.map(placeById).filter((p) => !!p);
  return (
    <Screen testID="saved-screen">
      <Header title="Saved" subtitle={`${places.length} saved destinations`} testID="saved-header" />
      {places.length ? (
        <View className="flex-row flex-wrap justify-between gap-y-3">
          {places.map((p, i) => (
            // No entering animation: Liquid Glass inside an animated view doesn't render on iOS.
            <View key={p.id} style={{ width: "48.5%" }}>
              <PlaceCard testID={`saved-place-${p.id}`} place={p} width="100%" height={i % 3 === 0 ? 240 : 200} />
            </View>
          ))}
        </View>
      ) : (
        <View className="gap-4">
          <EmptyState title="Nothing saved yet" message="Tap the heart on a destination to find it here." />
          <Button title="Explore" icon="compass-outline" testID="saved-explore" onPress={() => router.navigate("/")} />
        </View>
      )}
    </Screen>
  );
}
