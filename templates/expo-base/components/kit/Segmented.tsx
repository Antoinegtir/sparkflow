import { Pressable, View } from "react-native";
import { cn } from "@/lib/cn";
import { childTestID } from "./surface";
import { Text } from "./Text";

/** Segmented control; each option gets testID "<testID>-<value>". */
export function Segmented<T extends string>({ options, value, onChange, testID }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; testID?: string }) {
  return (
    <View testID={testID} accessibilityRole="tablist" className="h-11 flex-row rounded-theme bg-border/60 p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={childTestID(testID, o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            className={cn("flex-1 items-center justify-center rounded-[10px]", on && "bg-surface")}>
            <Text className={cn("text-sm font-semibold", on ? "text-text" : "text-muted")}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
