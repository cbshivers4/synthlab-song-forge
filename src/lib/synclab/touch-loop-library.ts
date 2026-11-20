import { TOUCH_LANES, TOUCH_SCALES, type TouchLoops, type TouchLoopNote } from "./touch-synth";
import type { DrumKitId } from "./types";

export interface TouchSetSounds {
  bass: string;
  poly: string;
  melody: string;
  stabs: string;
}
export interface GenrePattern {
  genre: string;
  names: [string, string];
  scale: string;
  /** Drum kit, tempo and one sound per tonal part, loaded with the set like a hardware loop preset. */
  kit: DrumKitId;
  bpm: number;
  sounds: TouchSetSounds;
  kick: number[];
  snare: number[];
  hats: number[];
  bass: number[];
  riff: number[];
  chords: number[];
  stabs: number[];
}

// Original two-bar MIDI compositions, not commercial song recordings or factory loops.
const patterns: GenrePattern[] = [
  {
    genre: "Detroit Techno",
    names: ["Motor City Drive", "Afterhours Circuit"],
    kit: "detroit",
    bpm: 128,
    sounds: {
      bass: "Techno Drone Bass",
      poly: "Submerge Pad",
      melody: "Cybotron Lead",
      stabs: "Detroit Stab",
    },
    scale: "Minor",
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hats: [2, 6, 10, 14],
    bass: [0, 3, 6, 8, 11, 14],
    riff: [0, 4, 2, 6, 4, 1],
    chords: [0, 8],
    stabs: [2, 7, 10, 15],
  },
  {
    genre: "House",
    names: ["Warehouse Soul", "Sunday Floor"],
    kit: "house",
    bpm: 124,
    sounds: {
      bass: "TD-3 Clean House Bass",
      poly: "Deep Keys",
      melody: "Soft Flute",
      stabs: "SYNCE 4 Muted House Stab",
    },
    scale: "Dorian",
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hats: [2, 6, 10, 14, 15],
    bass: [0, 2, 7, 8, 10, 15],
    riff: [0, 2, 4, 5, 4, 2],
    chords: [0, 6, 10],
    stabs: [2, 6, 10, 14],
  },
  {
    genre: "Deep House",
    names: ["Midnight Velvet", "Low Light Lounge"],
    kit: "house",
    bpm: 120,
    sounds: { bass: "Round Bass", poly: "Deep Keys", melody: "Glass Lead", stabs: "Dub Chord" },
    scale: "Minor",
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hats: [2, 6, 14],
    bass: [0, 6, 8, 14],
    riff: [0, 4, 2, 1],
    chords: [0, 10],
    stabs: [3, 11],
  },
  {
    genre: "Hip-Hop",
    names: ["Boom Bap Avenue", "Headnod Session"],
    kit: "boombap",
    bpm: 90,
    sounds: {
      bass: "Upright Bass",
      poly: "Rhodes Soul",
      melody: "Soft Sax",
      stabs: "Muted Trumpet",
    },
    scale: "Minor pentatonic",
    kick: [0, 7, 10],
    snare: [4, 12],
    hats: [0, 2, 4, 6, 8, 10, 12, 14],
    bass: [0, 7, 10, 14],
    riff: [0, 2, 3, 1],
    chords: [0, 8],
    stabs: [6, 14],
  },
  {
    genre: "Trap",
    names: ["808 Nightfall", "Diamond Bounce"],
    kit: "trap",
    bpm: 140,
    sounds: { bass: "808 Sub Glide", poly: "Vapor Pad", melody: "Trap Bell", stabs: "Bell Pluck" },
    scale: "Minor",
    kick: [0, 6, 11, 14],
    snare: [8],
    hats: [0, 2, 4, 6, 7, 8, 10, 12, 13, 14, 15],
    bass: [0, 6, 11, 14],
    riff: [0, 0, 4, 6],
    chords: [0],
    stabs: [3, 7, 11, 15],
  },
  {
    genre: "R&B",
    names: ["Silk & Soul", "Late Night Letters"],
    kit: "808",
    bpm: 94,
    sounds: {
      bass: "Round Bass",
      poly: "Stage Tine EP",
      melody: "Whistle Lead",
      stabs: "Glass Pad",
    },
    scale: "Major pentatonic",
    kick: [0, 7, 10],
    snare: [4, 12],
    hats: [0, 3, 6, 8, 11, 14],
    bass: [0, 5, 8, 13],
    riff: [0, 2, 4, 3],
    chords: [0, 6],
    stabs: [7, 15],
  },
  {
    genre: "Funk",
    names: ["Pocket Machine", "Electric Strut"],
    kit: "linn",
    bpm: 108,
    sounds: { bass: "Slap Bass", poly: "Clav Funk", melody: "Horn Section", stabs: "Brass Stab" },
    scale: "Dorian",
    kick: [0, 3, 8, 10],
    snare: [4, 12],
    hats: [0, 2, 4, 6, 8, 10, 12, 14],
    bass: [0, 2, 3, 6, 8, 10, 11, 14],
    riff: [0, 4, 0, 6, 2, 4, 1, 0],
    chords: [0, 8],
    stabs: [3, 6, 11, 14],
  },
  {
    genre: "Jazz",
    names: ["Blue Note Walk", "Moonlit Quartet"],
    kit: "jazz",
    bpm: 112,
    sounds: {
      bass: "Upright Bass",
      poly: "Concert Grand",
      melody: "Soft Sax",
      stabs: "Muted Trumpet",
    },
    scale: "Dorian",
    kick: [0, 10],
    snare: [6, 14],
    hats: [0, 3, 4, 7, 8, 11, 12, 15],
    bass: [0, 4, 8, 12],
    riff: [0, 2, 4, 6],
    chords: [0, 8],
    stabs: [7, 15],
  },
  {
    genre: "Latin",
    names: ["Conga Street", "Tropical Nights"],
    kit: "latin",
    bpm: 100,
    sounds: {
      bass: "Pluck Bass",
      poly: "Upright Parlor Piano",
      melody: "Pan Flute",
      stabs: "Steel Drum-ish",
    },
    scale: "Major",
    kick: [0, 6, 8, 14],
    snare: [4, 10, 12],
    hats: [0, 2, 3, 6, 8, 10, 11, 14],
    bass: [0, 3, 6, 8, 11, 14],
    riff: [0, 4, 2, 0, 5, 4],
    chords: [0, 6, 10],
    stabs: [0, 3, 6, 10, 12],
  },
  {
    genre: "Reggaeton",
    names: ["Dembow Heat", "Neon Coast"],
    kit: "808",
    bpm: 96,
    sounds: {
      bass: "Sub Bass",
      poly: "Future Bass Chord",
      melody: "Square Lead",
      stabs: "Marimba Pluck",
    },
    scale: "Minor",
    kick: [0, 8],
    snare: [3, 6, 11, 14],
    hats: [0, 2, 4, 6, 8, 10, 12, 14],
    bass: [0, 6, 8, 14],
    riff: [0, 2, 4, 1],
    chords: [0, 8],
    stabs: [3, 6, 11, 14],
  },
  {
    genre: "Afrobeats",
    names: ["Sunrise Groove", "Palm Rhythm"],
    kit: "afrobeat",
    bpm: 104,
    sounds: { bass: "Round Bass", poly: "Wurli Warm", melody: "Kalimba", stabs: "Marimba Pluck" },
    scale: "Major pentatonic",
    kick: [0, 6, 10],
    snare: [4, 12],
    hats: [0, 3, 6, 8, 11, 14],
    bass: [0, 3, 6, 10, 14],
    riff: [0, 2, 4, 3, 1],
    chords: [0, 6, 12],
    stabs: [2, 7, 10, 15],
  },
  {
    genre: "Drum & Bass",
    names: ["Jungle Transit", "Liquid Skyline"],
    kit: "jungle",
    bpm: 172,
    sounds: { bass: "Reese Bass", poly: "Aurora Pad", melody: "Glass Lead", stabs: "Bell Pluck" },
    scale: "Minor",
    kick: [0, 10],
    snare: [4, 12],
    hats: [0, 2, 4, 6, 8, 10, 12, 14, 15],
    bass: [0, 5, 8, 10, 15],
    riff: [0, 0, 4, 2, 6],
    chords: [0, 8],
    stabs: [3, 9, 14],
  },
  {
    genre: "Dub",
    names: ["Echo Yard", "Submarine Skank"],
    kit: "707",
    bpm: 72,
    sounds: {
      bass: "TD-3 Clean Dub Sub",
      poly: "Dub Chord",
      melody: "Space Echo",
      stabs: "Rhodes Soul",
    },
    scale: "Minor pentatonic",
    kick: [0, 8, 11],
    snare: [8],
    hats: [2, 6, 10, 14],
    bass: [0, 3, 6, 11],
    riff: [0, 0, 3, 1],
    chords: [0],
    stabs: [4, 12],
  },
  {
    genre: "Synthwave",
    names: ["Night Highway", "Retro Horizon"],
    kit: "linn",
    bpm: 100,
    sounds: {
      bass: "Analog Mono Bass",
      poly: "Synth Strings 80s",
      melody: "Neon Saw Lead",
      stabs: "Night Arp",
    },
    scale: "Minor",
    kick: [0, 8],
    snare: [4, 12],
    hats: [0, 2, 4, 6, 8, 10, 12, 14],
    bass: [0, 2, 4, 6, 8, 10, 12, 14],
    riff: [0, 0, 4, 4, 2, 2, 6, 6],
    chords: [0, 8],
    stabs: [0, 2, 4, 6, 8, 10, 12, 14],
  },
  {
    genre: "Ambient",
    names: ["Orbit Drift", "Quiet Constellation"],
    kit: "cr78",
    bpm: 80,
    sounds: {
      bass: "Sub Bass",
      poly: "Shimmer Pad",
      melody: "Music Box Toy Piano",
      stabs: "Glass Arp",
    },
    scale: "Major pentatonic",
    kick: [0],
    snare: [12],
    hats: [6, 14],
    bass: [0, 12],
    riff: [0, 3],
    chords: [0],
    stabs: [7, 15],
  },
  {
    genre: "Rock",
    names: ["Garage Sparks", "Arena Pulse"],
    kit: "rock",
    bpm: 120,
    sounds: {
      bass: "Punch Bass",
      poly: "Gospel Organ",
      melody: "Gritty Lead",
      stabs: "Brass Stab",
    },
    scale: "Blues",
    kick: [0, 6, 8, 10],
    snare: [4, 12],
    hats: [0, 2, 4, 6, 8, 10, 12, 14],
    bass: [0, 4, 6, 8, 12, 14],
    riff: [0, 0, 3, 0, 4, 3],
    chords: [0, 8],
    stabs: [0, 6, 8, 14],
  },
  // Added genres (original compositions).
  {
    genre: "Electro",
    names: ["Planet Rock Circuit", "Clear Signal"],
    kit: "808",
    bpm: 128,
    sounds: {
      bass: "Electro Bass 313",
      poly: "Detroit Stab",
      melody: "Electro Bleep",
      stabs: "Talkbox Vox",
    },
    scale: "Phrygian",
    kick: [0, 3, 10],
    snare: [4, 12],
    hats: [0, 2, 4, 6, 8, 10, 12, 14],
    bass: [0, 3, 6, 10, 13],
    riff: [0, 1, 4, 0, 3, 1],
    chords: [0],
    stabs: [6, 9, 14],
  },
  {
    genre: "Ghetto Tech",
    names: ["Eastside Booty", "Jit Floor"],
    kit: "ghettotech",
    bpm: 145,
    sounds: {
      bass: "Ghetto Tech Bass",
      poly: "Rave Stab",
      melody: "Donk Lead",
      stabs: "SYNCE 4 Electro Needle Stab",
    },
    scale: "Minor",
    kick: [0, 4, 8, 10, 12],
    snare: [4, 12],
    hats: [0, 2, 3, 6, 8, 10, 11, 14],
    bass: [0, 4, 8, 10, 12],
    riff: [0, 0, 3, 0, 4, 2],
    chords: [0],
    stabs: [2, 6, 10, 14],
  },
  {
    genre: "Techno",
    names: ["Tunnel Vision", "Steel Pulse"],
    kit: "techno",
    bpm: 132,
    sounds: {
      bass: "Techno Drone Bass",
      poly: "Dark Drone",
      melody: "Dark Mono Lead",
      stabs: "SYNCE 4 Warehouse Stab",
    },
    scale: "Phrygian",
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hats: [2, 6, 10, 14],
    bass: [2, 3, 6, 7, 10, 11, 14, 15],
    riff: [0, 0, 1, 0],
    chords: [0],
    stabs: [3, 7, 11],
  },
  {
    genre: "Acid House",
    names: ["Squelch Theory", "Smiley Basement"],
    kit: "909",
    bpm: 124,
    sounds: { bass: "303 Acid", poly: "Juno Poly", melody: "Acid Pluck", stabs: "Rave Stab" },
    scale: "Minor",
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hats: [2, 6, 10, 14],
    bass: [0, 1, 3, 4, 6, 8, 9, 11, 12, 14],
    riff: [0, 7, 0, 3, 5, 0, 10, 3],
    chords: [0, 8],
    stabs: [6, 14],
  },
  {
    genre: "Dubstep",
    names: ["Half-Time Pressure", "Wobble Avenue"],
    kit: "industrial",
    bpm: 140,
    sounds: {
      bass: "Wobble Bass",
      poly: "Dark Drone",
      melody: "Sync Scream Lead",
      stabs: "Laser Zap",
    },
    scale: "Minor",
    kick: [0, 10],
    snare: [8],
    hats: [0, 2, 4, 6, 8, 10, 12, 14],
    bass: [0, 3, 6, 10, 11, 14],
    riff: [0, 0, 1, 0, 3, 2],
    chords: [0],
    stabs: [3, 11],
  },
  {
    genre: "Trance",
    names: ["Euphoric Skies", "Gatekeeper"],
    kit: "909",
    bpm: 138,
    sounds: {
      bass: "Fat Unison Bass",
      poly: "Poly Synth Supersaw",
      melody: "Supersaw Anthem",
      stabs: "Trance Arp",
    },
    scale: "Minor",
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hats: [2, 6, 10, 14],
    bass: [2, 3, 6, 7, 10, 11, 14, 15],
    riff: [0, 2, 4, 7, 4, 2, 0, 4],
    chords: [0, 8],
    stabs: [0, 2, 4, 6, 8, 10, 12, 14],
  },
  {
    genre: "UK Garage",
    names: ["Two-Step Riviera", "Southside Shuffle"],
    kit: "909",
    bpm: 132,
    sounds: { bass: "Reese Bass", poly: "Deep Keys", melody: "Vocal Lead", stabs: "Dub Chord" },
    scale: "Minor",
    kick: [0, 7, 10],
    snare: [4, 12],
    hats: [2, 5, 6, 10, 13, 14],
    bass: [0, 3, 7, 10, 13],
    riff: [0, 3, 2, 4, 1],
    chords: [0, 7],
    stabs: [3, 11],
  },
  {
    genre: "Breakbeat",
    names: ["Funky Breaks", "Big Beat Bounce"],
    kit: "jungle",
    bpm: 130,
    sounds: { bass: "Moog Mono", poly: "Hoover Rave", melody: "Gritty Lead", stabs: "Brass Stab" },
    scale: "Dorian",
    kick: [0, 6, 10],
    snare: [4, 12, 15],
    hats: [0, 2, 4, 6, 8, 10, 12, 14],
    bass: [0, 6, 8, 10, 14],
    riff: [0, 3, 0, 4, 2],
    chords: [0],
    stabs: [3, 10],
  },
  {
    genre: "Lo-Fi Hip-Hop",
    names: ["Rainy Study", "Cassette Sunset"],
    kit: "lofi",
    bpm: 82,
    sounds: { bass: "Round Bass", poly: "Lo-Fi Pad", melody: "Felt Piano", stabs: "Stage Tine EP" },
    scale: "Dorian",
    kick: [0, 7, 9],
    snare: [4, 12],
    hats: [0, 2, 4, 6, 8, 10, 12, 14],
    bass: [0, 7, 9],
    riff: [4, 2, 0, 3, 1],
    chords: [0, 8],
    stabs: [6, 14],
  },
  {
    genre: "Drill",
    names: ["Slide Season", "Block Patrol"],
    kit: "drill",
    bpm: 142,
    sounds: {
      bass: "Drill Slide",
      poly: "Vapor Pad",
      melody: "Bell Pluck",
      stabs: "Cello Section",
    },
    scale: "Harmonic minor",
    kick: [0, 9],
    snare: [6, 14],
    hats: [0, 3, 6, 8, 10, 12, 13, 15],
    bass: [0, 3, 9, 11],
    riff: [0, 4, 3, 1],
    chords: [0],
    stabs: [2, 10],
  },
  {
    genre: "Amapiano",
    names: ["Log Drum Sunday", "Pretoria Glow"],
    kit: "house",
    bpm: 113,
    sounds: {
      bass: "Sine Thump Bass",
      poly: "Deep Keys",
      melody: "Whistle Lead",
      stabs: "Marimba Pluck",
    },
    scale: "Dorian",
    kick: [0, 4, 8, 12],
    snare: [6, 14],
    hats: [2, 6, 10, 13, 14],
    bass: [3, 6, 10, 11, 14],
    riff: [0, 2, 4, 2],
    chords: [0, 10],
    stabs: [3, 7, 11],
  },
  {
    genre: "Disco",
    names: ["Mirrorball Strut", "Studio Night"],
    kit: "linn",
    bpm: 118,
    sounds: {
      bass: "Motown Bass",
      poly: "Chamber Strings",
      melody: "Clav Funk",
      stabs: "Horn Section",
    },
    scale: "Major",
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hats: [2, 6, 10, 14],
    bass: [0, 2, 4, 6, 8, 10, 12, 14],
    riff: [0, 4, 2, 5, 4, 2],
    chords: [0, 6, 10],
    stabs: [6, 14],
  },
  {
    genre: "Pop",
    names: ["Radio Heart", "Summer Single"],
    kit: "acoustic",
    bpm: 110,
    sounds: {
      bass: "Pick Bass",
      poly: "Bright Pop Grand",
      melody: "Glass Lead",
      stabs: "Sparkle Arp",
    },
    scale: "Major",
    kick: [0, 8, 10],
    snare: [4, 12],
    hats: [0, 2, 4, 6, 8, 10, 12, 14],
    bass: [0, 8, 10],
    riff: [0, 2, 4, 2, 1, 0],
    chords: [0, 8],
    stabs: [4, 12],
  },
  {
    genre: "Footwork",
    names: ["Juke Circuit", "Triplet Feet"],
    kit: "ghettotech",
    bpm: 160,
    sounds: {
      bass: "808 Sub Glide",
      poly: "Glass Pad",
      melody: "Vocal Lead",
      stabs: "Chime Pluck",
    },
    scale: "Minor",
    kick: [0, 3, 6, 10, 13],
    snare: [8],
    hats: [2, 5, 8, 11, 14],
    bass: [0, 3, 6, 10, 13],
    riff: [0, 0, 3, 1],
    chords: [0],
    stabs: [4, 12],
  },
  {
    genre: "Gospel",
    names: ["Sunday Praise", "Choir Lift"],
    kit: "acoustic",
    bpm: 96,
    sounds: {
      bass: "Upright Bass",
      poly: "Gospel Organ",
      melody: "Rhodes Soul",
      stabs: "Horn Section",
    },
    scale: "Major pentatonic",
    kick: [0, 7, 10],
    snare: [4, 12],
    hats: [0, 2, 4, 6, 8, 10, 12, 14],
    bass: [0, 4, 7, 10, 14],
    riff: [0, 2, 4, 3, 2],
    chords: [0, 8],
    stabs: [6, 14],
  },
  {
    genre: "Bossa Nova",
    names: ["Ipanema Breeze", "Café Copacabana"],
    kit: "latin",
    bpm: 90,
    sounds: {
      bass: "Upright Bass",
      poly: "Pluck Nylon",
      melody: "Breathy Flute",
      stabs: "Felt Piano",
    },
    scale: "Lydian",
    kick: [0, 3, 8, 11],
    snare: [0, 3, 6, 10, 12],
    hats: [0, 2, 4, 6, 8, 10, 12, 14],
    bass: [0, 6, 8, 14],
    riff: [0, 4, 2, 6, 1],
    chords: [0, 3, 6, 10, 12],
    stabs: [7, 15],
  },
  {
    genre: "Chillwave",
    names: ["Pastel Shore", "Neon Daydream"],
    kit: "lofi",
    bpm: 100,
    sounds: {
      bass: "Analog Mono Bass",
      poly: "Vapor Pad",
      melody: "Hollow Pulse Lead",
      stabs: "Dream Pluck",
    },
    scale: "Mixolydian",
    kick: [0, 8],
    snare: [4, 12],
    hats: [2, 6, 10, 14],
    bass: [0, 3, 8, 11],
    riff: [0, 4, 2, 5],
    chords: [0],
    stabs: [2, 6, 10, 14],
  },
  {
    genre: "Industrial",
    names: ["Factory Floor", "Rust Machine"],
    kit: "industrial",
    bpm: 128,
    sounds: {
      bass: "Distorted 808",
      poly: "Dark Matter Drone",
      melody: "Sync Scream Lead",
      stabs: "Metal Hit",
    },
    scale: "Locrian",
    kick: [0, 4, 8, 11, 12],
    snare: [4, 12],
    hats: [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14],
    bass: [0, 1, 4, 8, 9, 12],
    riff: [0, 1, 0, 4],
    chords: [0],
    stabs: [3, 7, 15],
  },
];

export const TOUCH_LOOP_LIBRARY = patterns.flatMap((pattern, genreIndex) =>
  pattern.names.map((name, variation) => ({
    id: `${genreIndex}-${variation}`,
    name,
    genre: pattern.genre,
    scale: pattern.scale,
    variation,
    pattern,
  })),
);
export const TOUCH_LOOP_GENRES = patterns.map((p) => p.genre);
export type TouchLoopPreset = (typeof TOUCH_LOOP_LIBRARY)[number];

export function genreLoops(
  preset: { variation: number; pattern: GenrePattern },
  root: number,
  scale = preset.pattern.scale,
  bars = 2,
): TouchLoops {
  const total = bars * 16;
  const degrees = TOUCH_SCALES[scale] ?? TOUCH_SCALES["Minor"] ?? [0];
  const pitch = (degree: number, octave: number) =>
    (octave + 1) * 12 +
    root +
    Math.floor(degree / degrees.length) * 12 +
    (degrees[degree % degrees.length] ?? 0);
  const loops: TouchLoops = Object.fromEntries(TOUCH_LANES.map((l) => [l.id, []]));
  const add = (lane: string, step: number, notePitch: number, length: number, vel: number) => {
    if (step < total)
      loops[lane]?.push({ step, pitch: notePitch, length: Math.min(length, total - step), vel });
  };
  for (let bar = 0; bar < bars; bar++) {
    const offset = bar * 16;
    const p = preset.pattern;
    const shift =
      ((preset.variation ? 2 + bar : bar) % 2) + (preset.variation ? 2 : 0) + (bar >= 2 ? 1 : 0);
    p.kick.forEach((step) => add("drums", offset + step, 0, 0.5, 0.92));
    p.snare.forEach((step) => add("drums", offset + step, preset.variation ? 3 : 1, 0.5, 0.82));
    p.hats.forEach((step, i) => add("drums", offset + step, 2, 0.25, i % 2 ? 0.46 : 0.64));
    if (preset.variation) add("drums", offset + 15, 4, 0.5, 0.65);
    p.bass.forEach((step, i) =>
      add("bass", offset + step, pitch(p.riff[(i + shift) % p.riff.length] ?? 0, 2), 1.5, 0.85),
    );
    p.chords.forEach((step, i) => {
      const degree = (i * 2 + shift) % degrees.length;
      [0, 2, 4].forEach((tone) =>
        add("poly", offset + step, pitch(degree + tone, 3), Math.min(7, 16 - step), 0.54),
      );
    });
    p.riff.forEach((degree, i) =>
      add(
        "melody",
        offset + Math.floor((i * 16) / p.riff.length),
        pitch((degree + shift) % degrees.length, 4),
        preset.variation ? 1 : 2,
        0.66,
      ),
    );
    p.stabs.forEach((step, i) =>
      add(
        "stabs",
        offset + step,
        pitch((p.riff[(i + shift) % p.riff.length] ?? 0) + degrees.length, 3),
        0.75,
        0.62,
      ),
    );
  }
  return loops;
}

/** Replace only the explicit load target, retaining all other recorded lanes. */
export function loadGenreLoops(
  current: TouchLoops,
  incoming: TouchLoops,
  laneId?: string,
): TouchLoops {
  const copy = (notes: TouchLoopNote[]) => notes.map((n) => ({ ...n }));
  return laneId
    ? { ...current, [laneId]: copy(incoming[laneId] ?? []) }
    : Object.fromEntries(TOUCH_LANES.map((l) => [l.id, copy(incoming[l.id] ?? [])]));
}
/** Small deterministic random generator so a CREATE roll can be described by its seed. */
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * CREATE: a brand-new original set in the style of a genre. The genre's groove is kept recognisable
 * (kick and snare stay), while hats, bassline, riff, chord and stab placements are re-rolled from the seed.
 */
export function createLoopPattern(base: GenrePattern, seed: number): GenrePattern {
  const r = rng(seed);
  const pick = <T>(items: readonly T[]) => items[Math.floor(r() * items.length)] as T;
  const sorted = (steps: Iterable<number>) =>
    [...new Set(steps)].filter((s) => s >= 0 && s < 16).sort((a, b) => a - b);
  const hats = sorted(
    base.hats
      .filter(() => r() > 0.2)
      .concat(Array.from({ length: 3 }, () => pick([1, 3, 5, 7, 9, 11, 13, 15, 2, 6, 10, 14]))),
  );
  const bassPool = [0, 2, 3, 6, 7, 8, 10, 11, 14];
  const bass = sorted([
    0,
    ...base.bass.filter(() => r() > 0.35),
    ...Array.from({ length: 2 + Math.floor(r() * 3) }, () => pick(bassPool)),
  ]);
  const riffLen = 4 + Math.floor(r() * 5);
  const riff = Array.from({ length: riffLen }, (_, i) => (i === 0 ? 0 : Math.floor(r() * 6)));
  const chords = sorted([0, ...(r() > 0.5 ? [8] : []), ...(r() > 0.7 ? [pick([6, 10, 12])] : [])]);
  const stabs = sorted(
    Array.from({ length: 2 + Math.floor(r() * 4) }, () => pick([2, 3, 6, 7, 10, 11, 14, 15])),
  );
  return {
    ...base,
    names: [`${base.genre} Idea ${seed % 1000}`, `${base.genre} Idea ${seed % 1000}`],
    hats: hats.length ? hats : base.hats,
    bass,
    riff,
    chords,
    stabs,
  };
}
