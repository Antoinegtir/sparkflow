import { Image } from "expo-image";
import { View } from "react-native";
import { cn } from "@/lib/cn";
import { Text } from "./Text";

const SIZES = { sm: 32, md: 44, lg: 64 };

export function Avatar({ name, uri, size = "md", testID }: { name: string; uri?: string; size?: keyof typeof SIZES; testID?: string }) {
  const px = SIZES[size];
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  if (uri) return <Image testID={testID} source={{ uri }} accessibilityLabel={name} style={{ width: px, height: px, borderRadius: px / 2 }} />;
  return (
    <View testID={testID} accessibilityLabel={name} className="items-center justify-center rounded-full bg-primary/15" style={{ width: px, height: px }}>
      <Text className={cn("font-semibold text-primary", size === "lg" ? "text-xl" : size === "sm" ? "text-xs" : "text-base")}>{initials}</Text>
    </View>
  );
}
