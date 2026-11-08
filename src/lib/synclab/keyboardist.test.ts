import { describe, expect, it } from "vitest";
import {
  KEYS_GROUPS, KEYS_PROGRESSIONS, KEYS_SOUNDS, KEYS_STYLES, chordAt, chordName, defaultKeys, genKeysBar, keysBarOptions, keysBars, keysPatch,
  keysToNotes, parseChord, parseProgression, voiceChord,
} from "./keyboardist";
import { SYNTH_PRESETS } from "./presets";

describe("live keys styles", () => {
  it("covers every genre group, jazz and rock included, with unique styles", () => {
    expect(KEYS_GROUPS).toContain("Jazz");
    expect(KEYS_GROUPS).toContain("Rock");
    for (const g of KEYS_GROUPS) expect(KEYS_STYLES.filter((s) => s.group === g).length, g).toBeGreaterThanOrEqual(6);
    expect(new Set(KEYS_STYLES.map((s) => s.id)).size).toBe(KEYS_STYLES.length);
  });

  it("every chord in every progression can be read", () => {
    for (const p of [...KEYS_STYLES.map((s) => s.prog), ...KEYS_PROGRESSIONS.map((p) => p.prog)]) {
      for (const bar of p.split(/\s+/)) for (const tok of bar.split(",")) expect(parseChord(tok), `${p}: ${tok}`).not.toBeNull();
    }
  });

  it("every keyboard sound is a real factory preset, played without the arpeggiator", () => {
    for (const s of KEYS_SOUNDS) {
      expect(SYNTH_PRESETS.some((p) => p.name === s.preset), s.preset).toBe(true);
      const patch = keysPatch(s.id);
      expect(patch.arp.on).toBe(false);
      expect(patch.voiceMode).toBe("poly");
    }
  });
});

describe("chords", () => {
  it("reads roman numerals in the key", () => {
    expect(parseChord("ii7")).toMatchObject({ root: 2, intervals: [0, 3, 7, 10] });
    expect(parseChord("bVImaj7")).toMatchObject({ root: 8, intervals: [0, 4, 7, 11] });
    expect(parseChord("V7")).toMatchObject({ root: 7, intervals: [0, 4, 7, 10] });
    expect(parseChord("iiø")?.intervals).toEqual([0, 3, 6, 10]);
    expect(parseProgression("ii7,V7 Imaj7")).toHaveLength(2);
  });

  it("names chords in the chosen key and transposes when the key changes", () => {
    const s = defaultKeys("medium-swing");
    expect(chordName(s, chordAt(s, 0, 0))).toBe("Fmaj7");
    expect(chordName(s, chordAt(s, 2, 0))).toBe("Gm7");
    const inC = { ...s, tonic: 0 };
    expect(chordName(inC, chordAt(inC, 0, 0))).toBe("Cmaj7");
  });

  it("splits a bar with two chords half-way", () => {
    const s = defaultKeys("bebop");
    expect(chordAt(s, 4, 0)).not.toBe(chordAt(s, 4, 8));
    expect(chordAt(s, 4, 7)).toBe(chordAt(s, 4, 0));
  });

  it("a swapped-in progression replaces the style's chords", () => {
    const s = { ...defaultKeys("medium-swing"), tonic: 0, prog: "pop" };
    expect([0, 1, 2, 3].map((b) => chordName(s, chordAt(s, b, 0)))).toEqual(["C", "G", "Am", "F"]);
  });

  it("voices chords in the chosen range", () => {
    const s = defaultKeys("pop-piano");
    const c = chordAt(s, 0, 0);
    const avg = (r: number) => { const v = voiceChord({ ...s, range: r }, c, "triad"); return v.reduce((a, b) => a + b, 0) / v.length; };
    expect(avg(1)).toBeGreaterThan(avg(0));
    expect(avg(0)).toBeGreaterThan(avg(-1));
    // a C major triad holds C, E and G
    expect(voiceChord({ ...s, tonic: 0 }, c, "triad").map((p) => p % 12).sort((a, b) => a - b)).toEqual([0, 4, 7]);
  });
});

describe("live keys bars", () => {
  it("every style plays both hands inside the bar", () => {
    for (const st of KEYS_STYLES) {
      const notes = genKeysBar(defaultKeys(st.id), 1, 16);
      expect(notes.some((n) => n.hand === "R"), st.id).toBe(true);
      expect(notes.some((n) => n.hand === "L"), st.id).toBe(true);
      expect(notes.every((n) => n.step >= 0 && n.step < 16 && n.step + n.length <= 16.01 && n.vel > 0 && n.vel <= 1)).toBe(true);
    }
  });

  it("is the same every time for the same bar and settings (live = printed)", () => {
    const s = defaultKeys("neo-soul-keys");
    expect(genKeysBar(s, 3, 16, keysBarOptions(s, 3))).toEqual(genKeysBar(s, 3, 16, keysBarOptions(s, 3)));
  });

  it("plays more when complex", () => {
    for (const id of ["medium-swing", "rock-piano", "house-piano", "salsa-montuno"]) {
      const simple = genKeysBar({ ...defaultKeys(id), complexity: 0 }, 1).length;
      const complex = genKeysBar({ ...defaultKeys(id), complexity: 1 }, 1).length;
      expect(complex, id).toBeGreaterThan(simple);
    }
  });

  it("jazz walks the bass: one note a beat, root on beat one", () => {
    const s = { ...defaultKeys("medium-swing"), complexity: 0.4 };
    const left = genKeysBar(s, 1).filter((n) => n.hand === "L");
    expect(left.map((n) => n.step)).toEqual([0, 4, 8, 12]);
    const root = (s.tonic + chordAt(s, 1, 0).root) % 12;
    expect(left[0]!.pitch % 12).toBe(root);
  });

  it("leaves out a hand you switch off", () => {
    const s = { ...defaultKeys("pop-piano"), hands: { left: false, right: true } };
    expect(genKeysBar(s, 1).some((n) => n.hand === "L")).toBe(false);
  });

  it("runs at the end of phrases, lays out on a break, and lands a big chord after", () => {
    const s = { ...defaultKeys("rock-ballad"), fills: 0.6 };
    expect(keysBarOptions(s, 3).fill).toBe(true);
    expect(keysBarOptions(s, 4).hit).toBe(true);
    const fill = genKeysBar(s, 3, 16, { fill: true }).filter((n) => n.hand === "R" && n.step >= 8);
    const plain = genKeysBar(s, 3, 16, {}).filter((n) => n.hand === "R" && n.step >= 8);
    expect(fill).not.toEqual(plain);
    expect(genKeysBar(s, 5, 16, { silent: true })).toEqual([]);
    const hit = genKeysBar(s, 4, 16, { hit: true }).filter((n) => n.step === 0 && n.hand === "R");
    expect(hit.length).toBeGreaterThanOrEqual(3);
  });

  it("follows the song's time signature", () => {
    expect(genKeysBar(defaultKeys("pop-piano"), 0, 12).every((n) => n.step < 12)).toBe(true);
  });
});

describe("printing the keys to the timeline", () => {
  it("places bars at their song positions and keeps the part on those bars", () => {
    const s = defaultKeys("pop-piano");
    const { notes, steps } = keysToNotes(keysBars(s, 2, 4, 16), 16);
    expect(steps).toBe(6 * 16);
    expect(notes.every((n) => n.step >= 32 && n.step < 96)).toBe(true);
    expect(notes.every((n) => n.recordedEnd === 96)).toBe(true);
  });
});

describe("keys sounds leave headroom for full chords", () => {
  it("keeps every key quiet and undriven so stacked chords don't clip", () => {
    for (const s of KEYS_SOUNDS) {
      const p = keysPatch(s.id);
      const sum = p.oscillators.filter((o) => o.on).reduce((t, o) => t + o.level, 0);
      expect(sum, s.id).toBeLessThanOrEqual(0.45);
      expect(p.drive ?? 0, s.id).toBe(0);
      expect(p.fx.saturation ?? 0, s.id).toBe(0);
      expect(p.clean, s.id).toBe(true);
      // no per-key echo/flanger/phaser: dense styles would build hundreds of effect nodes and drop out
      expect(p.fx.delay, s.id).toBe(0);
      expect(p.fx.flanger ?? 0, s.id).toBe(0);
      expect(p.fx.phaser ?? 0, s.id).toBe(0);
    }
  });
});

describe("keys struck together stay balanced", () => {
  it("never stacks more than a full chord's worth of level on one beat, even at full complexity and loudness", () => {
    for (const st of KEYS_STYLES) {
      const s = { ...defaultKeys(st.id), complexity: 1, loudness: 1, fills: 1 };
      for (const { notes } of keysBars(s, 0, 8, 16)) {
        const at = new Map<number, number>();
        for (const n of notes) at.set(Math.round(n.step * 100), (at.get(Math.round(n.step * 100)) ?? 0) + n.vel);
        for (const sum of at.values()) expect(sum, st.id).toBeLessThanOrEqual(5.5);
      }
    }
  });
});
