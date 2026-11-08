import { describe, expect, it } from "vitest";
import { DRUM_GENRES, GENRE_GROUPS, type DrumRole } from "./drummer";
import { kitHue, kitLayoutFor, pieceForRole } from "./drum-kit-layout";

const ROLES: DrumRole[] = ["kick", "snare", "clap", "rim", "hat", "openhat", "ride", "crash", "tomHi", "tomMid", "tomLo", "shaker", "conga", "congaLo", "cowbell", "clave", "tamb", "perc"];

describe("drum set picture", () => {
  it("each genre group has its own kind of set", () => {
    expect(kitLayoutFor("Band").style).toBe("band");
    expect(kitLayoutFor("Electronic").style).toBe("electronic");
    expect(kitLayoutFor("Hip-Hop & R&B").style).toBe("pads");
    expect(kitLayoutFor("World & Latin").style).toBe("latin");
  });

  it("every drum the drummer can hit shows on a piece of every set", () => {
    for (const g of GENRE_GROUPS) for (const role of ROLES) expect(pieceForRole(kitLayoutFor(g), role), `${g}: ${role}`).not.toBeNull();
  });

  it("every style used by a genre lights a piece of that genre's set", () => {
    for (const genre of DRUM_GENRES) for (const role of Object.keys(genre.lanes) as DrumRole[]) expect(pieceForRole(kitLayoutFor(genre.group), role)).not.toBeNull();
  });

  it("genres in the same group get different finishes", () => {
    const band = DRUM_GENRES.filter((g) => g.group === "Band").map((g) => kitHue(g.id));
    expect(new Set(band).size).toBeGreaterThan(band.length / 2);
  });
});
