import AsyncStorage from "@react-native-async-storage/async-storage";
import { createJSONStorage } from "zustand/middleware";
import { Platform } from "react-native";

const memory = new Map<string, string>();
const ssr = Platform.OS === "web" && typeof window === "undefined";

/** Zustand persist storage: AsyncStorage, or memory while the web build renders on the server. */
export const persistStorage = createJSONStorage(() =>
  ssr
    ? {
        getItem: (k: string) => memory.get(k) ?? null,
        setItem: (k: string, v: string) => void memory.set(k, v),
        removeItem: (k: string) => void memory.delete(k),
      }
    : AsyncStorage,
);
