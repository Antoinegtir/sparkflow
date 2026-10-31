import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { uid } from "@/lib/id";
import { persistStorage } from "@/lib/storage";

export type Category = "beach" | "mountain" | "city" | "nature";

export type Place = {
  id: string;
  name: string;
  country: string;
  category: Category;
  rating: number;
  reviews: number;
  price: number;
  bestSeason: string;
  flight: string;
  blurb: string;
  highlights: string[];
  /** A bundled asset (require). */
  photo: number;
};

export type Trip = { id: string; title: string; placeIds: string[]; start: string; nights: number; budget: number };

export const CATEGORIES: { value: Category | "all"; label: string; icon: "compass-outline" | "sunny-outline" | "triangle-outline" | "business-outline" | "leaf-outline" }[] = [
  { value: "all", label: "All", icon: "compass-outline" },
  { value: "beach", label: "Beaches", icon: "sunny-outline" },
  { value: "mountain", label: "Mountains", icon: "triangle-outline" },
  { value: "city", label: "Cities", icon: "business-outline" },
  { value: "nature", label: "Nature", icon: "leaf-outline" },
];

export const PLACES: Place[] = [
  {
    id: "santorini",
    name: "Santorini",
    country: "Greece",
    category: "beach",
    rating: 4.9,
    reviews: 2841,
    price: 1290,
    bestSeason: "May – Oct",
    flight: "3h 40m",
    blurb: "Whitewashed houses perched above the caldera, legendary sunsets in Oia and volcanic coves.",
    highlights: ["Sunset in Oia", "Red Beach in Akrotiri", "Assyrtiko wine tasting"],
    photo: require("../assets/places/santorini.jpg"),
  },
  {
    id: "kyoto",
    name: "Kyoto",
    country: "Japan",
    category: "city",
    rating: 4.8,
    reviews: 3920,
    price: 1840,
    bestSeason: "Mar – May",
    flight: "13h 10m",
    blurb: "A thousand vermilion torii, Zen temples and the lanes of Gion: the old imperial capital at its finest.",
    highlights: ["Fushimi Inari at dawn", "Arashiyama Bamboo Grove", "Traditional tea ceremony"],
    photo: require("../assets/places/kyoto.jpg"),
  },
  {
    id: "patagonia",
    name: "Torres del Paine",
    country: "Chile",
    category: "mountain",
    rating: 4.9,
    reviews: 1204,
    price: 2350,
    bestSeason: "Nov – Mar",
    flight: "16h 30m",
    blurb: "Granite spires, turquoise lakes and glaciers: the W Trek at the end of the world.",
    highlights: ["Mirador Base Las Torres", "Grey Glacier", "Lake Pehoé"],
    photo: require("../assets/places/patagonia.jpg"),
  },
  {
    id: "marrakech",
    name: "Marrakech",
    country: "Morocco",
    category: "city",
    rating: 4.7,
    reviews: 2210,
    price: 620,
    bestSeason: "Oct – Apr",
    flight: "3h 15m",
    blurb: "Hidden riads, zellige tiles and orange trees, bustling souks and Jemaa el-Fna square at dusk.",
    highlights: ["Majorelle Garden", "Souks of the medina", "Traditional hammam"],
    photo: require("../assets/places/marrakech.jpg"),
  },
  {
    id: "amalfi",
    name: "Positano",
    country: "Italy",
    category: "beach",
    rating: 4.8,
    reviews: 1876,
    price: 1450,
    bestSeason: "May – Sep",
    flight: "2h 20m",
    blurb: "Pastel facades clinging to the cliffs, Sorrento lemons and the crystal-clear waters of the Amalfi Coast.",
    highlights: ["Path of the Gods", "Boat trip to Capri", "Homemade limoncello"],
    photo: require("../assets/places/amalfi.jpg"),
  },
  {
    id: "iceland",
    name: "Vík",
    country: "Iceland",
    category: "nature",
    rating: 4.7,
    reviews: 965,
    price: 1680,
    bestSeason: "Jun – Aug",
    flight: "3h 30m",
    blurb: "Black-sand beaches, basalt columns and waterfalls framed in moss: the wildest stretch of the south coast.",
    highlights: ["Reynisfjara", "Skógafoss waterfall", "Northern lights in winter"],
    photo: require("../assets/places/iceland.jpg"),
  },
  {
    id: "bali",
    name: "Ubud",
    country: "Indonesia",
    category: "nature",
    rating: 4.6,
    reviews: 3102,
    price: 1120,
    bestSeason: "Apr – Oct",
    flight: "16h 50m",
    blurb: "Terraced rice fields, jungle temples and sunrise yoga in the heart of Bali.",
    highlights: ["Tegallalang Rice Terraces", "Sacred Monkey Forest", "Tirta Empul Temple"],
    photo: require("../assets/places/bali.jpg"),
  },
  {
    id: "lisbon",
    name: "Lisbon",
    country: "Portugal",
    category: "city",
    rating: 4.7,
    reviews: 2654,
    price: 540,
    bestSeason: "Apr – Oct",
    flight: "2h 35m",
    blurb: "Tram 28, azulejos and miradouros: the city of seven hills, all fado and pastéis de nata.",
    highlights: ["Tram 28 through the Alfama", "Miradouro da Graça", "Belém and its pastéis"],
    photo: require("../assets/places/lisbon.jpg"),
  },
  {
    id: "norway",
    name: "Geirangerfjord",
    country: "Norway",
    category: "mountain",
    rating: 4.8,
    reviews: 1120,
    price: 1590,
    bestSeason: "Jun – Sep",
    flight: "2h 45m",
    blurb: "Towering cliffs, the Seven Sisters waterfalls and red cabins on mirror-still water.",
    highlights: ["Kayaking on the fjord", "Dalsnibba Skywalk", "Seven Sisters waterfall"],
    photo: require("../assets/places/norway.jpg"),
  },
  {
    id: "sahara",
    name: "Merzouga",
    country: "Morocco",
    category: "nature",
    rating: 4.6,
    reviews: 788,
    price: 780,
    bestSeason: "Oct – Apr",
    flight: "3h 15m",
    blurb: "The golden dunes of Erg Chebbi and a night in a desert camp under a sky full of stars.",
    highlights: ["Camel ride at sunset", "Berber desert camp", "Sunrise over the dunes"],
    photo: require("../assets/places/sahara.jpg"),
  },
];

export const placeById = (id: string | undefined) => PLACES.find((p) => p.id === id);

const SEED_TRIPS: Trip[] = [
  { id: "t1", title: "Mediterranean Summer", placeIds: ["santorini", "amalfi"], start: "2027-06-26", nights: 10, budget: 2900 },
  { id: "t2", title: "Spring in Japan", placeIds: ["kyoto"], start: "2027-03-28", nights: 12, budget: 3800 },
  { id: "t3", title: "Nordic Road Trip", placeIds: ["iceland", "norway"], start: "2027-08-14", nights: 9, budget: 3400 },
];

type State = {
  saved: string[];
  trips: Trip[];
  toggleSaved: (id: string) => void;
  addTrip: (t: Omit<Trip, "id">) => string;
  removeTrip: (id: string) => void;
  /** The welcome slides have been seen (or skipped). */
  onboarded: boolean;
  setOnboarded: (v: boolean) => void;
};

export const useWander = create<State>()(
  persist(
    (set) => ({
      saved: ["santorini", "kyoto", "lisbon", "iceland"],
      trips: SEED_TRIPS,
      toggleSaved: (id) => set((s) => ({ saved: s.saved.includes(id) ? s.saved.filter((x) => x !== id) : [id, ...s.saved] })),
      addTrip: (t) => {
        const id = uid();
        set((s) => ({ trips: [{ ...t, id }, ...s.trips] }));
        return id;
      },
      removeTrip: (id) => set((s) => ({ trips: s.trips.filter((t) => t.id !== id) })),
      onboarded: false,
      setOnboarded: (onboarded) => set({ onboarded }),
    }),
    { name: "wander-v2", storage: persistStorage },
  ),
);

/** True once the persisted store has loaded from storage (so `onboarded` is the saved value). */
export function useWanderHydrated() {
  const [hydrated, setHydrated] = useState(() => useWander.persist.hasHydrated());
  useEffect(() => {
    const unsub = useWander.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useWander.persist.hasHydrated());
    return unsub;
  }, []);
  return hydrated;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Jul 4 – Jul 14" from an ISO start date and a number of nights. */
export function tripDates(t: Pick<Trip, "start" | "nights">) {
  const d = new Date(`${t.start}T12:00:00`);
  const e = new Date(d.getTime() + t.nights * 86_400_000);
  const f = (x: Date) => `${MONTHS[x.getMonth()]} ${x.getDate()}`;
  return `${f(d)} – ${f(e)}`;
}

export const euros = (n: number) => `€${n.toLocaleString("en-US")}`;
