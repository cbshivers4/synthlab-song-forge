import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { OPT_IN_PANELS, WALLPANEL_PANELS, resolveSkin, useSkin, type SkinKey } from "./skins";

const NEW_PANELS: SkinKey[] = [
  "coproducer",
  "stemgen",
  "stemsplit",
  "converter",
  "voice",
  "reel",
  "video",
  "hum",
  "bass",
  "mastering",
  "reference",
];

describe("custom colours and wallpaper on the tool panels", () => {
  it("every new panel is listed in Appearance, right after Live Looper", () => {
    const keys = WALLPANEL_PANELS.map((p) => p.key);
    const looper = keys.indexOf("looper");
    expect(keys.slice(looper + 1, looper + 1 + NEW_PANELS.length)).toEqual(NEW_PANELS);
  });
  it("useSkin starts empty for every new panel (no colour, no picture)", () => {
    for (const key of NEW_PANELS) {
      let seen: unknown;
      const Probe = () => {
        seen = useSkin(key);
        return null;
      };
      renderToString(createElement(Probe));
      expect(seen).toEqual({});
      expect(resolveSkin({}, key)).toEqual({});
    }
  });
  it("an existing all-panels shared wallpaper does not appear on new panels until ticked", () => {
    const shared = { image: "data:image/jpeg;base64,AA" };
    for (const key of NEW_PANELS) {
      expect(OPT_IN_PANELS).toContain(key);
      expect(resolveSkin({ shared }, key).image).toBeUndefined();
      expect(resolveSkin({ shared: { ...shared, panels: [key] } }, key).image).toBe(shared.image);
    }
    expect(resolveSkin({ shared }, "looper").image).toBe(shared.image);
  });
});
