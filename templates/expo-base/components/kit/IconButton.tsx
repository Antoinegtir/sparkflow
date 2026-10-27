import { Pressable } from "react-native";
import { useColors } from "@/constants/theme";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";

/** 44×44 round icon button. accessibilityLabel is required. */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = "plain",
  testID,
  color,
}: {
  icon: IconName;
  onPress?: () => void;
  accessibilityLabel: string;
  variant?: "plain" | "filled" | "tinted";
  testID?: string;
  color?: string;
}) {
  const c = useColors();
  const fg = color ?? (variant === "filled" ? c.onPrimary : variant === "tinted" ? c.primary : c.text);
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className={cn(
        "h-11 w-11 items-center justify-center rounded-full active:opacity-70",
        variant === "filled" && "bg-primary",
        variant === "tinted" && "bg-primary/10",
      )}>
      <Icon name={icon} size={22} color={fg} />
    </Pressable>
  );
}
