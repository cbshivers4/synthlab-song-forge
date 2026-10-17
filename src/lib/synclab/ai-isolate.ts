/** Client helper: isolate Demucs parts (vocals/drums/bass/other) from an audio blob via the AI stem server functions. */
import { checkStemSplitFn, fetchStemFn, startStemSplitFn } from "@/utils/stem-split.functions";

export type DemucsPart = "vocals" | "drums" | "bass" | "other";

const toBase64 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

/** Maps an instrument name to the one Demucs part that holds it. */
export function partForInstrument(name: string): DemucsPart {
  if (/drum|percussion|808 kit|beat/i.test(name)) return "drums";
  if (/bass|808/i.test(name)) return "bass";
  if (/vocal|voice|choir|sing/i.test(name)) return "vocals";
  return "other";
}

/** Returns the isolated part as an MP3 blob. Throws with the service message (e.g. no credit). */
export async function isolatePart(blob: Blob, part: DemucsPart, isCancelled?: () => boolean): Promise<Blob> {
  const started = await startStemSplitFn({ data: { audio: await toBase64(blob), name: "clip.mp3", mime: blob.type || "audio/mpeg" } });
  if (!started.ok) throw new Error(started.error);
  for (;;) {
    await new Promise((r) => setTimeout(r, 4000));
    if (isCancelled?.()) throw new Error("Stopped");
    const res = await checkStemSplitFn({ data: { id: started.id } });
    if (!res.ok) throw new Error(res.error);
    if (res.status.state === "failed") throw new Error(res.status.error);
    if (res.status.state === "done") {
      const url = res.status.stems[part];
      if (!url) throw new Error("The separator returned no " + part + " part.");
      const got = await fetchStemFn({ data: { url } });
      if (!got.ok) throw new Error(got.error);
      const bin = atob(got.mp3);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return new Blob([out], { type: "audio/mpeg" });
    }
  }
}
