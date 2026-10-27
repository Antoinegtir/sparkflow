import { Pressable, View } from "react-native";
import { cn } from "@/lib/cn";
import { childTestID } from "./surface";
import { Text } from "./Text";

/** iOS-style switch drawn with Views (50×30, 26 thumb) so web and native look the same. */
export function Switch({ value, onValueChange, accessibilityLabel, testID }: { value: boolean; onValueChange: (v: boolean) => void; accessibilityLabel: string; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      className="h-11 justify-center">
      <View className={cn("h-[30px] w-[50px] justify-center rounded-full px-[2px]", value ? "bg-success" : "bg-border")}>
        <View className={cn("h-[26px] w-[26px] rounded-full bg-white", value && "self-end")} style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.25)" } as object} />
      </View>
    </Pressable>
  );
}

/** Labelled row with a Switch ("<testID>-switch"). */
export function Toggle({ label, value, onValueChange, testID }: { label: string; value: boolean; onValueChange: (v: boolean) => void; testID?: string }) {
  return (
    <View testID={testID} className="min-h-[52px] flex-row items-center justify-between gap-3">
      <Text className="flex-1">{label}</Text>
      <Switch value={value} onValueChange={onValueChange} accessibilityLabel={label} testID={childTestID(testID, "switch")} />
    </View>
  );
}
