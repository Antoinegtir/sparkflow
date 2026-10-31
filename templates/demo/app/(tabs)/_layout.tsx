import { Tabs } from "@/components/kit";
import { useWander } from "@/lib/store";

export default function TabsLayout() {
  const saved = useWander((s) => s.saved.length);
  return (
    <Tabs glass>
      <Tabs.Screen name="index" options={{ title: "Explore", icon: { sf: "safari", ion: "compass-outline" } }} />
      <Tabs.Screen name="trips" options={{ title: "Trips", icon: { sf: "airplane", ion: "airplane-outline" } }} />
      <Tabs.Screen name="saved" options={{ title: "Saved", icon: { sf: "heart", ion: "heart-outline" }, badge: saved ? String(saved) : undefined }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", icon: { sf: "person.crop.circle", ion: "person-circle-outline" } }} />
    </Tabs>
  );
}
