import { useEffect, useRef, useState } from "react";
import {
  ArrowRightLeft,
  Download,
  FileAudio,
  FolderOpen,
  LoaderCircle,
  Share2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { WaveformView } from "./WaveformView";
import { SkinControls, skinBackground, useImageDrop } from "@/components/studio/SkinControls";
import { useSkin } from "@/lib/synclab/skins";
import {
  CONVERSION_FORMATS,
  conversionFilename,
  conversionSupported,
  convertAudio,
  type ConversionFormat,
} from "@/lib/synclab/audio-converter";
import { canShareFile, downloadBlob, shareFile, type Capture } from "@/lib/synclab/bounce";
import { retainMediaInBackground } from "@/lib/synclab/media-library";
import { decodeAudioFile } from "@/lib/synclab/aiff-decode";

type Source = { name: string; capture: Capture; peaks: number[]; duration: number };
export function AudioConverter() {
  const skin = useSkin("converter");
  const skinDrop = useImageDrop("converter");
  const skinned = !!(skin.image || skin.color);
  const [source, setSource] = useState<Source | null>(null);
  const [format, setFormat] = useState<ConversionFormat>("wav");
  const [rate, setRate] = useState(44100);
  const [kbps, setKbps] = useState(192);
  const [mono, setMono] = useState(false);
  const [busy, setBusy] = useState<"loading" | "converting" | null>(null);
  const [issue, setIssue] = useState("");
  const [result, setResult] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
    },
    [],
  );
  const cancel = () => {
    generation.current++;
    controller.current?.abort();
    setBusy(null);
  };
  const load = async (file?: File) => {
    if (!file || busy) return;
    const token = ++generation.current;
    setBusy("loading");
    setIssue("");
    setResult(null);
    setSource(null);
    let ctx: AudioContext | undefined;
    try {
      ctx = new AudioContext();
      const decoded = await decodeAudioFile(ctx, await file.arrayBuffer());
      if (generation.current !== token) return;
      const left = decoded.getChannelData(0).slice();
      const right = decoded.getChannelData(Math.min(1, decoded.numberOfChannels - 1)).slice();
      const peaks = Array.from({ length: Math.min(1024, left.length) }, (_, i) => {
        let peak = 0;
        const size = Math.ceil(left.length / 1024);
        for (let j = i * size; j < Math.min(left.length, (i + 1) * size); j++)
          peak = Math.max(peak, Math.abs(left[j] ?? 0), Math.abs(right[j] ?? 0));
        return peak;
      });
      setSource({
        name: file.name,
        capture: { left, right, sampleRate: decoded.sampleRate },
        peaks,
        duration: decoded.duration,
      });
      retainMediaInBackground(file, file.name);
    } catch (error) {
      // AIFF reader errors already say exactly what's wrong (e.g. an unsupported compression).
      const reason =
        error instanceof Error && /AIFF|no audio/.test(error.message)
          ? error.message
          : "Your device could not read this audio file. WAV, MP3, AIFF and FLAC open everywhere; M4A/AAC and Ogg depend on your browser.";
      if (generation.current === token) setIssue(reason);
    } finally {
      if (ctx) await ctx.close();
      if (generation.current === token) setBusy(null);
    }
  };
  const convert = async () => {
    if (!source || busy) return;
    const token = ++generation.current;
    const abort = new AbortController();
    controller.current = abort;
    setBusy("converting");
    setIssue("");
    setResult(null);
    try {
      const blob = await convertAudio(source.capture, format, rate, kbps, mono, abort.signal);
      if (token !== generation.current) return;
      const file = new File([blob], conversionFilename(source.name, format, blob.type), {
        type: blob.type,
      });
      setResult(file);
      retainMediaInBackground(file, file.name, "Exports");
    } catch (error) {
      if (token === generation.current && !abort.signal.aborted)
        setIssue(error instanceof Error ? error.message : "Conversion failed.");
    } finally {
      if (token === generation.current) setBusy(null);
    }
  };
  const compressed = ["mp3", "m4a", "ogg", "opus"].includes(format);
  return (
    <div
      className={`mx-auto w-full max-w-3xl space-y-4${skinned ? " studio-wallpaper rounded-md p-3" : ""}`}
      data-skin-panel="converter"
      style={skinBackground(skin)}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        // A dropped picture becomes the panel wallpaper; anything else is the audio to convert.
        const file = e.dataTransfer.files[0];
        if (file && /^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) {
          void skinDrop.onDrop(e);
          return;
        }
        e.preventDefault();
        void load(file);
      }}
    >
      <SkinControls skinKey="converter" image />
      <input
        ref={input}
        type="file"
        accept="audio/*,.wav,.mp3,.m4a,.aac,.aiff,.aif,.flac,.ogg,.opus,.webm"
        aria-label="Load audio to convert"
        className="hidden"
        onChange={(e) => {
          void load(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap items-center gap-3 border-b border-border pb-3">
        <FileAudio className="size-8 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h3 className="break-all font-display text-base font-semibold">
            {source?.name ?? "Audio Converter"}
          </h3>
          <p className="font-mono text-xs text-muted-foreground">
            {source
              ? `${source.duration.toFixed(2)} seconds · ${source.capture.sampleRate / 1000} kHz`
              : "WAV · MP3 · M4A · AIFF · FLAC · Ogg · Opus"}
          </p>
        </div>
        <Button
          variant="outline"
          className="h-11"
          disabled={Boolean(busy)}
          onClick={() => input.current?.click()}
        >
          <FolderOpen className="size-4" />
          Open audio file
        </Button>
      </div>
      <div className="h-28 overflow-hidden rounded border border-border bg-surface-2">
        {source ? (
          <WaveformView
            peaks={source.peaks}
            color="var(--primary)"
            grid={false}
            label="Converter source waveform"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <FileAudio className="size-10 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="space-y-1">
          <span className="label-xs">Output format</span>
          <Select
            value={format}
            disabled={Boolean(busy)}
            onValueChange={(v) => {
              setFormat(v as ConversionFormat);
              setResult(null);
            }}
          >
            <SelectTrigger aria-label="Converter output format" className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONVERSION_FORMATS.map((f) => (
                <SelectItem key={f.id} value={f.id} disabled={!conversionSupported(f.id)}>
                  {f.label}
                  {!conversionSupported(f.id) ? " · unavailable on this device" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1">
          <span className="label-xs">Sample rate</span>
          <Select
            value={String(rate)}
            disabled={Boolean(busy)}
            onValueChange={(v) => {
              setRate(Number(v));
              setResult(null);
            }}
          >
            <SelectTrigger aria-label="Converter sample rate" className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[44100, 48000, 96000].map((r) => (
                <SelectItem key={r} value={String(r)}>
                  {r / 1000} kHz
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        {compressed && (
          <label className="space-y-1">
            <span className="label-xs">Bitrate</span>
            <Select
              value={String(kbps)}
              disabled={Boolean(busy)}
              onValueChange={(v) => {
                setKbps(Number(v));
                setResult(null);
              }}
            >
              <SelectTrigger aria-label="Converter bitrate" className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[128, 192, 256, 320].map((k) => (
                  <SelectItem key={k} value={String(k)}>
                    {k} kbps
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        )}
        {format === "wav" && (
          <div className="flex items-center justify-between gap-3 self-end border-b border-border py-3">
            <label htmlFor="converter-mono" className="text-sm">
              Mono WAV
            </label>
            <Switch
              id="converter-mono"
              checked={mono}
              disabled={Boolean(busy)}
              onCheckedChange={(v) => {
                setMono(v);
                setResult(null);
              }}
            />
          </div>
        )}
      </div>
      {["m4a", "ogg", "opus"].includes(format) && (
        <p className="text-xs text-muted-foreground">
          Device encoding runs for the length of the audio. Availability and bitrate depend on your
          browser.
        </p>
      )}
      {issue && (
        <p role="alert" className="break-words text-sm text-destructive">
          {issue}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          className="h-12"
          disabled={!source || Boolean(busy) || !conversionSupported(format)}
          onClick={() => void convert()}
        >
          {busy ? (
            <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
          ) : (
            <ArrowRightLeft className="size-4" />
          )}
          {busy === "loading"
            ? "Reading audio…"
            : busy === "converting"
              ? "Converting…"
              : "Convert audio"}
        </Button>
        {busy && (
          <Button variant="outline" className="h-12" onClick={cancel}>
            <X className="size-4" />
            Cancel
          </Button>
        )}
        {result && (
          <>
            <Button
              variant="secondary"
              className="h-12"
              onClick={() => downloadBlob(result, result.name)}
            >
              <Download className="size-4" />
              Download {format.toUpperCase()}
            </Button>
            {canShareFile(result) && (
              <Button
                variant="outline"
                className="h-12"
                onClick={() =>
                  void shareFile(result, result.name).catch((error) => {
                    if (error?.name !== "AbortError") setIssue("Could not share this file.");
                  })
                }
              >
                <Share2 className="size-4" />
                Share
              </Button>
            )}
            <span role="status" className="break-all text-xs text-primary">
              {result.name} · {(result.size / 1024).toFixed(1)} KB
            </span>
          </>
        )}
      </div>
    </div>
  );
}
