/**
 * Reads the song title, artist and tempo written inside a music file's tags, for the DJ track list.
 * Pure (no browser APIs, tested): ID3v2 (MP3: TIT2/TPE1/TBPM, v2.2 TT2/TP1/TBP), ID3v1 (the last
 * 128 bytes), FLAC Vorbis comments and MP4/M4A "ilst" atoms (©nam, ©ART, tmpo).
 * Damaged or missing tags simply give empty fields.
 */
export interface TrackTags { title: string | null; artist: string | null; bpm: number | null }

const EMPTY = (): TrackTags => ({ title: null, artist: null, bpm: null });

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, Math.min(to, b.length)));
const u32 = (b: Uint8Array, i: number) => ((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!;
const u32le = (b: Uint8Array, i: number) => (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) >>> 0;
const syncsafe = (b: Uint8Array, i: number) => (b[i]! << 21) | (b[i + 1]! << 14) | (b[i + 2]! << 7) | b[i + 3]!;

/** Bytes needed to read a whole ID3v2 tag at the start of a file (0 when there isn't one). */
export function id3Size(head: Uint8Array) {
  if (head.length < 10 || ascii(head, 0, 3) !== "ID3") return 0;
  return 10 + syncsafe(head, 6);
}

const clean = (s: string | null | undefined) => {
  const v = (s ?? "").split("\u0000")[0]!.replace(/\s+/g, " ").trim();
  return v ? v.slice(0, 120) : null;
};

/** "128", "127.5", "128 BPM" → 128 / 127.5; anything outside 40–250 is ignored. */
export function tagBpm(raw: string | number | null | undefined) {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? "").replace(",", "."));
  return Number.isFinite(n) && n >= 40 && n <= 250 ? Math.round(n * 100) / 100 : null;
}

function decodeText(bytes: Uint8Array, enc: number) {
  try {
    if (enc === 1 || enc === 2) {
      let b = bytes;
      let le = false;
      if (b[0] === 0xff && b[1] === 0xfe) { le = true; b = b.subarray(2); }
      else if (b[0] === 0xfe && b[1] === 0xff) b = b.subarray(2);
      else if (enc === 1) le = true;
      return new TextDecoder(le ? "utf-16le" : "utf-16be").decode(b);
    }
    if (enc === 3) return new TextDecoder("utf-8").decode(bytes);
    return new TextDecoder("latin1").decode(bytes);
  } catch { return ""; }
}

function id3v2(b: Uint8Array, out: TrackTags) {
  const ver = b[3]!;
  const flags = b[5]!;
  let body = b.subarray(10, Math.min(b.length, id3Size(b)));
  if (flags & 0x80 && ver < 4) {
    const o: number[] = [];
    for (let i = 0; i < body.length; i++) { o.push(body[i]!); if (body[i] === 0xff && body[i + 1] === 0) i++; }
    body = Uint8Array.from(o);
  }
  let i = 0;
  if (flags & 0x40 && ver >= 3) i = ver === 4 ? syncsafe(body, 0) : u32(body, 0) + 4;
  const head = ver === 2 ? 6 : 10;
  const want: Record<string, keyof TrackTags> = ver === 2 ? { TT2: "title", TP1: "artist", TBP: "bpm" } : { TIT2: "title", TPE1: "artist", TBPM: "bpm" };
  while (i + head <= body.length) {
    const id = ascii(body, i, i + (ver === 2 ? 3 : 4));
    if (!/^[A-Z0-9]{3,4}$/.test(id)) break;
    const len = ver === 2 ? (body[i + 3]! << 16) | (body[i + 4]! << 8) | body[i + 5]! : ver === 4 ? syncsafe(body, i + 4) : u32(body, i + 4);
    if (len <= 0) break;
    const start = i + head;
    const field = want[id];
    if (field) {
      const frame = body.subarray(start, Math.min(body.length, start + len));
      const text = clean(decodeText(frame.subarray(1), frame[0]!));
      if (field === "bpm") out.bpm ??= tagBpm(text);
      else out[field] ??= text;
    }
    i = start + len;
  }
}

function id3v1(tail: Uint8Array, out: TrackTags) {
  if (tail.length < 128) return;
  const t = tail.subarray(tail.length - 128);
  if (ascii(t, 0, 3) !== "TAG") return;
  const latin = (from: number, to: number) => clean(new TextDecoder("latin1").decode(t.subarray(from, to)));
  out.title ??= latin(3, 33);
  out.artist ??= latin(33, 63);
}

function flac(b: Uint8Array, out: TrackTags) {
  let i = 4;
  while (i + 4 <= b.length) {
    const head = b[i]!;
    const len = (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!;
    const s = i + 4;
    if ((head & 0x7f) === 4) {
      let j = s + 4 + u32le(b, s);
      const count = u32le(b, j); j += 4;
      for (let n = 0; n < count && j + 4 <= s + len; n++) {
        const l = u32le(b, j); j += 4;
        const entry = new TextDecoder("utf-8").decode(b.subarray(j, j + l)); j += l;
        const eq = entry.indexOf("=");
        if (eq < 0) continue;
        const key = entry.slice(0, eq).toUpperCase(), val = entry.slice(eq + 1);
        if (key === "TITLE") out.title ??= clean(val);
        else if (key === "ARTIST") out.artist ??= clean(val);
        else if (key === "BPM" || key === "TEMPO") out.bpm ??= tagBpm(val);
      }
      return;
    }
    if (head & 0x80) return;
    i = s + len;
  }
}

function findBox(b: Uint8Array, from: number, to: number, name: string): { start: number; end: number } | null {
  let i = from;
  while (i + 8 <= to) {
    let size = u32(b, i);
    let head = 8;
    if (size === 1) { size = u32(b, i + 8) * 2 ** 32 + u32(b, i + 12); head = 16; }
    else if (size === 0) size = to - i;
    if (size < head) return null;
    if (ascii(b, i + 4, i + 8) === name) return { start: i + head, end: Math.min(to, i + size) };
    i += size;
  }
  return null;
}

/** MP4/M4A tags, from bytes holding the top-level "moov" box (on its own, or a whole file). */
export function mp4Tags(b: Uint8Array): TrackTags {
  const out = EMPTY();
  try {
    let from = 0, to = b.length;
    for (const name of ["moov", "udta", "meta", "ilst"]) {
      const box = findBox(b, from, to, name);
      if (!box) return out;
      from = box.start + (name === "meta" ? 4 : 0);
      to = box.end;
    }
    const data = (atom: string) => {
      const a = findBox(b, from, to, atom);
      const d = a && findBox(b, a.start, a.end, "data");
      return d ? b.subarray(d.start + 8, d.end) : null;
    };
    const text = (atom: string) => { const d = data(atom); return d ? clean(new TextDecoder("utf-8").decode(d)) : null; };
    out.title = text("\u00a9nam");
    out.artist = text("\u00a9ART") ?? text("aART");
    const t = data("tmpo");
    if (t && t.length >= 2) out.bpm = tagBpm((t[0]! << 8) | t[1]!);
  } catch { /* damaged tag */ }
  return out;
}

/**
 * Tags from the start of a file (`head`, ideally the whole ID3v2/FLAC header) and, for ID3v1, its
 * last 128 bytes (`tail`).
 */
export function readTrackTags(head: Uint8Array, tail?: Uint8Array): TrackTags {
  const out = EMPTY();
  try {
    if (ascii(head, 0, 3) === "ID3") id3v2(head, out);
    else if (ascii(head, 0, 4) === "fLaC") flac(head, out);
    else if (ascii(head, 4, 8) === "ftyp") return mp4Tags(head);
  } catch { /* damaged tag: keep what we have */ }
  try { if (tail) id3v1(tail, out); } catch { /* no v1 tag */ }
  return out;
}

/**
 * Untagged files are often named "Artist - Title": split that so the list still shows an artist.
 * Names without a " - " keep the whole name as the title.
 */
export function splitArtistTitle(name: string): { artist: string | null; title: string } {
  const m = /^(.+?)\s+[-–—]\s+(.+)$/.exec(name.trim());
  if (!m || /^\d+$/.test(m[1]!.trim())) return { artist: null, title: name.trim() };
  return { artist: m[1]!.trim(), title: m[2]!.trim() };
}
