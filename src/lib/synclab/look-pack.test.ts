import { describe, expect, it } from "vitest";
import { buildLookPack, parseLookPack, safeColor } from "./look-pack";
import { THEMES } from "./themes";

const keys = ["synth", "drums", "shared"] as const;
const styles = ["studiopro", "neve"];

describe("look packs", () => {
  it("round-trips a theme, skins and mixer finish", () => {
    const theme = THEMES[0]!;
    const pack = buildLookPack("Night Shift", { name: theme.name, vars: theme.vars }, { synth: { color: "#112233", dim: 40 } }, { style: "neve" });
    const back = parseLookPack(JSON.stringify(pack), keys, styles);
    expect(back).toMatchObject({ name: "Night Shift", theme: { vars: theme.vars }, skins: { synth: { color: "#112233", dim: 40 } }, mixer: { style: "neve" } });
  });
  it("carries the reel-to-reel machine design and drops unknown designs", () => {
    const theme = THEMES[0]!;
    const pack = buildLookPack("Tape", { name: theme.name, vars: theme.vars }, {}, { style: "neve" }, { design: "midnight" });
    expect(parseLookPack(JSON.stringify(pack), keys, styles, ["classic", "midnight"])).toMatchObject({ reel: { design: "midnight" } });
    expect(parseLookPack(JSON.stringify({ ...pack, reel: { design: "evil" } }), keys, styles, ["classic", "midnight"])).not.toHaveProperty("reel");
  });
  it("rejects files that aren't look packs", () => {
    expect(parseLookPack("not json", keys, styles)).toHaveProperty("error");
    expect(parseLookPack(JSON.stringify({ format: "other" }), keys, styles)).toHaveProperty("error");
  });
  it("drops outside images, CSS tricks and unknown panels", () => {
    const back = parseLookPack(JSON.stringify({ format: "synclab-look", version: 1, name: "x", skins: {
      synth: { image: "https://evil.example/x.png", color: "red; background:url(x)" }, hacker: { color: "#fff" },
    }, mixer: { style: "nope" } }), keys, styles);
    expect(back).toMatchObject({ skins: { synth: {} } });
    expect(back).not.toHaveProperty("skins.hacker");
    expect(back).not.toHaveProperty("mixer");
  });
  it("accepts normal CSS colours", () => {
    expect(safeColor("oklch(0.8 0.15 195)")).toBe("oklch(0.8 0.15 195)");
    expect(safeColor("#22d3ee")).toBe("#22d3ee");
    expect(safeColor("url(x)")).toBeUndefined();
  });
});
