import { describe, expect, it } from "vitest";
import { countByKind, searchLibrary, type LibraryEntry } from "./library-search";

const E: LibraryEntry[] = [
  { id: "1", kind: "effect", title: "Reverb Shimmer Cathedral", sub: "Space" },
  { id: "2", kind: "effect", title: "Reverb", sub: "Space" },
  { id: "3", kind: "preset", title: "Grand Piano", sub: "Piano" },
  { id: "4", kind: "preset", title: "Acid Line", sub: "Bass" },
  { id: "5", kind: "kit", title: "808 Classic", sub: "Hip-hop", tags: "boom kick" },
  { id: "6", kind: "effect-preset", title: "Plate Wash", sub: "Plate Reverb" },
];

describe("library search", () => {
  it("ranks the exact name first and shorter names before longer ones", () => {
    expect(
      searchLibrary(E, "reverb")
        .map((e) => e.id)
        .slice(0, 2),
    ).toEqual(["2", "1"]);
  });
  it("requires every typed word to match", () => {
    expect(searchLibrary(E, "reverb cathedral").map((e) => e.id)).toEqual(["1"]);
    expect(searchLibrary(E, "reverb piano")).toEqual([]);
  });
  it("finds things by musician shorthand", () => {
    expect(searchLibrary(E, "verb").map((e) => e.id)).toContain("6");
    expect(searchLibrary(E, "keys").map((e) => e.id)).toContain("3");
  });
  it("matches hidden tags and tolerates missing letters", () => {
    expect(searchLibrary(E, "boom").map((e) => e.id)).toEqual(["5"]);
    expect(searchLibrary(E, "grnd").map((e) => e.id)).toEqual(["3"]);
  });
  it("doesn't let loose letter matches flood results", () => {
    expect(
      searchLibrary(
        [...E, { id: "7", kind: "preset", title: "Modular Tech Seq Bass Rolling" }],
        "dub verb",
      ),
    ).toEqual([]);
  });
  it("filters by category and counts matches per category", () => {
    expect(searchLibrary(E, "", "preset").map((e) => e.id)).toEqual(["3", "4"]);
    expect(countByKind(E, "reverb")).toMatchObject({ effect: 2, "effect-preset": 1, preset: 0 });
  });
});
