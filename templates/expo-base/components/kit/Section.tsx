import type { ReactNode } from "react";
import { View } from "react-native";
import { Text } from "./Text";

export function Section({ title, right, children, testID }: { title: string; right?: ReactNode; children: ReactNode; testID?: string }) {
  return (
    <View testID={testID} className="gap-2">
      <View className="flex-row items-center justify-between px-1">
        <Text variant="label">{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}
