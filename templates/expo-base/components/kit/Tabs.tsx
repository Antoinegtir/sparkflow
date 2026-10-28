import { Ionicons } from "@expo/vector-icons";
import { withLayoutContext } from "expo-router";
import {
  createNavigatorFactory,
  TabRouter,
  useNavigationBuilder,
  type DefaultNavigatorOptions,
  type ParamListBase,
  type TabNavigationState,
  type TabRouterOptions,
} from "expo-router/react-navigation";
import { useContext, useEffect, useState, type ReactNode } from "react";
import { Platform, type ImageSourcePropType } from "react-native";
import TabView, { BottomTabBarHeightContext } from "react-native-bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/constants/theme";
import type { TabOptions } from "./tabs-options";

export type { TabOptions };

type Props = DefaultNavigatorOptions<ParamListBase, string | undefined, TabNavigationState<ParamListBase>, TabOptions, {}, unknown> &
  TabRouterOptions & { children?: ReactNode; glass?: boolean };

// Android's bottom navigation needs images: Ionicons glyphs are rendered once to image files.
const ionCache: Record<string, ImageSourcePropType> = {};

function useIonImages(names: string[]) {
  const [, setVersion] = useState(0);
  const missing = Platform.OS === "android" ? names.filter((n) => !ionCache[n]) : [];
  const key = missing.join(",");
  useEffect(() => {
    if (!key) return;
    let alive = true;
    Promise.all(
      key.split(",").map(async (n) => {
        const src = await Ionicons.getImageSource(n as any, 24, "white");
        if (src) ionCache[n] = src as ImageSourcePropType;
      }),
    ).then(() => alive && setVersion((v) => v + 1));
    return () => {
      alive = false;
    };
  }, [key]);
  return ionCache;
}

function NativeTabNavigator({ id, initialRouteName, backBehavior, children, screenOptions, screenListeners, screenLayout, layout, router }: Props & Record<string, any>) {
  const c = useColors();
  const { state, descriptors, describe, navigation, NavigationContent } = useNavigationBuilder(TabRouter, {
    id,
    initialRouteName,
    backBehavior,
    children,
    screenOptions,
    screenListeners,
    screenLayout,
    layout,
    router,
  } as any);

  // expo-router's TabRouter is lazy: state.routes only holds tabs visited so far. The native bar needs
  // every tab up front, so unvisited ones get a placeholder (no scene) built from describe().
  const focusedName = state.routes[state.index]?.name;
  const tabs = state.routeNames.map((name) => {
    const route = state.routes.find((r) => r.name === name);
    const descriptor = route ? descriptors[route.key] : (describe as any)({ key: undefined, name });
    return { name, route, options: descriptor.options as TabOptions };
  });
  const ion = useIonImages(tabs.flatMap((t) => (t.options.icon ? [t.options.icon.ion] : [])));
  const routes = tabs.map(({ name, options: o }) => {
    const icon = !o.icon ? undefined : Platform.OS === "ios" ? ({ sfSymbol: o.icon.sf } as any) : ion[o.icon.ion];
    return { key: name, title: o.title ?? name, focusedIcon: icon, unfocusedIcon: icon, badge: o.badge };
  });
  const index = Math.max(0, state.routeNames.indexOf(focusedName));

  return (
    <NavigationContent>
      <TabView
        navigationState={{ index, routes }}
        labeled
        tabBarActiveTintColor={c.primary}
        tabBarInactiveTintColor={c.muted}
        tabBarStyle={Platform.OS === "android" ? { backgroundColor: c.surface } : undefined}
        renderScene={({ route }) => {
          const tab = tabs.find((t) => t.name === route.key);
          return tab?.route ? descriptors[tab.route.key].render() : null;
        }}
        onIndexChange={(i) => {
          const { name, route } = tabs[i];
          if (route) {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true } as any);
            if ((event as any).defaultPrevented) return;
          }
          navigation.navigate(name as never);
        }}
      />
    </NavigationContent>
  );
}

const { Navigator } = (createNavigatorFactory(NativeTabNavigator as any) as any)();

/**
 * Bottom tabs for app/(tabs)/_layout.tsx: the system tab bar on iOS (Liquid Glass on iOS 26) and
 * Material bottom navigation on Android; expo-router/js-tabs on web (Tabs.web.tsx).
 * `glass` only changes the web bar (native bars already look native).
 */
export const Tabs = withLayoutContext<TabOptions, typeof Navigator, TabNavigationState<ParamListBase>, any>(Navigator) as unknown as ((props: {
  children?: ReactNode;
  glass?: boolean;
}) => ReactNode) & { Screen: (props: { name: string; options?: TabOptions }) => ReactNode };

/** Bottom space a Screen keeps clear of the native tab bar; undefined outside native tabs. */
export function useNativeTabBarInset() {
  const height = useContext(BottomTabBarHeightContext);
  const insets = useSafeAreaInsets();
  if (height === undefined) return undefined;
  // iOS draws scenes under the floating bar; Android lays them out above it.
  // The reported height can leave out the home indicator area, so it is added when missing.
  if (Platform.OS !== "ios") return 0;
  return height > insets.bottom + 40 ? height : height + insets.bottom;
}
