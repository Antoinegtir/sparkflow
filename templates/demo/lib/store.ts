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
  { value: "all", label: "Tout", icon: "compass-outline" },
  { value: "beach", label: "Plages", icon: "sunny-outline" },
  { value: "mountain", label: "Montagnes", icon: "triangle-outline" },
  { value: "city", label: "Villes", icon: "business-outline" },
  { value: "nature", label: "Nature", icon: "leaf-outline" },
];

export const PLACES: Place[] = [
  {
    id: "santorini",
    name: "Santorin",
    country: "Grèce",
    category: "beach",
    rating: 4.9,
    reviews: 2841,
    price: 1290,
    bestSeason: "Mai – Oct.",
    flight: "3 h 40",
    blurb: "Maisons blanches suspendues au-dessus de la caldeira, couchers de soleil légendaires à Oia et criques volcaniques.",
    highlights: ["Coucher de soleil à Oia", "Plage rouge d'Akrotiri", "Vins d'assyrtiko"],
    photo: require("../assets/places/santorini.jpg"),
  },
  {
    id: "kyoto",
    name: "Kyoto",
    country: "Japon",
    category: "city",
    rating: 4.8,
    reviews: 3920,
    price: 1840,
    bestSeason: "Mars – Mai",
    flight: "13 h 10",
    blurb: "Mille torii vermillon, temples zen et ruelles de Gion : l'ancienne capitale impériale à son plus beau.",
    highlights: ["Fushimi Inari à l'aube", "Bambouseraie d'Arashiyama", "Cérémonie du thé"],
    photo: require("../assets/places/kyoto.jpg"),
  },
  {
    id: "patagonia",
    name: "Torres del Paine",
    country: "Chili",
    category: "mountain",
    rating: 4.9,
    reviews: 1204,
    price: 2350,
    bestSeason: "Nov. – Mars",
    flight: "16 h 30",
    blurb: "Aiguilles de granit, lacs turquoise et glaciers : le trek du W au bout du monde.",
    highlights: ["Mirador Base Las Torres", "Glacier Grey", "Lac Pehoé"],
    photo: require("../assets/places/patagonia.jpg"),
  },
  {
    id: "marrakech",
    name: "Marrakech",
    country: "Maroc",
    category: "city",
    rating: 4.7,
    reviews: 2210,
    price: 620,
    bestSeason: "Oct. – Avr.",
    flight: "3 h 15",
    blurb: "Riads cachés, zelliges et orangers, souks animés et la place Jemaa el-Fna à la tombée du jour.",
    highlights: ["Jardin Majorelle", "Souks de la médina", "Hammam traditionnel"],
    photo: require("../assets/places/marrakech.jpg"),
  },
  {
    id: "amalfi",
    name: "Positano",
    country: "Italie",
    category: "beach",
    rating: 4.8,
    reviews: 1876,
    price: 1450,
    bestSeason: "Mai – Sept.",
    flight: "2 h 20",
    blurb: "Façades pastel accrochées à la falaise, citrons de Sorrente et eaux cristallines de la côte amalfitaine.",
    highlights: ["Sentier des Dieux", "Bateau vers Capri", "Limoncello maison"],
    photo: require("../assets/places/amalfi.jpg"),
  },
  {
    id: "iceland",
    name: "Vík",
    country: "Islande",
    category: "nature",
    rating: 4.7,
    reviews: 965,
    price: 1680,
    bestSeason: "Juin – Août",
    flight: "3 h 30",
    blurb: "Plages de sable noir, orgues basaltiques et cascades dans la mousse : la côte sud la plus sauvage.",
    highlights: ["Reynisfjara", "Cascade de Skógafoss", "Aurores en hiver"],
    photo: require("../assets/places/iceland.jpg"),
  },
  {
    id: "bali",
    name: "Ubud",
    country: "Indonésie",
    category: "nature",
    rating: 4.6,
    reviews: 3102,
    price: 1120,
    bestSeason: "Avr. – Oct.",
    flight: "16 h 50",
    blurb: "Rizières en terrasses, temples dans la jungle et yoga au lever du soleil au cœur de Bali.",
    highlights: ["Rizières de Tegallalang", "Forêt des singes", "Temple Tirta Empul"],
    photo: require("../assets/places/bali.jpg"),
  },
  {
    id: "lisbon",
    name: "Lisbonne",
    country: "Portugal",
    category: "city",
    rating: 4.7,
    reviews: 2654,
    price: 540,
    bestSeason: "Avr. – Oct.",
    flight: "2 h 35",
    blurb: "Tram 28, azulejos et miradouros : la ville aux sept collines, entre fado et pastéis de nata.",
    highlights: ["Tram 28 dans l'Alfama", "Miradouro da Graça", "Belém et ses pastéis"],
    photo: require("../assets/places/lisbon.jpg"),
  },
  {
    id: "norway",
    name: "Geirangerfjord",
    country: "Norvège",
    category: "mountain",
    rating: 4.8,
    reviews: 1120,
    price: 1590,
    bestSeason: "Juin – Sept.",
    flight: "2 h 45",
    blurb: "Falaises vertigineuses, cascades des Sept Sœurs et cabanes rouges au bord de l'eau miroir.",
    highlights: ["Kayak sur le fjord", "Belvédère de Dalsnibba", "Cascade des Sept Sœurs"],
    photo: require("../assets/places/norway.jpg"),
  },
  {
    id: "sahara",
    name: "Merzouga",
    country: "Maroc",
    category: "nature",
    rating: 4.6,
    reviews: 788,
    price: 780,
    bestSeason: "Oct. – Avr.",
    flight: "3 h 15",
    blurb: "Les dunes dorées de l'Erg Chebbi, une nuit en bivouac sous un ciel saturé d'étoiles.",
    highlights: ["Dromadaire au coucher du soleil", "Bivouac berbère", "Lever sur les dunes"],
    photo: require("../assets/places/sahara.jpg"),
  },
];

export const placeById = (id: string | undefined) => PLACES.find((p) => p.id === id);

const SEED_TRIPS: Trip[] = [
  { id: "t1", title: "Été en Méditerranée", placeIds: ["santorini", "amalfi"], start: "2027-06-26", nights: 10, budget: 2900 },
  { id: "t2", title: "Printemps au Japon", placeIds: ["kyoto"], start: "2027-03-28", nights: 12, budget: 3800 },
  { id: "t3", title: "Road trip nordique", placeIds: ["iceland", "norway"], start: "2027-08-14", nights: 9, budget: 3400 },
];

type State = {
  saved: string[];
  trips: Trip[];
  toggleSaved: (id: string) => void;
  addTrip: (t: Omit<Trip, "id">) => string;
  removeTrip: (id: string) => void;
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
    }),
    { name: "wander-v1", storage: persistStorage },
  ),
);

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** "4 juil. – 14 juil." from an ISO start date and a number of nights. */
export function tripDates(t: Pick<Trip, "start" | "nights">) {
  const d = new Date(`${t.start}T12:00:00`);
  const e = new Date(d.getTime() + t.nights * 86_400_000);
  const f = (x: Date) => `${x.getDate()} ${MONTHS[x.getMonth()]}`;
  return `${f(d)} – ${f(e)}`;
}

export const euros = (n: number) => `${n.toLocaleString("fr-FR")} €`;
