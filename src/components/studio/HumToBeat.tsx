import { useEffect, useRef, useState } from "react";
import { Mic, Play, RotateCcw, Square, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openInOwnTab, openMic, preferredRecordingMime, releaseMic } from "@/lib/synclab/mic";
import { useStudio } from "@/lib/synclab/store";
import { getEngine } from "@/lib/synclab/audio-engine";
import { toast } from "sonner";
import { CreativeToolThemePicker, useCreativeToolTheme } from "./CreativeToolTheme";

function detectHits(buffer: AudioBuffer): number[] {
  const data = buffer.getChannelData(0);
  const bins = 16;
  const size = Math.max(1, Math.floor(data.length / bins));
  const energy = Array.from({ length: bins }, (_, bin) => {
    let sum = 0;
    const start = bin * size;
    const end = Math.min(data.length, start + size);
    for (let i = start; i < end; i++) sum += Math.abs(data[i] ?? 0);
    return sum / Math.max(1, end - start);
  });
  const mean = energy.reduce((sum, value) => sum + value, 0) / bins;
  const peak = Math.max(...energy, 0.001);
  return energy.map((value) => (value > Math.max(mean * 1.35, peak * 0.22) ? Math.max(0.35, value / peak) : 0));
}

export function HumToBeat() {
  const { addTrack, updatePad, setPanel, select } = useStudio();
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pattern, setPattern] = useState<number[]>(Array.from({ length: 16 }, () => 0));
  const recordingRef = useRef<{ recorder: MediaRecorder; stream: MediaStream; chunks: Blob[] } | null>(null);
  const { theme, setTheme } = useCreativeToolTheme("hum");
  useEffect(() => () => {
    const current = recordingRef.current;
    if (!current) return;
    if (current.recorder.state !== "inactive") current.recorder.stop();
    releaseMic(current.stream);
    recordingRef.current = null;
  }, []);

  const start = async () => {
    const result = await openMic({ echoCancellation: false, noiseSuppression: false, autoGainControl: true }, "hum-to-beat");
    if ("error" in result) {
      toast.error("Microphone not available", {
        description: result.error,
        duration: 9000,
        ...(result.canOpenTab ? { action: { label: "Open in tab", onClick: openInOwnTab } } : {}),
      });
      return;
    }
    const mimeType = preferredRecordingMime();
    const recorder = new MediaRecorder(result.stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data);
    recorder.start(100);
    recordingRef.current = { recorder, stream: result.stream, chunks };
    setRecording(true);
  };

  const stop = async () => {
    const current = recordingRef.current;
    if (!current) return;
    setBusy(true);
    const blob = await new Promise<Blob>((resolve) => {
      current.recorder.onstop = () => resolve(new Blob(current.chunks, { type: current.recorder.mimeType }));
      current.recorder.stop();
    });
    releaseMic(current.stream);
    recordingRef.current = null;
    setRecording(false);
    try {
      const context = new AudioContext();
      const buffer = await context.decodeAudioData(await blob.arrayBuffer());
      setPattern(detectHits(buffer));
      await context.close();
      toast.success("Rhythm detected", { description: "Review the 16 steps, then add them to a drum track." });
    } catch {
      toast.error("Could not analyze that recording", { description: "Try a shorter, clearer hum or beatbox take." });
    } finally {
      setBusy(false);
    }
  };

  const preview = () => {
    const engine = getEngine();
    engine.init();
    const id = addTrack("drum", "HUM PREVIEW");
    updatePad(id, "kick", { steps: pattern });
    select(id);
    setPanel("drums");
    toast.success("Beat added", { description: "The detected rhythm is open in the Drum Machine for editing." });
  };

  return (
    <div className="creative-tool mx-auto max-w-2xl space-y-5 p-3" data-creative-theme={theme}>
      <div className="flex justify-end"><CreativeToolThemePicker tool="hum" theme={theme} onChange={setTheme} /></div>
      <div>
        <h3 className="font-display text-lg font-semibold">Hum or beatbox a rhythm</h3>
        <p className="mt-1 text-sm text-muted-foreground">Record one bar. SYNCLAB detects the strongest hits locally on this device.</p>
      </div>
      <div className="grid grid-cols-8 gap-2 sm:grid-cols-16">
        {pattern.map((velocity, index) => (
          <button key={index} type="button" aria-label={`Beat step ${index + 1}`} onClick={() => setPattern((current) => current.map((value, i) => i === index ? (value ? 0 : 1) : value))} className={`h-12 touch-manipulation rounded-[3px] border ${velocity ? "border-primary bg-primary" : "border-border bg-surface-2"}`} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button className="min-h-12 gap-2" variant={recording ? "destructive" : "default"} disabled={busy} onClick={() => recording ? void stop() : void start()}>
          {recording ? <Square className="size-4" /> : <Mic className="size-4" />} {recording ? "Stop & detect" : "Record rhythm"}
        </Button>
        <Button className="min-h-12 gap-2" variant="secondary" disabled={!pattern.some(Boolean) || recording} onClick={preview}>
          <Play className="size-4" /> Add to drums
        </Button>
        <Button className="min-h-11 gap-2" variant="outline" disabled={recording} onClick={() => setPattern(Array.from({ length: 16 }, () => 0))}>
          <RotateCcw className="size-4" /> Clear
        </Button>
        <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground"><WandSparkles className="size-4 text-primary" /> Tap steps to correct detection.</div>
      </div>
    </div>
  );
}