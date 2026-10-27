import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useColors } from "@/constants/theme";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";
import { shadow, useSurface } from "./surface";
import { Text } from "./Text";

export function ListItem({
  title,
  subtitle,
  icon,
  left,
  right,
  chevron,
  onPress,
  testID,
  accessibilityLabel,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  left?: ReactNode;
  right?: ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  const flat = useSurface() === "card";
  const body = (
    <>
      {left ?? (icon ? (
        <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/10">
          <Icon name={icon} size={18} color={c.primary} />
        </View>
      ) : null)}
      <View className="flex-1">
        <Text className="font-medium" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {chevron && <Icon name="chevron-forward" size={18} color={c.muted} />}
    </>
  );
  const box = cn("min-h-[56px] flex-row items-center gap-3 px-4 py-3", !flat && "rounded-theme bg-surface");
  const style = flat ? undefined : shadow.soft;
  return onPress ? (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} className={cn(box, "active:opacity-70")} style={style}>
      {body}
    </Pressable>
  ) : (
    <View testID={testID} className={box} style={style}>
      {body}
    </View>
  );
}
