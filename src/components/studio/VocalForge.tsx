import { useState } from "react";
import { Mic, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStudio } from "@/lib/synclab/store";
import { toast } from "sonner";

const VOICES = ["Detroit Baritone", "Electro Vocoder", "Soul Alto", "Ghetto Tech Chant", "Robotic Whisper"];

export function VocalForge() {
  const { addTrack } = useStudio();
  const [voice, setVoice] = useState<string>(VOICES[0] as string);
  const [lyrics, setLyrics] = useState("");
  const [tone, setTone] = useState(0.5);

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
          <Button
            className="glow"
            onClick={() => {
              addTrack("ai-vocal", "AI VOCAL", "Vocoder Bot");
              toast.success("AI vocal channel created", { description: `${voice} ready on its own track.` });
            }}
          >
            <Sparkles className="size-4" /> GENERATE
          </Button>
        </div>
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
          <Button variant="ghost" onClick={() => toast("Punch recording armed", { description: "Punch in / out markers follow the loop region." })}>
            Punch in / out
          </Button>
          <Button variant="ghost" onClick={() => toast("Loop recording on", { description: "Each pass is stored as a new take." })}>
            Loop takes
          </Button>
        </div>
      </div>
    </div>
  );
}
