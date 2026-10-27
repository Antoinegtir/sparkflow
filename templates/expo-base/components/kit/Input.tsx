import { TextInput, View, type TextInputProps } from "react-native";
import { useColors } from "@/constants/theme";
import { Icon, type IconName } from "./Icon";
import { childTestID } from "./surface";
import { Text } from "./Text";

export function Input({ label, icon, testID, ...props }: TextInputProps & { label?: string; icon?: IconName; testID?: string }) {
  const c = useColors();
  return (
    <View testID={testID} className="gap-1.5">
      {label ? <Text variant="label">{label}</Text> : null}
      <View className="h-12 flex-row items-center gap-2 rounded-theme border border-border bg-surface px-3">
        {icon && <Icon name={icon} size={18} color={c.muted} />}
        <TextInput
          testID={childTestID(testID, "input")}
          accessibilityLabel={label ?? props.placeholder}
          placeholderTextColor={c.muted}
          className="h-full flex-1 text-base text-text"
          style={{ outlineStyle: "none" } as object}
          {...props}
        />
      </View>
    </View>
  );
}
