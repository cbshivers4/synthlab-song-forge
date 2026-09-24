import { useState } from "react";
import { songSteps } from "@/lib/synclab/timebase";
import { Mic, Play, Sparkles, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStudio } from "@/lib/synclab/store";
import { toast } from "sonner";

const VOICES = ["Detroit Baritone", "Electro Vocoder", "Soul Alto", "Ghetto Tech Chant", "Robotic Whisper"];

export function VocalForge() {
  const { addTrack, transport, setTransport, select, setPanel } = useStudio();
  const [voice, setVoice] = useState<string>(VOICES[0] as string);
  const [lyrics, setLyrics] = useState("");
  const [tone, setTone] = useState(0.5);
  const [playing, setPlaying] = useState(false);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="panel space-y-3 p-4">
        <span className="label-xs">AI vocal generator</span>
        <Textarea
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          placeholder="Write the lines you want sung…"
          className="min-h-28"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Select value={voice} onValueChange={setVoice}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VOICES.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <span className="label-xs">Grit</span>
            <Slider className="w-28" value={[tone]} min={0} max={1} step={0.01} onValueChange={([v = 0]) => setTone(v)} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            disabled={!lyrics.trim()}
            onClick={() => {
              if (typeof window === "undefined" || !window.speechSynthesis) {
                toast.error("SYNCLAB couldn't complete this operation.", { description: "This browser has no voice preview." });
                return;
              }
              window.speechSynthesis.cancel();
              const u = new SpeechSynthesisUtterance(lyrics.trim());
              u.pitch = 0.4 + (1 - tone) * 1.2;
              u.rate = Math.min(1.6, Math.max(0.6, transport.bpm / 120));
              u.onend = () => setPlaying(false);
              u.onerror = () => setPlaying(false);
              setPlaying(true);
              window.speechSynthesis.speak(u);
            }}
          >
            <Play className="size-4" /> {playing ? "REPLAY" : "PREVIEW"}
          </Button>
          <Button
            variant="ghost"
            disabled={!playing}
            onClick={() => {
              window.speechSynthesis?.cancel();
              setPlaying(false);
            }}
          >
            <Square className="size-4" /> STOP
          </Button>
          <Button
            className="glow"
            onClick={() => {
              window.speechSynthesis?.cancel();
              setPlaying(false);
              const id = addTrack("ai-vocal", lyrics.trim().slice(0, 14).toUpperCase() || "AI VOCAL", "Vocoder Bot");
              select(id);
              setPanel("piano");
              toast.success("Vocal channel added", {
                description:
                  "The channel is armed for the vocoder. SYNCLAB does not sing your lyrics yet — sing or speak the line into this channel, or write the melody in the piano roll. Undo removes it.",
                duration: 9000,
              });
            }}
          >
            <Sparkles className="size-4" /> ADD TO TIMELINE
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Preview only — PREVIEW reads your lines with your device's built-in voice as a timing guide (Grit lowers the
          voice). Nothing is added to your song until you press ADD TO TIMELINE.
        </p>
      </div>
      <div className="panel space-y-3 p-4">
        <span className="label-xs">Record a real vocal</span>
        <p className="text-sm text-muted-foreground">
          Add an audio channel, pick your input, arm it and hit record. Every take lands on its own lane so you can
          keep the best one.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => addTrack("audio", "VOCAL")}>
            <Mic className="size-4" /> New vocal track
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              const lo = transport.loopStart ?? 0;
              const hi = transport.loopEnd ?? songSteps(transport.bars);
              setTransport({ punchIn: lo, punchOut: hi });
              toast.success("Punch markers set", {
                description: `Recording starts at step ${lo + 1} and stops at step ${hi} while the transport runs.`,
              });
            }}
          >
            Punch in / out
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setTransport({ loop: true, overdub: true });
              toast.success("Loop takes on", { description: "Each pass around the loop is kept as its own take." });
            }}
          >
            Loop takes
          </Button>
        </div>
      </div>
    </div>
  );
}
