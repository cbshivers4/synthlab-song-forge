/**
 * AI stem separation with Demucs (htdemucs) on Replicate, called through the
 * Lovable connector gateway. Server-only: keys never reach the browser.
 */
const GATEWAY = "https://connector-gateway.lovable.dev/replicate/v1";
const DEMUCS_VERSION = "ff5ad47d2685b27c0f820ee134c4394140804f08fa755cb20c846459faa4b337"; // ryan5453/demucs

export class StemSplitError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

function headers(json = true) {
  const lovable = process.env["LOVABLE_API_KEY"];
  const conn = process.env["REPLICATE_API_KEY"];
  if (!lovable || !conn) throw new StemSplitError("AI stem separation is not connected for this app.", 500);
  const h: Record<string, string> = { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": conn };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

async function fail(res: Response, what: string): Promise<never> {
  const body = await res.text().catch(() => "");
  console.error(`Replicate ${what} failed [${res.status}]: ${body}`);
  if (res.status === 402) throw new StemSplitError("The Replicate account has no credit. Add billing at replicate.com/account/billing, then try again.", 402);
  if (res.status === 429) throw new StemSplitError("The stem separator is busy. Wait a minute, then try again.", 429);
  let detail = "";
  try { detail = (JSON.parse(body) as { detail?: string }).detail ?? ""; } catch { /* not json */ }
  throw new StemSplitError(`Stem separation ${what} failed (${res.status})${detail ? `: ${detail}` : ""}.`, res.status);
}

export async function startStemSplit(bytes: Uint8Array, fileName: string, mime: string) {
  const form = new FormData();
  form.append("content", new Blob([bytes], { type: mime || "application/octet-stream" }), fileName || "song");
  const up = await fetch(`${GATEWAY}/files`, { method: "POST", headers: headers(false), body: form });
  if (!up.ok) await fail(up, "upload");
  const file = (await up.json()) as { urls?: { get?: string } };
  const audio = file.urls?.get;
  if (!audio) throw new StemSplitError("Upload to the stem separator returned no file.", 500);
  const res = await fetch(`${GATEWAY}/predictions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ version: DEMUCS_VERSION, input: { audio, format: "mp3", shifts: 1, split_overlap: 0.25 } }),
  });
  if (!res.ok) await fail(res, "start");
  const pred = (await res.json()) as { id: string };
  return pred.id;
}

export type StemSplitStatus =
  | { state: "running" }
  | { state: "done"; stems: Record<string, string> }
  | { state: "failed"; error: string };

export async function checkStemSplit(id: string): Promise<StemSplitStatus> {
  const res = await fetch(`${GATEWAY}/predictions/${encodeURIComponent(id)}`, { headers: headers() });
  if (!res.ok) await fail(res, "check");
  const p = (await res.json()) as { status: string; output?: unknown; error?: string | null };
  if (p.status === "succeeded") {
    const out = p.output && typeof p.output === "object" ? (p.output as Record<string, unknown>) : {};
    const stems: Record<string, string> = {};
    for (const [k, v] of Object.entries(out)) if (typeof v === "string") stems[k] = v;
    return { state: "done", stems };
  }
  if (p.status === "failed" || p.status === "canceled") return { state: "failed", error: p.error || "The stem separator could not process this song." };
  return { state: "running" };
}

const ALLOWED = /^https:\/\/(?:[a-z0-9-]+\.)?replicate\.delivery\/|^https:\/\/storage\.googleapis\.com\/replicate-files\//;

/** Downloads one finished stem (only Replicate output hosts) and returns it as base64 MP3. */
export async function fetchStem(url: string) {
  if (!ALLOWED.test(url)) throw new StemSplitError("That stem link is not from the stem separator.", 400);
  const res = await fetch(url);
  if (!res.ok) throw new StemSplitError(`Couldn't download the stem (${res.status}).`, res.status);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
