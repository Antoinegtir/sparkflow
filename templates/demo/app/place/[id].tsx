import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, EmptyState, Glass, GlassGroup, Icon, Screen, Text } from "@/components/kit";
import { useColors, useIsDark, withAlpha } from "@/constants/theme";
import { DIM } from "@/components/PlaceCard";
import { success, tap } from "@/lib/haptics";
import { euros, placeById, useWander } from "@/lib/store";

const HERO = 520;

function GlassButton({ icon, label, onPress, testID, color = "#FFFFFF" }: { icon: "chevron-back" | "heart" | "heart-outline" | "share-outline"; label: string; onPress: () => void; testID: string; color?: string }) {
  return (
    <Glass tint={DIM} interactive className="h-11 w-11 rounded-full">
      <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} className="h-11 w-11 items-center justify-center">
        <Icon name={icon} size={22} color={color} />
      </Pressable>
    </Glass>
  );
}

export default function PlaceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const place = placeById(id);
  const insets = useSafeAreaInsets();
  useColors(); // re-render on scheme change
  const dark = useIsDark();
  const bar = dark ? "rgba(20,22,28,0.6)" : "rgba(255,255,255,0.6)";
  const saved = useWander((s) => !!place && s.saved.includes(place.id));
  const toggleSaved = useWander((s) => s.toggleSaved);

  if (!place) {
    return (
      <Screen testID="place-missing">
        <EmptyState title="Destination not found" message="It may have been removed from the catalog." actionTitle="Back" onAction={() => router.back()} />
      </Screen>
    );
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return (
    <View testID="place-screen" className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        <View style={{ height: HERO }}>
          <Image source={place.photo} contentFit="cover" transition={250} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={["rgba(0,0,0,0.35)", "transparent", "rgba(0,0,0,0.55)"]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
        </View>

        {/* Glass info panel overlapping the photo */}
        <Animated.View style={{ marginTop: -144, paddingHorizontal: 16 }}>
          <Glass testID="place-info" className="gap-4 p-5">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-[13px] font-semibold uppercase leading-[18px] tracking-widest text-muted">{place.country}</Text>
                <Text testID="place-name" className="text-[34px] font-extrabold leading-[40px] text-text">
                  {place.name}
                </Text>
              </View>
              <View className="flex-row items-center gap-1 rounded-full bg-primary/15 px-3 py-1.5">
                <Icon name="star" size={14} color="#F5A524" />
                <Text className="text-sm font-bold text-text">{place.rating}</Text>
              </View>
            </View>
            <View className="flex-row justify-between">
              {[
                { icon: "airplane-outline" as const, label: "Flight", value: place.flight },
                { icon: "sunny-outline" as const, label: "Season", value: place.bestSeason },
                { icon: "chatbubble-outline" as const, label: "Reviews", value: place.reviews.toLocaleString("en-US") },
              ].map((f) => (
                <View key={f.label} className="flex-1 items-center gap-1">
                  <Icon name={f.icon} size={20} />
                  <Text variant="caption">{f.label}</Text>
                  <Text className="text-[15px] font-semibold text-text">{f.value}</Text>
                </View>
              ))}
            </View>
          </Glass>
        </Animated.View>

        <View className="gap-5 px-5 pt-6">
          <Animated.View entering={FadeInDown.delay(120)}>
            <Text testID="place-blurb" className="text-[17px] leading-[26px] text-text">
              {place.blurb}
            </Text>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(200)} style={{ gap: 12 }}>
            <Text variant="heading">Don't miss</Text>
            {place.highlights.map((h, i) => (
              <Card key={h} testID={`place-highlight-${i}`} className="flex-row items-center gap-3 p-3">
                <View className="h-9 w-9 items-center justify-center rounded-full bg-primary">
                  <Text className="font-bold text-white">{i + 1}</Text>
                </View>
                <Text variant="subheading" className="flex-1">
                  {h}
                </Text>
              </Card>
            ))}
          </Animated.View>
        </View>
      </ScrollView>

      {/* Floating controls */}
      <GlassGroup className="absolute left-0 right-0 flex-row justify-between px-4" style={{ top: insets.top + 8 }}>
        <GlassButton testID="place-back" icon="chevron-back" label="Back" onPress={back} />
        <GlassButton
          testID="place-save"
          icon={saved ? "heart" : "heart-outline"}
          color={saved ? "#FF5A6E" : "#FFFFFF"}
          label={saved ? "Remove from saved" : "Save destination"}
          onPress={() => {
            success();
            toggleSaved(place.id);
          }}
        />
      </GlassGroup>
      <View className="absolute bottom-0 left-0 right-0 px-4" style={{ paddingTop: 32, paddingBottom: insets.bottom + 12 }}>
        {/* Fade the page out under the bar so scrolled text never shows through the glass. */}
        <LinearGradient pointerEvents="none" colors={[withAlpha("background", 0), withAlpha("background", 0.9), withAlpha("background", 1)]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
        <Glass tint={bar} className="flex-row items-center gap-3 rounded-full p-2 pl-5">
          <View className="flex-1">
            <Text variant="caption">Flight + hotel, 7 nights</Text>
            <Text className="text-xl font-extrabold text-text">{euros(place.price)}</Text>
          </View>
          <Button
            title="Plan trip"
            icon="add"
            testID="place-plan"
            className="rounded-full px-6"
            onPress={() => {
              tap();
              router.push({ pathname: "/trip/new", params: { place: place.id } });
            }}
          />
        </Glass>
      </View>
    </View>
  );
}
