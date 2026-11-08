/**
 * Finds the cover picture embedded in a music file, so the DJ record label can show it.
 * Reads ID3v2 (MP3: APIC / v2.2 PIC), FLAC PICTURE blocks and MP4/M4A "covr" atoms.
 * Returns a copy of the image bytes (the source buffer may be handed to the decoder after).
 * Front covers (picture type 3) win over other pictures.
 */
export interface CoverArt { mime: string; data: Uint8Array }

export function findCoverArt(bytes: Uint8Array): CoverArt | null {
  try {
    if (bytes.length < 12) return null;
    if (ascii(bytes, 0, 3) === "ID3") return id3(bytes);
    if (ascii(bytes, 0, 4) === "fLaC") return flac(bytes);
    if (ascii(bytes, 4, 8) === "ftyp") return mp4(bytes);
  } catch { /* damaged tag: no picture */ }
  return null;
}

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, Math.min(to, b.length)));
const u32 = (b: Uint8Array, i: number) => ((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!;
const syncsafe = (b: Uint8Array, i: number) => (b[i]! << 21) | (b[i + 1]! << 14) | (b[i + 2]! << 7) | b[i + 3]!;

/** Recognise the image from its first bytes when the tag's MIME type is missing or vague. */
export function sniffImage(data: Uint8Array, hint = ""): string | null {
  if (data[0] === 0xff && data[1] === 0xd8) return "image/jpeg";
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return "image/png";
  if (ascii(data, 0, 4) === "GIF8") return "image/gif";
  if (ascii(data, 0, 4) === "RIFF" && ascii(data, 8, 12) === "WEBP") return "image/webp";
  const h = hint.toLowerCase();
  if (h.startsWith("image/")) return h;
  if (h === "jpg" || h === "jpeg") return "image/jpeg";
  if (h === "png") return "image/png";
  return null;
}

function pick(found: { type: number; art: CoverArt }[]): CoverArt | null {
  if (!found.length) return null;
  return (found.find((f) => f.type === 3) ?? found[0]!).art;
}

function art(data: Uint8Array, hint: string): CoverArt | null {
  if (data.length < 8) return null;
  const mime = sniffImage(data, hint);
  return mime ? { mime, data: data.slice() } : null;
}

function id3(b: Uint8Array): CoverArt | null {
  const ver = b[3]!;
  const flags = b[5]!;
  const size = syncsafe(b, 6);
  let body = b.subarray(10, Math.min(b.length, 10 + size));
  // Whole-tag unsynchronisation (v2.2/v2.3): FF 00 → FF
  if (flags & 0x80 && ver < 4) {
    const out: number[] = [];
    for (let i = 0; i < body.length; i++) { out.push(body[i]!); if (body[i] === 0xff && body[i + 1] === 0) i++; }
    body = Uint8Array.from(out);
  }
  let i = 0;
  if (flags & 0x40 && ver >= 3) i = ver === 4 ? syncsafe(body, 0) : u32(body, 0) + 4;
  const found: { type: number; art: CoverArt }[] = [];
  const head = ver === 2 ? 6 : 10;
  while (i + head <= body.length) {
    const id = ascii(body, i, i + (ver === 2 ? 3 : 4));
    if (!/^[A-Z0-9]{3,4}$/.test(id)) break;
    const len = ver === 2 ? (body[i + 3]! << 16) | (body[i + 4]! << 8) | body[i + 5]! : ver === 4 ? syncsafe(body, i + 4) : u32(body, i + 4);
    const start = i + head;
    const frame = body.subarray(start, Math.min(body.length, start + len));
    if (id === "APIC" || id === "PIC") {
      const enc = frame[0]!;
      let j = 1;
      let hint: string;
      if (id === "PIC") { hint = ascii(frame, 1, 4); j = 4; }
      else { const end = frame.indexOf(0, 1); hint = ascii(frame, 1, end); j = end + 1; }
      const type = frame[j]!; j++;
      // description: terminated by 00 (Latin-1/UTF-8) or 00 00 on an even boundary (UTF-16)
      if (enc === 1 || enc === 2) { while (j + 1 < frame.length && !(frame[j] === 0 && frame[j + 1] === 0)) j += 2; j += 2; }
      else { while (j < frame.length && frame[j] !== 0) j++; j++; }
      const a = art(frame.subarray(j), hint);
      if (a) found.push({ type, art: a });
    }
    if (len <= 0) break;
    i = start + len;
  }
  return pick(found);
}

function flac(b: Uint8Array): CoverArt | null {
  let i = 4;
  const found: { type: number; art: CoverArt }[] = [];
  while (i + 4 <= b.length) {
    const head = b[i]!;
    const kind = head & 0x7f;
    const len = (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!;
    const s = i + 4;
    if (kind === 6) {
      const type = u32(b, s);
      const mimeLen = u32(b, s + 4);
      const hint = ascii(b, s + 8, s + 8 + mimeLen);
      const descLen = u32(b, s + 8 + mimeLen);
      const d = s + 12 + mimeLen + descLen + 16;
      const dataLen = u32(b, d);
      const a = art(b.subarray(d + 4, d + 4 + dataLen), hint);
      if (a) found.push({ type, art: a });
    }
    if (head & 0x80) break;
    i = s + len;
  }
  return pick(found);
}

function mp4(b: Uint8Array): CoverArt | null {
  // moov > udta > meta (full box) > ilst > covr > data
  const path = ["moov", "udta", "meta", "ilst", "covr", "data"];
  let from = 0, to = b.length;
  for (const name of path) {
    const box = findBox(b, from, to, name);
    if (!box) return null;
    from = box.start + (name === "meta" ? 4 : 0);
    to = box.end;
  }
  // data box: 4 bytes type, 4 bytes locale, then the image
  const kind = u32(b, from);
  return art(b.subarray(from + 8, to), kind === 14 ? "png" : kind === 13 ? "jpg" : "");
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
