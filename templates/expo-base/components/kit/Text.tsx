import { Text as RNText, type TextProps } from "react-native";
import { cn } from "@/lib/cn";

const VARIANTS = {
  title: "text-[28px] font-bold leading-[34px] text-text",
  heading: "text-xl font-semibold text-text",
  subheading: "text-base font-semibold text-text",
  body: "text-base text-text",
  caption: "text-[13px] text-muted",
  label: "text-[13px] font-semibold uppercase tracking-wide text-muted",
};

export type TextVariant = keyof typeof VARIANTS;

export function Text({ variant = "body", className, ...props }: TextProps & { variant?: TextVariant; className?: string }) {
  return <RNText className={cn(VARIANTS[variant], className)} {...props} />;
}
