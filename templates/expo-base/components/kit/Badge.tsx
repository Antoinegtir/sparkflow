import { View } from "react-native";
import { cn } from "@/lib/cn";
import { Text } from "./Text";

const TONES = {
  primary: ["bg-primary/15", "text-primary"],
  success: ["bg-success/15", "text-success"],
  danger: ["bg-danger/15", "text-danger"],
  neutral: ["bg-border", "text-text"],
} as const;

export function Badge({ label, tone = "primary", testID }: { label: string; tone?: keyof typeof TONES; testID?: string }) {
  const [bg, fg] = TONES[tone];
  return (
    <View testID={testID} className={cn("self-start rounded-full px-2.5 py-1", bg)}>
      <Text className={cn("text-xs font-semibold", fg)}>{label}</Text>
    </View>
  );
}
