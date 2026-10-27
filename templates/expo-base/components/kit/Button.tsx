import { ActivityIndicator, Pressable, View } from "react-native";
import { useColors } from "@/constants/theme";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

const STYLES = {
  primary: { box: "bg-primary", text: "text-on-primary", icon: "onPrimary" },
  secondary: { box: "bg-surface border border-border", text: "text-text", icon: "text" },
  ghost: { box: "bg-transparent", text: "text-primary", icon: "primary" },
  danger: { box: "bg-danger", text: "text-on-danger", icon: "onDanger" },
} as const;

export function Button({
  title,
  onPress,
  variant = "primary",
  icon,
  loading,
  disabled,
  testID,
  accessibilityLabel,
  className,
}: {
  title: string;
  onPress?: () => void;
  variant?: keyof typeof STYLES;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  className?: string;
}) {
  const c = useColors();
  const s = STYLES[variant];
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      className={cn("h-12 flex-row items-center justify-center gap-2 rounded-theme px-5 active:opacity-80", s.box, (disabled || loading) && "opacity-50", className)}>
      {loading ? <ActivityIndicator color={c[s.icon]} /> : icon ? <Icon name={icon} size={18} color={c[s.icon]} /> : null}
      <View>
        <Text className={cn("font-semibold", s.text)}>{title}</Text>
      </View>
    </Pressable>
  );
}
