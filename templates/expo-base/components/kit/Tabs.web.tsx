import { Tabs as JsTabs } from "expo-router/js-tabs";
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { useColors } from "@/constants/theme";
import { Icon } from "./Icon";
import { tabsScreenOptions, type TabOptions } from "./tabs-options";

export type { TabOptions };

// Web counterpart of Tabs.tsx: same API on expo-router/js-tabs, so react-native-bottom-tabs (native-only)
// stays out of the web bundle. Kit options become js-tabs options (Ionicons for the icon).
function toJsOptions({ icon, badge, ...rest }: TabOptions) {
  return {
    ...rest,
    ...(badge ? { tabBarBadge: badge } : {}),
    ...(icon ? { tabBarIcon: ({ color }: { color: string }) => <Icon name={icon.ion} color={color} size={22} /> } : {}),
  };
}

function KitTabs({ children, glass = false }: { children?: ReactNode; glass?: boolean }) {
  const c = useColors();
  return (
    <JsTabs screenOptions={tabsScreenOptions(c, { glass })}>
      {Children.map(children, (child) =>
        isValidElement(child) ? cloneElement(child as ReactElement<any>, { options: toJsOptions((child.props as { options?: TabOptions }).options ?? {}) }) : child,
      )}
    </JsTabs>
  );
}

export const Tabs = Object.assign(KitTabs, { Screen: JsTabs.Screen as unknown as (props: { name: string; options?: TabOptions }) => ReactNode });

/** No native tab bar on web. */
export function useNativeTabBarInset(): number | undefined {
  return undefined;
}
