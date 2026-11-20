/**
 * Writes a disc as audio-CD-ready files: one 44.1 kHz / 16-bit stereo WAV per track (padded to
 * whole CD sectors), a CUE sheet with CD-Text titles, and burning instructions, zipped together.
 * A web page can't reach the computer's disc drive, so the burn itself happens in the computer's
 * own burning app (or any app that reads CUE sheets).
 */
import type { Capture } from "./bounce";
import { encodeWavDepth } from "./export-formats";
import { CD_RATE, cdCueSheet, cdSafeName, cdTrackFileName, padForCd } from "./cd-audio";
import { zipStore, type ZipEntry } from "./zip-store";

/** Resample to 44.1 kHz (if needed) and pad to whole CD sectors. */
export async function toCdAudio(capture: Capture): Promise<Capture> {
  if (capture.sampleRate === CD_RATE) return padForCd(capture.left, capture.right);
  const frames = Math.max(1, Math.ceil((capture.left.length / capture.sampleRate) * CD_RATE));
  const ctx = new OfflineAudioContext(2, frames, CD_RATE);
  const buffer = ctx.createBuffer(2, capture.left.length, capture.sampleRate);
  buffer.copyToChannel(capture.left as Float32Array<ArrayBuffer>, 0);
  buffer.copyToChannel(capture.right as Float32Array<ArrayBuffer>, 1);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
  const out = await ctx.startRendering();
  return padForCd(out.getChannelData(0), out.getChannelData(1));
}

export const CD_README = (title: string) =>
  [
    `${title} — audio CD files from SYNCLAB`,
    "",
    "Every track is a CD-standard WAV (44.1 kHz, 16-bit stereo), numbered in disc order.",
    "Put a blank CD-R in your disc drive, then:",
    "",
    "WINDOWS",
    "  • Windows Media Player Legacy: open the Burn tab, choose Audio CD, drag the WAV files in",
    "    order, press Start burn.",
    "  • Or open the .cue file in a CUE-aware burner (ImgBurn, CDBurnerXP) to keep the",
    "    track titles (CD-Text) and gaps.",
    "",
    "MAC (built-in or USB disc drive)",
    "  • Music app: make a new playlist, add the WAV files in order, choose File > Burn",
    "    Playlist to Disc, pick Audio CD.",
    "",
    "LINUX",
    "  • Open the .cue file in Brasero or K3b, or run: cdrdao write --driver generic-mmc <file>.cue",
    "",
    "Use a CD-R (not CD-RW) for car and home players. Phones can't burn CDs — copy these files",
    "to a computer with a disc drive.",
    "",
  ].join("\r\n");

export interface DiscToBurn {
  title: string;
  artist: string;
  tracks: { title: string; capture: Capture }[];
}

export async function buildCdPackage(
  disc: DiscToBurn,
  progress: (done: number, total: number) => void = () => {},
): Promise<Blob> {
  const total = disc.tracks.length + 1;
  const entries: ZipEntry[] = [];
  const title = cdSafeName(disc.title, "SYNCLAB CD");
  for (let i = 0; i < disc.tracks.length; i++) {
    const track = disc.tracks[i]!;
    const audio = await toCdAudio(track.capture);
    const wav = new Uint8Array(await encodeWavDepth(audio, 16).arrayBuffer());
    entries.push({ name: `${title}/${cdTrackFileName(i, track.title)}`, data: wav });
    progress(i + 1, total);
  }
  const text = new TextEncoder();
  entries.push(
    { name: `${title}/${title}.cue`, data: text.encode(cdCueSheet(disc)) },
    { name: `${title}/HOW TO BURN.txt`, data: text.encode(CD_README(title)) },
  );
  progress(total, total);
  return new Blob([zipStore(entries) as BlobPart], { type: "application/zip" });
}
