import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Glass, GlassGroup, Icon, Text, useNativeTabBarInset } from "@/components/kit";
import { DIM, PlaceCard } from "@/components/PlaceCard";
import { tap } from "@/lib/haptics";
import { CATEGORIES, PLACES, euros, type Category } from "@/lib/store";

const HERO = 460;

export default function Explore() {
  const insets = useSafeAreaInsets();
  const tabInset = useNativeTabBarInset() ?? 0;
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<Category | "all">("all");
  const featured = PLACES[0];
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PLACES.filter((p) => (cat === "all" || p.category === cat) && (!q || `${p.name} ${p.country}`.toLowerCase().includes(q)));
  }, [query, cat]);
  const deals = [...PLACES].sort((a, b) => a.price - b.price).slice(0, 4);

  return (
    <View testID="explore-screen" className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 100 + tabInset }} keyboardShouldPersistTaps="handled">
        {/* Full-bleed hero */}
        <Pressable testID="explore-hero" accessibilityRole="button" accessibilityLabel={`Découvrir ${featured.name}`} onPress={() => router.push(`/place/${featured.id}`)} style={{ height: HERO }}>
          <Image source={featured.photo} contentFit="cover" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={["rgba(0,0,0,0.35)", "transparent", "rgba(0,0,0,0.7)"]} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
          <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, gap: 8, padding: 20, paddingBottom: 40 }}>
            <Text className="text-[13px] font-semibold uppercase leading-[18px] tracking-widest text-white/80">Destination de la semaine</Text>
            <Text className="text-[40px] font-extrabold leading-[44px] text-white">{featured.name}</Text>
            <View className="flex-row items-center gap-3">
              <Glass tint={DIM} className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5">
                <Icon name="star" size={13} color="#FFC94A" />
                <Text className="text-[13px] font-semibold text-white">
                  {featured.rating} · {featured.reviews.toLocaleString("fr-FR")} avis
                </Text>
              </Glass>
              <Glass tint={DIM} className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5">
                <Icon name="airplane" size={13} color="#FFFFFF" />
                <Text className="text-[13px] font-semibold text-white">dès {euros(featured.price)}</Text>
              </Glass>
            </View>
          </View>
        </Pressable>

        <View className="-mt-5 gap-6 rounded-t-[28px] bg-background pt-6">
          {/* Categories */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
            {CATEGORIES.map((c) => {
              const on = c.value === cat;
              return (
                <Pressable
                  key={c.value}
                  testID={`explore-cat-${c.value}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    tap();
                    setCat(c.value);
                  }}
                  className={on ? "flex-row items-center gap-1.5 rounded-full bg-primary px-4 py-2.5" : "flex-row items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2.5"}>
                  <Icon name={c.icon} size={16} color={on ? "#FFFFFF" : undefined} />
                  <Text className={on ? "text-sm font-semibold text-white" : "text-sm font-semibold text-text"}>{c.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Popular */}
          <View className="gap-3">
            <View className="flex-row items-end justify-between px-5">
              <Text variant="heading">Populaires</Text>
              <Text variant="caption">{list.length} destinations</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
              {list.map((p, i) => (
                <Animated.View key={p.id}>
                  <PlaceCard testID={`explore-place-${p.id}`} place={p} width={200} height={270} />
                </Animated.View>
              ))}
              {!list.length && (
                <View className="h-[120px] w-[320px] items-center justify-center rounded-theme border border-dashed border-border">
                  <Text variant="caption">Aucune destination ne correspond.</Text>
                </View>
              )}
            </ScrollView>
          </View>

          {/* Deals */}
          <View className="gap-3 px-5">
            <Text variant="heading">Petits prix</Text>
            {deals.map((p, i) => (
              <Animated.View key={p.id} entering={FadeInDown.delay(150 + i * 80)}>
                <Pressable
                  testID={`explore-deal-${p.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.name}, dès ${euros(p.price)}`}
                  onPress={() => router.push(`/place/${p.id}`)}
                  className="flex-row items-center gap-3 rounded-theme bg-surface p-2.5 active:opacity-80">
                  <Image source={p.photo} contentFit="cover" style={{ width: 64, height: 64, borderRadius: 14 }} />
                  <View className="flex-1">
                    <Text variant="subheading">{p.name}</Text>
                    <Text variant="caption">
                      {p.country} · vol {p.flight}
                    </Text>
                  </View>
                  <View className="items-end pr-1">
                    <Text variant="caption">dès</Text>
                    <Text className="text-base font-bold text-primary">{euros(p.price)}</Text>
                  </View>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Floating glass search bar over the photo */}
      <GlassGroup className="absolute left-0 right-0 flex-row items-center gap-2 px-4" style={{ top: insets.top + 8 }}>
        <Glass testID="explore-search" tint={DIM} className="h-12 flex-1 flex-row items-center gap-2 rounded-full px-4">
          <Icon name="search" size={18} color="#FFFFFF" />
          <TextInput
            testID="explore-search-input"
            value={query}
            onChangeText={setQuery}
            placeholder="Où partir ?"
            placeholderTextColor="rgba(255,255,255,0.8)"
            accessibilityLabel="Rechercher une destination"
            className="h-full flex-1 text-base text-white"
            style={{ outlineStyle: "none" } as object}
          />
        </Glass>
        <Glass tint={DIM} interactive className="h-12 w-12 items-center justify-center rounded-full">
          <Pressable testID="explore-new-trip" accessibilityRole="button" accessibilityLabel="Nouveau voyage" onPress={() => router.push("/trip/new")} className="h-12 w-12 items-center justify-center">
            <Icon name="add" size={24} color="#FFFFFF" />
          </Pressable>
        </Glass>
      </GlassGroup>
    </View>
  );
}
