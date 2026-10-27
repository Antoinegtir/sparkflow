import { View } from "react-native";
import { Text } from "./Text";

/** Simple vertical bars. Values are scaled to the largest one. */
export function BarChart({ data, height = 140, testID }: { data: { label: string; value: number }[]; height?: number; testID?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View testID={testID} accessibilityRole="image" accessibilityLabel={data.map((d) => `${d.label} ${d.value}`).join(", ")} className="flex-row items-end gap-2" style={{ height: height + 24 }}>
      {data.map((d, i) => (
        <View key={`${i}-${d.label}`} className="flex-1 items-center gap-1.5">
          <View className="w-full rounded-md bg-primary" style={{ height: Math.max(4, (d.value / max) * height), opacity: d.value ? 1 : 0.25 }} />
          <Text variant="caption" numberOfLines={1}>
            {d.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
