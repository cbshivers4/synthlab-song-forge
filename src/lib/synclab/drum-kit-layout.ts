import type { DrumRole, GenreGroup } from "./drummer";

/**
 * The drum set picture on the Live Drummer: one setup per genre group (acoustic band kit,
 * electronic kit, hip-hop beat-pad station, Latin percussion set). Each piece lists the drummer
 * roles it plays, so the picture lights the piece the drummer hits, and tapping a piece plays
 * its first role through the drummer's own channel. Pure data, shared by the picture and tests.
 */
export type KitStyle = "band" | "electronic" | "pads" | "latin";
export type PieceShape = "cymbal" | "hat" | "drum" | "kick" | "tower" | "hexpad" | "cympad" | "sqpad" | "beatpad" | "conga" | "bongos" | "cowbell" | "tamb" | "shaker" | "clave";

export interface KitPiece {
  id: string;
  label: string;
  shape: PieceShape;
  /** roles this piece plays; the first is what a tap plays */
  roles: DrumRole[];
  x: number; y: number; w: number; h: number;
}

export interface KitLayout { style: KitStyle; name: string; pieces: KitPiece[] }

export const KIT_VIEWBOX = { w: 320, h: 140 } as const;

const p = (id: string, label: string, shape: PieceShape, roles: DrumRole[], x: number, y: number, w: number, h = w): KitPiece => ({ id, label, shape, roles, x, y, w, h });

// Drawing order is back to front (later pieces sit on top).
const BAND: KitLayout = {
  style: "band", name: "Acoustic kit",
  pieces: [
    p("kick", "Kick", "kick", ["kick"], 155, 98, 76),
    p("crash", "Crash", "cymbal", ["crash"], 62, 22, 80, 18),
    p("ride", "Ride", "cymbal", ["ride"], 262, 30, 88, 20),
    p("cowbell", "Cowbell", "cowbell", ["cowbell", "clave", "perc"], 208, 18, 18, 16),
    p("tomHi", "High tom", "drum", ["tomHi", "conga"], 128, 46, 40, 22),
    p("tomMid", "Mid tom", "drum", ["tomMid", "congaLo"], 182, 46, 44, 24),
    p("tomLo", "Floor tom", "drum", ["tomLo"], 240, 80, 54, 42),
    p("hats", "Hi-hat", "hat", ["hat", "openhat"], 24, 62, 44, 10),
    p("snare", "Snare", "drum", ["snare", "rim", "clap"], 74, 80, 50, 18),
    p("tamb", "Tambourine", "tamb", ["tamb", "shaker"], 294, 104, 24),
  ],
};

const ELECTRONIC: KitLayout = {
  style: "electronic", name: "Electronic kit",
  pieces: [
    p("crash", "Crash pad", "cympad", ["crash"], 50, 20, 68, 16),
    p("ride", "Ride pad", "cympad", ["ride"], 270, 24, 76, 18),
    p("hats", "Hi-hat pad", "cympad", ["hat", "openhat"], 24, 66, 40, 10),
    p("kick", "Kick tower", "tower", ["kick"], 160, 84, 46, 56),
    p("tomHi", "Tom pad 1", "hexpad", ["tomHi"], 120, 50, 34),
    p("tomMid", "Tom pad 2", "hexpad", ["tomMid"], 200, 50, 34),
    p("snare", "Snare pad", "hexpad", ["snare", "rim", "clap"], 76, 88, 42),
    p("tomLo", "Tom pad 3", "hexpad", ["tomLo"], 244, 90, 42),
    p("perc1", "Perc pad 1", "sqpad", ["perc", "cowbell", "clave"], 294, 64, 28),
    p("perc2", "Perc pad 2", "sqpad", ["shaker", "tamb", "conga", "congaLo"], 294, 104, 28),
  ],
};

const PAD_ROLES: [string, string, DrumRole[]][] = [
  ["crash", "Crash", ["crash"]], ["ride", "Ride", ["ride"]], ["openhat", "Open hat", ["openhat"]], ["perc", "Perc", ["perc", "clave"]],
  ["tomHi", "Tom hi", ["tomHi"]], ["tomMid", "Tom mid", ["tomMid"]], ["tomLo", "Tom lo", ["tomLo"]], ["cowbell", "Cowbell", ["cowbell"]],
  ["hat", "Hat", ["hat"]], ["rim", "Rim", ["rim"]], ["shaker", "Shaker", ["shaker"]], ["conga", "Conga", ["conga", "congaLo"]],
  ["kick", "Kick", ["kick"]], ["snare", "Snare", ["snare"]], ["clap", "Clap", ["clap"]], ["tamb", "Tamb", ["tamb"]],
];
const PADS: KitLayout = {
  style: "pads", name: "Beat pad station",
  pieces: PAD_ROLES.map(([id, label, roles], i) => {
    const col = i % 4, row = Math.floor(i / 4);
    return p(id, label, "beatpad", roles, 150 + col * 44, 22 + row * 31, 38, 26);
  }),
};

const LATIN: KitLayout = {
  style: "latin", name: "Latin percussion",
  pieces: [
    p("kick", "Kick", "kick", ["kick"], 150, 106, 60),
    p("crash", "Crash", "cymbal", ["crash"], 40, 18, 68, 16),
    p("ride", "Ride", "cymbal", ["ride"], 292, 14, 52, 12),
    p("timbHi", "Timbale high", "drum", ["snare", "rim", "clap", "tomHi"], 128, 40, 40, 20),
    p("timbLo", "Timbale low", "drum", ["tomMid", "tomLo"], 176, 42, 44, 22),
    p("cowbell", "Cowbell", "cowbell", ["cowbell"], 216, 20, 20, 18),
    p("congaHi", "Conga", "conga", ["conga"], 248, 60, 34, 70),
    p("congaLo", "Tumba", "conga", ["congaLo"], 292, 64, 38, 70),
    p("bongos", "Bongos", "bongos", ["perc"], 76, 70, 56, 16),
    p("hats", "Hi-hat", "hat", ["hat", "openhat"], 22, 70, 36, 9),
    p("clave", "Claves", "clave", ["clave"], 70, 116, 40, 14),
    p("shaker", "Shaker", "shaker", ["shaker", "tamb"], 212, 116, 30, 12),
  ],
};

const BY_GROUP: Record<GenreGroup, KitLayout> = { Band: BAND, Electronic: ELECTRONIC, "Hip-Hop & R&B": PADS, "World & Latin": LATIN };

export function kitLayoutFor(group: GenreGroup): KitLayout { return BY_GROUP[group]; }

/** The piece that shows a role being played (first match in drawing order), or null. */
export function pieceForRole(layout: KitLayout, role: DrumRole): KitPiece | null {
  return layout.pieces.find((x) => x.roles.includes(role)) ?? null;
}

/** Each style gets its own finish colour (hue 0–359) so every genre's set looks different. */
export function kitHue(genreId: string): number {
  let h = 2166136261;
  for (let i = 0; i < genreId.length; i++) { h ^= genreId.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 360;
}
