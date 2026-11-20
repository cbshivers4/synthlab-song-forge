import { describe, expect, it } from "vitest";
import { defaultPads } from "./presets";
import { renderVintageDrum } from "./vintage-drums";

describe("kit extra pads", () => {
  it("latin kit adds congas and bongos", () => {
    const names = defaultPads(16, "latin").map((p) => p.name);
    expect(names).toEqual(
      expect.arrayContaining(["HIGH CONGA OPEN", "TUMBA", "BONGO HIGH", "QUINTO"]),
    );
  });
  it("jazz kit adds brush toms", () => {
    expect(defaultPads(16, "jazz").map((p) => p.name)).toContain("BRUSH FLOOR TOM");
  });
  it("extra voices render real, distinct sound", () => {
    const a = renderVintageDrum("latin", "tom", 0.5, 8000, "conga_hi")!;
    const b = renderVintageDrum("latin", "tom", 0.5, 8000, "bongo_hi")!;
    expect(a.some((v) => Math.abs(v) > 0.1)).toBe(true);
    expect(a.slice(0, 400).join() === b.slice(0, 400).join()).toBe(false);
  });
});
