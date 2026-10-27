import { View } from "react-native";
import { useColors } from "@/constants/theme";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
import { childTestID } from "./surface";
import { Text } from "./Text";

export function EmptyState({ icon = "sparkles-outline", title, message, actionTitle, onAction, testID }: { icon?: IconName; title: string; message?: string; actionTitle?: string; onAction?: () => void; testID?: string }) {
  const c = useColors();
  return (
    <View testID={testID} className="items-center gap-3 px-6 py-10">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <Icon name={icon} size={26} color={c.primary} />
      </View>
      <Text variant="subheading" className="text-center">
        {title}
      </Text>
      {message ? <Text className="text-center text-muted">{message}</Text> : null}
      {actionTitle && <Button title={actionTitle} onPress={onAction} testID={childTestID(testID, "action")} />}
    </View>
  );
}
