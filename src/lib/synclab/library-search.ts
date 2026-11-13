/**
 * Type-to-find library search (Logic-style): one ranked list across instruments, synth presets,
 * drum kits, effects, effect presets, tracks, panels and help. Pure so ranking is tested.
 */
export type LibraryKind = "instrument" | "preset" | "kit" | "effect" | "effect-preset" | "track" | "panel" | "help";

export interface LibraryEntry {
  id: string;
  kind: LibraryKind;
  title: string;
  /** shown under/next to the title: category, device, track type */
  sub?: string;
  /** extra words that should find it but aren't shown */
  tags?: string;
}

export const LIBRARY_KINDS: { id: LibraryKind; label: string }[] = [
  { id: "instrument", label: "New tracks" },
  { id: "preset", label: "Synth sounds" },
  { id: "kit", label: "Drum kits" },
  { id: "effect", label: "Effects" },
  { id: "effect-preset", label: "Effect presets" },
  { id: "track", label: "Your tracks" },
  { id: "panel", label: "Tools & panels" },
  { id: "help", label: "Help" },
];

/** Words musicians type that don't literally appear in names. */
const SYNONYMS: Record<string, string[]> = {
  verb: ["reverb", "room", "hall", "plate", "space"],
  comp: ["compressor", "dynamics"],
  eq: ["equalizer", "equaliser", "eq"],
  keys: ["piano", "keys", "organ", "rhodes", "ep"],
  ep: ["electric piano", "rhodes", "tine", "reed"],
  bass: ["bass", "sub", "808"],
  drums: ["drum", "kit", "beat"],
  vox: ["vocal", "voice"],
  vocal: ["vocal", "voice", "vox"],
  dist: ["distortion", "drive", "overdrive", "fuzz"],
  echo: ["delay", "echo", "tape"],
  amp: ["amp", "amplifier", "cab"],
  arp: ["arp", "arpeggio", "sequence"],
  pad: ["pad", "string", "atmos"],
  lead: ["lead", "solo"],
  pluck: ["pluck", "harp", "koto"],
  gtr: ["guitar"],
  mic: ["mic", "microphone", "audio"],
};

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
const words = (s: string) => norm(s).split(/[^a-z0-9]+/).filter(Boolean);

/** letters of term appear in order in text (fuzzy typo-friendly fallback) */
function subsequence(term: string, text: string) {
  let i = 0;
  for (const ch of text) if (ch === term[i] && ++i === term.length) return true;
  return false;
}

function termScore(term: string, title: string, titleWords: string[], rest: string, restWords: string[]): number {
  if (title === term) return 100;
  if (title.startsWith(term)) return 80;
  if (titleWords.some((w) => w === term)) return 70;
  if (titleWords.some((w) => w.startsWith(term))) return 60;
  if (title.includes(term)) return 40;
  if (restWords.some((w) => w.startsWith(term))) return 25;
  if (rest.includes(term)) return 15;
  return 0;
}

/** typo-friendly fallback for the typed word only: letters in order, starting a title word ("grnd" → Grand) */
function fuzzy(term: string, titleWords: string[]) {
  if (term.length < 4) return 0;
  return titleWords.some((w, i) => w[0] === term[0] && subsequence(term, titleWords.slice(i).join(""))) ? 6 : 0;
}

/** 0 means no match. Every typed word must match the entry (directly or via a synonym). */
export function scoreEntry(entry: LibraryEntry, query: string): number {
  const terms = words(query);
  if (!terms.length) return 1;
  const title = norm(entry.title).replace(/[^a-z0-9]+/g, " ").trim();
  const titleWords = words(entry.title);
  const rest = norm(`${entry.sub ?? ""} ${entry.tags ?? ""}`);
  const restWords = words(rest);
  let total = 0;
  for (const term of terms) {
    let best = termScore(term, title, titleWords, rest, restWords) || fuzzy(term, titleWords);
    for (const alt of SYNONYMS[term] ?? []) best = Math.max(best, Math.round(termScore(alt, title, titleWords, rest, restWords) * 0.8));
    if (!best) return 0;
    total += best;
  }
  // shorter titles win ties ("Reverb" before "Reverb Shimmer Cathedral")
  return total + Math.max(0, 10 - title.length / 6);
}

export function searchLibrary(entries: LibraryEntry[], query: string, kind: LibraryKind | "all" = "all", limit = 150): LibraryEntry[] {
  const pool = kind === "all" ? entries : entries.filter((e) => e.kind === kind);
  if (!words(query).length) return pool.slice(0, limit);
  return pool
    .map((e, i) => ({ e, i, s: scoreEntry(e, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.e);
}

/** How many entries of each kind match, for the category column counts. */
export function countByKind(entries: LibraryEntry[], query: string): Record<LibraryKind, number> {
  const out = Object.fromEntries(LIBRARY_KINDS.map((k) => [k.id, 0])) as Record<LibraryKind, number>;
  const any = words(query).length > 0;
  for (const e of entries) if (!any || scoreEntry(e, query) > 0) out[e.kind]++;
  return out;
}
