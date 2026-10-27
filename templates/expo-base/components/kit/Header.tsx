import { router } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { IconButton } from "./IconButton";
import { childTestID } from "./surface";
import { Text } from "./Text";

/** Page title, optional back button ("-back") and a right slot. */
export function Header({ title, subtitle, back, right, testID }: { title: string; subtitle?: string; back?: boolean; right?: ReactNode; testID?: string }) {
  return (
    <View testID={testID} className="flex-row items-center gap-2">
      {back && (
        <IconButton
          icon="chevron-back"
          accessibilityLabel="Go back"
          testID={childTestID(testID, "back")}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        />
      )}
      <View className="flex-1">
        <Text variant="title" testID={childTestID(testID, "title")} accessibilityRole="header" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text variant="caption">{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}
