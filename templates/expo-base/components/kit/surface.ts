import { createContext, isValidElement, useContext, type ReactNode } from "react";
import { Platform } from "react-native";

/** "card" when inside a Card or a grouped List: ListItem and Stat then render flat. */
export const SurfaceContext = createContext<"none" | "card">("none");
export const useSurface = () => useContext(SurfaceContext);

export const shadow = {
  card: Platform.select({
    web: { boxShadow: "0 1px 2px rgba(15,23,42,.06), 0 4px 16px rgba(15,23,42,.06)" },
    default: { boxShadow: "0 1px 2px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.06)" },
  }) as object,
  soft: Platform.select({
    web: { boxShadow: "0 1px 3px rgba(15,23,42,.08)" },
    default: { boxShadow: "0 1px 3px rgba(15,23,42,0.08)" },
  }) as object,
};

/** Child testID derived from the parent's, e.g. "home-search" → "home-search-input". */
export const childTestID = (id: string | undefined, suffix: string) => (id ? `${id}-${suffix}` : undefined);

export const isTextLike = (n: ReactNode) => typeof n === "string" || typeof n === "number" || (isValidElement(n) && false);
