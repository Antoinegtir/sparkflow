import { describe, expect, it } from "vitest";
import { bottomTabs, isAndroidId, parseHierarchy } from "../lib/web/android";

const XML = `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy rotation="0">
<node class="android.widget.FrameLayout" bounds="[0,0][1080,2400]" text="" content-desc="" resource-id="" clickable="false" selected="false">
  <node class="android.widget.TextView" bounds="[60,200][600,280]" text="Today" content-desc="" resource-id="com.app:id/today-title" clickable="false" selected="false" heading="true" />
  <node class="android.view.ViewGroup" bounds="[0,2200][540,2400]" text="" content-desc="" resource-id="" clickable="true" selected="true">
    <node class="android.widget.TextView" bounds="[200,2300][340,2350]" text="Home" content-desc="" resource-id="" clickable="false" selected="false" />
  </node>
  <node class="android.view.ViewGroup" bounds="[540,2200][1080,2400]" text="" content-desc="Stats, tab, 2 of 2" resource-id="" clickable="true" selected="false" />
</node>
</hierarchy>`;

describe("android emulator", () => {
  it("tells emulator serials from iOS UDIDs", () => {
    expect(isAndroidId("emulator-5554")).toBe(true);
    expect(isAndroidId("emulator-5554; rm -rf /")).toBe(false);
    expect(isAndroidId("0F3A9C1E-1234-4ABC-9DEF-0123456789AB")).toBe(false);
  });

  it("reads uiautomator's tree as idb elements, in dp", () => {
    const [root] = parseHierarchy(XML, 2.625);
    const [title, home, stats] = root.children!;
    expect(title).toMatchObject({ AXLabel: "Today", AXUniqueId: "today-title", type: "StaticText", traits: ["Header"] });
    expect(title.frame!.x).toBeCloseTo(60 / 2.625);
    // A pressable takes its text as label.
    expect(home).toMatchObject({ type: "Button", AXLabel: "Home", traits: ["selected"] });
    expect(stats.AXLabel).toBe("Stats, tab, 2 of 2");
  });

  it("finds the bottom tabs", () => {
    const tabs = bottomTabs(parseHierarchy(XML, 2.625), 2400 / 2.625);
    expect(tabs.map((t) => [t.label, t.selected])).toEqual([["Home", true], ["Stats", false]]);
  });
  it("marks the header's back arrow as a back button, as on iOS", () => {
    const xml = `<hierarchy><node class="android.widget.Button" bounds="[0,100][120,220]" text="" content-desc="Navigate up" resource-id="" clickable="true" selected="false" /><node class="android.widget.TextView" bounds="[130,100][500,220]" text="Profile" content-desc="" resource-id="" clickable="false" selected="false" /></hierarchy>`;
    const [back, title] = parseHierarchy(xml, 1);
    expect(back.traits).toContain("BackButton");
    expect(title.traits).not.toContain("BackButton");
  });
});
