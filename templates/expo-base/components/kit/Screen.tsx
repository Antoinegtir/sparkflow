import { BottomTabBarHeightContext } from "expo-router/js-tabs";
import { Children, isValidElement, useContext, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Page container: safe area, scroll, 20px gutters, 16px gap. Fab children float outside the scroll. */
export function Screen({ children, testID, scroll = true }: { children: ReactNode; testID?: string; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  const tabBar = useContext(BottomTabBarHeightContext);
  const all = Children.toArray(children);
  const floating = all.filter((c) => isValidElement(c) && (c.type as { isFloating?: boolean }).isFloating);
  const content = all.filter((c) => !floating.includes(c));
  const bottom = 32 + (tabBar ? 0 : insets.bottom) + (floating.length ? 72 : 0);
  const body = (
    <View style={{ paddingTop: insets.top + 8, paddingBottom: bottom, paddingHorizontal: 20, gap: 16 }}>{content}</View>
  );
  return (
    <View testID={testID} className="flex-1 bg-background">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {scroll ? (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
            {body}
          </ScrollView>
        ) : (
          body
        )}
      </KeyboardAvoidingView>
      {floating}
    </View>
  );
}
