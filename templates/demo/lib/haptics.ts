import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/** Haptic taps on iOS and Android; nothing on web. */
export const tap = () => Platform.OS !== "web" && void Haptics.selectionAsync().catch(() => {});
export const success = () => Platform.OS !== "web" && void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
