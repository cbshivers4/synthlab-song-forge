import type { TrackKind } from "./types";

export interface TemplateTrack {
  kind: TrackKind;
  name: string;
  preset?: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  bpm: number;
  key: string;
  tracks: TemplateTrack[];
}

export const KEYS = [
  "C Major",
  "A Minor",
  "F Minor",
  "G Minor",
  "D Minor",
  "E Minor",
  "C Minor",
  "A# Minor",
  "F# Minor",
  "D Major",
  "G Major",
  "F Major",
];

export const TIME_SIGS = ["4/4", "3/4", "6/8", "7/8", "5/4"];

export const TEMPLATES: ProjectTemplate[] = [
  {
    id: "empty",
    name: "Empty Studio",
    description: "A blank timeline. Build it your own way.",
    bpm: 128,
    key: "A Minor",
    tracks: [],
  },
  {
    id: "detroit-techno",
    name: "Detroit Techno",
    description: "Kick, drums, percussion, bass, two synths, pad, FX and vocal.",
    bpm: 132,
    key: "F Minor",
    tracks: [
      { kind: "drum", name: "KICK" },
      { kind: "drum", name: "DRUMS" },
      { kind: "drum", name: "PERCUSSION" },
      { kind: "instrument", name: "BASS", preset: "Sub Bass" },
      { kind: "instrument", name: "SYNTH 1", preset: "Cybotron Lead" },
      { kind: "instrument", name: "SYNTH 2", preset: "Metro Pluck" },
      { kind: "instrument", name: "PAD", preset: "Warehouse Pad" },
      { kind: "audio", name: "FX" },
      { kind: "ai-vocal", name: "VOCAL", preset: "Vocoder Bot" },
    ],
  },
  {
    id: "detroit-electro",
    name: "Detroit Electro",
    description: "808 drums, electro bass, lead, vocoder vocal.",
    bpm: 126,
    key: "C Minor",
    tracks: [
      { kind: "drum", name: "808 DRUMS" },
      { kind: "instrument", name: "ELECTRO BASS", preset: "Sub Bass" },
      { kind: "instrument", name: "LEAD", preset: "Cybotron Lead" },
      { kind: "ai-vocal", name: "VOCODER", preset: "Vocoder Bot" },
    ],
  },
  {
    id: "ghetto-tech",
    name: "Ghetto Tech",
    description: "Fast drums, chopped vocal, bass.",
    bpm: 150,
    key: "G Minor",
    tracks: [
      { kind: "drum", name: "DRUMS" },
      { kind: "sampler", name: "CHOPS", preset: "Metro Pluck" },
      { kind: "instrument", name: "BASS", preset: "Sub Bass" },
      { kind: "audio", name: "VOCAL" },
    ],
  },
  {
    id: "house",
    name: "House",
    description: "Four-to-the-floor kit, bass, keys, pad, vocal.",
    bpm: 124,
    key: "A Minor",
    tracks: [
      { kind: "drum", name: "DRUMS" },
      { kind: "instrument", name: "BASS", preset: "Sub Bass" },
      { kind: "instrument", name: "KEYS", preset: "Deep Keys" },
      { kind: "instrument", name: "PAD", preset: "Warehouse Pad" },
      { kind: "audio", name: "VOCAL" },
    ],
  },
  {
    id: "deep-house",
    name: "Deep House",
    description: "Warm chords, soft drums, sub bass.",
    bpm: 120,
    key: "F Minor",
    tracks: [
      { kind: "drum", name: "DRUMS" },
      { kind: "instrument", name: "CHORDS", preset: "Deep Keys" },
      { kind: "instrument", name: "SUB", preset: "Sub Bass" },
      { kind: "audio", name: "VOCAL" },
    ],
  },
  {
    id: "hip-hop",
    name: "Hip-Hop",
    description: "Boom bap kit, sampler, bass, lead and ad-lib vocals.",
    bpm: 90,
    key: "D Minor",
    tracks: [
      { kind: "drum", name: "DRUMS" },
      { kind: "sampler", name: "SAMPLE", preset: "Metro Pluck" },
      { kind: "instrument", name: "808", preset: "Sub Bass" },
      { kind: "audio", name: "LEAD VOCAL" },
      { kind: "audio", name: "AD LIBS" },
    ],
  },
  {
    id: "trap",
    name: "Trap",
    description: "Hats, 808, lead, vocal stack.",
    bpm: 145,
    key: "C Minor",
    tracks: [
      { kind: "drum", name: "DRUMS" },
      { kind: "instrument", name: "808", preset: "Sub Bass" },
      { kind: "instrument", name: "LEAD", preset: "Metro Pluck" },
      { kind: "audio", name: "VOCAL" },
    ],
  },
  {
    id: "rnb",
    name: "R&B",
    description: "Soft kit, keys, bass, lead and harmony vocals.",
    bpm: 82,
    key: "E Minor",
    tracks: [
      { kind: "drum", name: "DRUMS" },
      { kind: "instrument", name: "KEYS", preset: "Deep Keys" },
      { kind: "instrument", name: "BASS", preset: "Sub Bass" },
      { kind: "audio", name: "LEAD VOCAL" },
      { kind: "audio", name: "HARMONY" },
    ],
  },
  {
    id: "pop",
    name: "Pop",
    description: "Drums, bass, keys, synth, lead vocal, backing vocal.",
    bpm: 104,
    key: "C Major",
    tracks: [
      { kind: "drum", name: "DRUMS" },
      { kind: "instrument", name: "BASS", preset: "Sub Bass" },
      { kind: "instrument", name: "KEYS", preset: "Deep Keys" },
      { kind: "instrument", name: "SYNTH", preset: "Cybotron Lead" },
      { kind: "audio", name: "LEAD VOCAL" },
      { kind: "audio", name: "BACKING VOCAL" },
    ],
  },
  {
    id: "rock",
    name: "Rock",
    description: "Drums plus guitar, bass and vocal inputs.",
    bpm: 112,
    key: "E Minor",
    tracks: [
      { kind: "drum", name: "DRUMS" },
      { kind: "audio", name: "BASS GUITAR" },
      { kind: "audio", name: "GUITAR L" },
      { kind: "audio", name: "GUITAR R" },
      { kind: "audio", name: "LEAD VOCAL" },
    ],
  },
  {
    id: "ambient",
    name: "Ambient",
    description: "Pads, texture and slow movement.",
    bpm: 72,
    key: "A Minor",
    tracks: [
      { kind: "instrument", name: "PAD 1", preset: "Warehouse Pad" },
      { kind: "instrument", name: "PAD 2", preset: "Warehouse Pad" },
      { kind: "audio", name: "TEXTURE" },
    ],
  },
  {
    id: "podcast",
    name: "Podcast",
    description: "Two mic channels, music bed and intro.",
    bpm: 100,
    key: "C Major",
    tracks: [
      { kind: "audio", name: "HOST MIC" },
      { kind: "audio", name: "GUEST MIC" },
      { kind: "audio", name: "MUSIC BED" },
      { kind: "audio", name: "INTRO" },
    ],
  },
  {
    id: "vocal",
    name: "Vocal Recording",
    description: "Instrumental, lead, backing, harmony, AI vocal, vocoder and FX.",
    bpm: 120,
    key: "A Minor",
    tracks: [
      { kind: "audio", name: "INSTRUMENTAL" },
      { kind: "audio", name: "LEAD VOCAL" },
      { kind: "audio", name: "BACKING VOCAL" },
      { kind: "audio", name: "HARMONY" },
      { kind: "ai-vocal", name: "AI VOCAL", preset: "Vocoder Bot" },
      { kind: "ai-vocal", name: "VOCODER", preset: "Vocoder Bot" },
      { kind: "audio", name: "FX" },
    ],
  },
];

export function templateById(id: string) {
  return TEMPLATES.find((x) => x.id === id);
}
