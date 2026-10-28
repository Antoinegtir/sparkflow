import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Glass, Icon, Text } from "@/components/kit";
import { tap } from "@/lib/haptics";
import type { Place } from "@/lib/store";

export const DIM = "rgba(15,18,24,0.32)";

/** Full-photo card: name over a gradient, rating on a glass pill. */
export function PlaceCard({ place, width, height, testID }: { place: Place; width: number | `${number}%`; height: number; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${place.name}, ${place.country}`}
      onPress={() => {
        tap();
        router.push(`/place/${place.id}`);
      }}
      className="overflow-hidden rounded-theme active:opacity-90"
      style={{ width, height }}>
      <Image source={place.photo} contentFit="cover" transition={200} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.65)"]} locations={[0.45, 1]} style={StyleSheet.absoluteFill} />
      <View className="flex-1 justify-between p-3">
        <Glass tint={DIM} className="flex-row items-center gap-1 self-end rounded-full px-2.5 py-1">
          <Icon name="star" size={12} color="#FFC94A" />
          <Text className="text-xs font-semibold text-white">{place.rating.toFixed(1)}</Text>
        </Glass>
        <View>
          <Text className="text-lg font-bold text-white" numberOfLines={1}>
            {place.name}
          </Text>
          <Text className="text-[13px] text-white/80">{place.country}</Text>
        </View>
      </View>
    </Pressable>
  );
}
