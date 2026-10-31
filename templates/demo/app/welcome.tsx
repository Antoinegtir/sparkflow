import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Extrapolation,
  FadeIn,
  interpolate,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { Button, Glass, Icon, Text, type IconName } from "@/components/kit";
import { DIM } from "@/components/PlaceCard";
import { success, tap } from "@/lib/haptics";
import { placeById, useWander } from "@/lib/store";

type Slide = { key: string; eyebrow: string; icon: IconName; title: string; subtitle: string; placeId: string };

const SLIDES: Slide[] = [
  {
    key: "discover",
    eyebrow: "Discover",
    icon: "compass-outline",
    title: "Find your next escape",
    subtitle: "Hand-picked destinations, from hidden coves to city lights.",
    placeId: "amalfi",
  },
  {
    key: "plan",
    eyebrow: "Plan",
    icon: "airplane-outline",
    title: "Plan trips in a tap",
    subtitle: "Pick your places, dates and budget. Wander does the math.",
    placeId: "kyoto",
  },
  {
    key: "save",
    eyebrow: "Save",
    icon: "heart-outline",
    title: "Keep what you love",
    subtitle: "Save the places that spark joy and come back anytime.",
    placeId: "norway",
  },
];

/** How much slower than the page the photo moves (parallax). */
const PARALLAX = 0.3;

function SlidePage({ slide, index, width, height, scrollX, bottomSpace }: { slide: Slide; index: number; width: number; height: number; scrollX: SharedValue<number>; bottomSpace: number }) {
  const place = placeById(slide.placeId)!;
  const range = [(index - 1) * width, index * width, (index + 1) * width];

  const photo = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(scrollX.value, range, [-width * PARALLAX, 0, width * PARALLAX], Extrapolation.CLAMP) },
      { scale: interpolate(scrollX.value, range, [1.08, 1, 1.08], Extrapolation.CLAMP) },
    ],
  }));
  const copy = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, [range[0] + width * 0.4, range[1], range[2] - width * 0.4], [0, 1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollX.value, range, [28, 0, 28], Extrapolation.CLAMP) }],
  }));

  return (
    <View testID={`welcome-slide-${index}`} style={{ width, height, overflow: "hidden" }}>
      <Animated.View style={[{ position: "absolute", top: 0, bottom: 0, left: -width * PARALLAX, width: width * (1 + 2 * PARALLAX) }, photo]}>
        <Image testID={`welcome-photo-${index}`} source={place.photo} contentFit="cover" transition={index === 0 ? 0 : 300} style={StyleSheet.absoluteFill} accessibilityLabel={`${place.name}, ${place.country}`} />
      </Animated.View>
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(0,0,0,0.45)", "rgba(0,0,0,0)", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.88)"]}
        locations={[0, 0.28, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[{ position: "absolute", left: 0, right: 0, bottom: bottomSpace, paddingHorizontal: 24, gap: 12 }, copy]}>
        <View className="flex-row items-center gap-2">
          <Icon name={slide.icon} size={16} color="#FFFFFF" />
          <Text className="text-[13px] font-semibold uppercase leading-[18px] tracking-widest text-white/85">{slide.eyebrow}</Text>
        </View>
        <Text testID={`welcome-title-${index}`} accessibilityRole="header" className="text-[42px] font-extrabold leading-[46px] text-white">
          {slide.title}
        </Text>
        <Text testID={`welcome-subtitle-${index}`} className="text-[17px] leading-[24px] text-white/85">
          {slide.subtitle}
        </Text>
        <Glass tint={DIM} className="mt-1 flex-row items-center gap-1.5 self-start rounded-full px-3 py-1.5">
          <Icon name="location" size={13} color="#FFFFFF" />
          <Text className="text-[13px] font-semibold text-white">
            {place.name}, {place.country}
          </Text>
        </Glass>
      </Animated.View>
    </View>
  );
}

function Dot({ index, width, scrollX }: { index: number; width: number; scrollX: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const range = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      width: interpolate(scrollX.value, range, [8, 26, 8], Extrapolation.CLAMP),
      opacity: interpolate(scrollX.value, range, [0.45, 1, 0.45], Extrapolation.CLAMP),
    };
  });
  return <Animated.View testID={`welcome-dot-${index}`} style={[{ height: 8, borderRadius: 4, backgroundColor: "#FFFFFF" }, style]} />;
}

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  // The web build renders once on the server, where the window has no size yet.
  const width = win.width || 393;
  // Pages get an explicit height: on web a horizontal ScrollView doesn't stretch its children.
  const [height, setHeight] = useState(win.height || 759);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const [page, setPage] = useState(0);
  const setOnboarded = useWander((s) => s.setOnboarded);
  const last = page === SLIDES.length - 1;

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  const onPage = useCallback((p: number) => {
    setPage(p);
    tap();
  }, []);
  useAnimatedReaction(
    () => Math.min(SLIDES.length - 1, Math.max(0, Math.round(scrollX.value / width))),
    (cur, prev) => {
      if (prev !== null && cur !== prev) scheduleOnRN(onPage, cur);
    },
    [width],
  );

  const finish = () => {
    success();
    setOnboarded(true);
    // Replayed from Profile: go back there. First launch (or opened by URL): the tabs replace it.
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };
  const next = () => {
    tap();
    scrollRef.current?.scrollTo({ x: (page + 1) * width, animated: true });
  };

  const controls = insets.bottom + 16 + 56 + 28 + 8; // button + dots row
  return (
    <View testID="welcome-screen" style={{ flex: 1, backgroundColor: "#000000" }}>
      <StatusBar style="light" />
      <Animated.ScrollView
        ref={scrollRef}
        testID="welcome-pager"
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onLayout={(e) => e.nativeEvent.layout.height > 0 && setHeight(e.nativeEvent.layout.height)}
        style={{ flex: 1 }}>
        {SLIDES.map((s, i) => (
          <SlidePage key={s.key} slide={s} index={i} width={width} height={height} scrollX={scrollX} bottomSpace={controls + 32} />
        ))}
      </Animated.ScrollView>

      {/* Top bar: brand and Skip */}
      <View className="absolute left-0 right-0 flex-row items-center justify-between px-4" style={{ top: insets.top + 8 }} pointerEvents="box-none">
        <Glass testID="welcome-brand" tint={DIM} className="h-11 flex-row items-center gap-2 rounded-full px-4">
          <Icon name="paper-plane" size={16} color="#FFFFFF" />
          <Text className="text-[17px] font-bold text-white">Wander</Text>
        </Glass>
        {!last && (
          <Animated.View entering={FadeIn}>
            <Glass tint={DIM} interactive className="h-11 rounded-full">
              <Pressable testID="welcome-skip" accessibilityRole="button" accessibilityLabel="Skip the introduction" onPress={finish} className="h-11 min-w-[72px] items-center justify-center px-4">
                <Text className="text-[15px] font-semibold text-white">Skip</Text>
              </Pressable>
            </Glass>
          </Animated.View>
        )}
      </View>

      {/* Bottom: page dots and the main button */}
      <View className="absolute bottom-0 left-0 right-0 gap-7 px-6" style={{ paddingBottom: insets.bottom + 16 }} pointerEvents="box-none">
        <View testID="welcome-dots" accessibilityLabel={`Page ${page + 1} of ${SLIDES.length}`} className="flex-row items-center justify-center gap-2">
          {SLIDES.map((s, i) => (
            <Dot key={s.key} index={i} width={width} scrollX={scrollX} />
          ))}
        </View>
        {last ? (
          <Button testID="welcome-get-started" title="Get started" icon="arrow-forward" onPress={finish} className="h-14 rounded-full" />
        ) : (
          <Button testID="welcome-next" title="Continue" accessibilityLabel="Next slide" onPress={next} className="h-14 rounded-full" />
        )}
      </View>
    </View>
  );
}
