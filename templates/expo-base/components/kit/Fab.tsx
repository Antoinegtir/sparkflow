import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/constants/theme";
import { Icon, type IconName } from "./Icon";
import { shadow } from "./surface";

/** Floating action button, bottom-right. Put it as a direct child of <Screen>. */
export function Fab({ icon = "add", onPress, accessibilityLabel, testID }: { icon?: IconName; onPress?: () => void; accessibilityLabel: string; testID?: string }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", right: 20, bottom: 20 + Math.min(insets.bottom, 12) }}>
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        className="h-14 w-14 items-center justify-center rounded-full bg-primary active:opacity-80"
        style={shadow.card}>
        <Icon name={icon} size={26} color={c.onPrimary} />
      </Pressable>
    </View>
  );
}
Fab.isFloating = true;
