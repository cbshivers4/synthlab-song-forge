import type { MidiNote } from "./types";
import { uid } from "./presets";

/** One parsed MIDI track: a name and its notes placed on SYNCLAB's 16th-note grid. */
export interface ParsedMidiTrack {
  name: string;
  notes: MidiNote[];
}

interface Reader {
  view: DataView;
  pos: number;
}

const u8 = (r: Reader) => r.view.getUint8(r.pos++);
const u16 = (r: Reader) => {
  const v = r.view.getUint16(r.pos);
  r.pos += 2;
  return v;
};
const u32 = (r: Reader) => {
  const v = r.view.getUint32(r.pos);
  r.pos += 4;
  return v;
};

/** Variable-length quantity used for MIDI delta times. */
function varLen(r: Reader) {
  let value = 0;
  for (let i = 0; i < 4; i++) {
    const b = u8(r);
    value = (value << 7) | (b & 0x7f);
    if ((b & 0x80) === 0) break;
  }
  return value;
}

function text(r: Reader, len: number) {
  let out = "";
  for (let i = 0; i < len; i++) out += String.fromCharCode(u8(r));
  return out;
}

/**
 * Parses a Standard MIDI File into tracks of notes.
 * Tick positions become steps where 1 step = a 16th note, matching the timeline grid.
 */
export function parseMidiFile(buffer: ArrayBuffer): ParsedMidiTrack[] {
  const r: Reader = { view: new DataView(buffer), pos: 0 };
  if (text(r, 4) !== "MThd") throw new Error("That file is not a MIDI file.");
  const headerLen = u32(r);
  u16(r); // format
  const trackCount = u16(r);
  const division = u16(r);
  r.pos = 8 + headerLen;
  if (division & 0x8000) throw new Error("SMPTE-timed MIDI files are not supported.");
  const ticksPerStep = Math.max(1, division / 4);

  const tracks: ParsedMidiTrack[] = [];

  for (let t = 0; t < trackCount; t++) {
    if (r.pos + 8 > r.view.byteLength) break;
    const id = text(r, 4);
    const len = u32(r);
    const end = r.pos + len;
    if (id !== "MTrk") {
      r.pos = end;
      continue;
    }

    let name = `MIDI ${t + 1}`;
    let tick = 0;
    let status = 0;
    const open = new Map<number, { tick: number; velocity: number }>();
    const notes: MidiNote[] = [];

    while (r.pos < end) {
      tick += varLen(r);
      let byte = u8(r);
      if (byte < 0x80) {
        r.pos--; // running status
        byte = status;
      } else {
        status = byte;
      }
      const type = byte & 0xf0;

      if (byte === 0xff) {
        const meta = u8(r);
        const mlen = varLen(r);
        if (meta === 0x03) name = text(r, mlen).trim() || name;
        else r.pos += mlen;
        continue;
      }
      if (byte === 0xf0 || byte === 0xf7) {
        r.pos += varLen(r);
        continue;
      }

      if (type === 0x90 || type === 0x80) {
        const pitch = u8(r);
        const velocity = u8(r);
        if (type === 0x90 && velocity > 0) {
          open.set(pitch, { tick, velocity: velocity / 127 });
        } else {
          const started = open.get(pitch);
          if (started) {
            open.delete(pitch);
            const step = started.tick / ticksPerStep;
            const length = Math.max(0.25, (tick - started.tick) / ticksPerStep);
            notes.push({
              id: uid(),
              step: Math.round(step * 4) / 4,
              length: Math.round(length * 4) / 4,
              pitch,
              velocity: started.velocity,
            });
          }
        }
        continue;
      }

      // channel messages with two data bytes, or one for program/aftertouch
      if (type === 0xa0 || type === 0xb0 || type === 0xe0) r.pos += 2;
      else if (type === 0xc0 || type === 0xd0) r.pos += 1;
      else r.pos = end;
    }

    r.pos = end;
    if (notes.length > 0) tracks.push({ name: name.toUpperCase().slice(0, 16), notes });
  }

  if (tracks.length === 0) throw new Error("No playable notes were found in that MIDI file.");
  return tracks;
}
