import { View } from "react-native";

export function ProgressBar({ value, testID }: { value: number; testID?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View testID={testID} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }} className="h-2 overflow-hidden rounded-full bg-primary/15">
      <View className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </View>
  );
}
