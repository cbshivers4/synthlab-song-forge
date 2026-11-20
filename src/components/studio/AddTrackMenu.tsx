import { AudioLines, Cable, Disc3, Mic, Music2, Piano, Plus, Sparkles, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStudio } from "@/lib/synclab/store";
import { INSTRUMENTS } from "@/lib/synclab/presets";
import { openTrackSettings } from "@/components/studio/TrackSettingsDialog";

export function AddTrackMenu({ size = "default" }: { size?: "default" | "sm" }) {
  const { addTrack } = useStudio();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} className="glow font-display font-semibold tracking-wide">
          <Plus className="size-4" /> ADD TRACK
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="label-xs">New channel</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => addTrack("audio", "AUDIO")}>
          <Mic className="size-4" /> Audio — mic, guitar, line in
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => addTrack("instrument", "INSTRUMENT", "Cybotron Lead")}>
          <Music2 className="size-4" /> Instrument — software synth
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => addTrack("instrument", "ACID BASS", "TD-3 Acid Saw")}>
          <Waves className="size-4" /> Acid bass — TD-3 style, with notes
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => addTrack("instrument", "POLY SYNTH", "Poly Synth Brass")}>
          <Piano className="size-4" /> Poly synth — chords, with notes
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => addTrack("instrument", "MODULAR TECH", "Modular Tech Empty Rack")}
        >
          <Waves className="size-4" /> Modular Tech Synth — patch cables
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => addTrack("instrument", "GRANULAR SYNTH", "Granular Glass Cloud")}
        >
          <Sparkles className="size-4" /> Granular Synth — grain clouds, your samples
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => addTrack("drum", "DRUM MACHINE")}>
          <Disc3 className="size-4" /> Drum machine
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => addTrack("sampler", "SAMPLER", "Metro Pluck")}>
          <AudioLines className="size-4" /> Sampler
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => addTrack("midi", "MIDI", "Deep Keys")}>
          <Piano className="size-4" /> MIDI channel
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            const id = addTrack("midi", "EXT SYNTH", "Deep Keys");
            if (id) window.setTimeout(() => openTrackSettings(id), 50);
          }}
        >
          <Cable className="size-4" /> External MIDI instrument — hardware synth
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="label-xs">Instrument browser</DropdownMenuLabel>
        {INSTRUMENTS.map((group) => (
          <DropdownMenuItem
            key={group.category}
            onClick={() => addTrack("instrument", group.category, group.items[0])}
          >
            <span className="font-mono text-[11px] text-primary">{group.category}</span>
            <span className="text-muted-foreground">{group.items[0]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
