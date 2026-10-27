import { View } from "react-native";
import { cn } from "@/lib/cn";

export const Divider = ({ inset }: { inset?: boolean }) => <View className={cn("h-px bg-border", inset && "ml-4")} />;
