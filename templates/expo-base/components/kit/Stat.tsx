import { View } from "react-native";
import { cn } from "@/lib/cn";
import { shadow, useSurface } from "./surface";
import { Text } from "./Text";

export function Stat({ label, value, hint, testID }: { label: string; value: string | number; hint?: string; testID?: string }) {
  const flat = useSurface() === "card";
  return (
    <View testID={testID} className={cn("flex-1 gap-1", !flat && "rounded-theme bg-surface p-4")} style={flat ? undefined : shadow.soft}>
      <Text variant="caption">{label}</Text>
      <Text className="text-2xl font-bold">{value}</Text>
      {hint ? <Text variant="caption">{hint}</Text> : null}
    </View>
  );
}
