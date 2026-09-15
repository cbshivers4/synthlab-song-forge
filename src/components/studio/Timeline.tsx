import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Disc3,
  Eye,
  EyeOff,
  Headphones,
  Mic,
  MoreVertical,
  Repeat,
  Music2,
  Piano,
  Settings2,
  Snowflake,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStudio } from "@/lib/synclab/store";
import { INSTRUMENTS, KIND_LABEL } from "@/lib/synclab/presets";
import type { Track } from "@/lib/synclab/types";

const KindIcon = ({ kind }: { kind: Track["kind"] }) =>
  kind === "drum" ? (
    <Disc3 className="size-3.5" />
  ) : kind === "audio" ? (
    <Mic className="size-3.5" />
  ) : kind === "midi" ? (
    <Piano className="size-3.5" />
  ) : (
    <Music2 className="size-3.5" />
  );

const INPUTS = ["Microphone", "Guitar / Line 1", "Keyboard / Line 2", "External Instrument", "MIDI Keyboard", "Internal", "Stereo File"];

function Waveform({ track }: { track: Track }) {
  const { setActiveClip, removeClip } = useStudio();
  const clips = track.clips ?? [];
  const active = clips.find((c) => c.id === track.activeClipId) ?? clips[clips.length - 1];
  if (!active) return null;
  return (
    <div className="absolute inset-y-1 left-0 right-1 flex flex-col overflow-hidden rounded-[3px] border"
      style={{ borderColor: `color-mix(in oklab, ${track.color} 55%, transparent)`, background: `color-mix(in oklab, ${track.color} 12%, var(--background))` }}
    >
      <div className="flex items-center gap-1 px-1.5 py-[2px]" style={{ background: `color-mix(in oklab, ${track.color} 45%, transparent)` }}>
        <span className="truncate font-mono text-[9px] tracking-wider text-foreground/90">
          {active.name} · {active.duration.toFixed(1)}s
        </span>
        <div className="ml-auto flex items-center gap-1">
          {clips.map((c) => (
            <button
              key={c.id}
              onClick={(e) => {
                e.stopPropagation();
                setActiveClip(track.id, c.id);
              }}
              onDoubleClick={() => removeClip(track.id, c.id)}
              title="Click to choose take, double-click to delete"
              className={`size-2 rounded-full border ${c.id === active.id ? "border-foreground bg-foreground" : "border-foreground/50"}`}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-1 items-center gap-[1px] px-1">
        {active.peaks.map((p, i) => (
          <div
            key={i}
            className="flex-1"
            style={{ height: `${Math.round(Math.max(6, p * 92))}%`, background: track.color, opacity: 0.9 }}
          />
        ))}
      </div>
    </div>
  );
}

function Lane({ track }: { track: Track }) {
  const { transport } = useStudio();
  if ((track.clips?.length ?? 0) > 0) return <Waveform track={track} />;
  if (track.recording)
    return (
      <div className="absolute inset-y-1 left-0 right-1 flex items-center justify-center rounded-[3px] border border-destructive/60 bg-destructive/10">
        <span className="animate-pulse font-mono text-[11px] text-destructive">● RECORDING INPUT…</span>
      </div>
    );
  const cells = Array.from({ length: 16 });
  const active = (i: number) => {
    if (track.kind === "drum") return track.pads?.some((p) => (p.steps[i] ?? 0) > 0) ?? false;
    return track.notes?.some((n) => i >= n.step % 16 && i < (n.step % 16) + n.length) ?? false;
  };
  return (
    <div className="absolute inset-y-1 left-0 right-1 grid grid-cols-[repeat(16,minmax(0,1fr))]">
      {cells.map((_, i) => (
        <div key={i} className="px-[1px] py-[1px]">
          {active(i) ? (
            <div
              className="h-full rounded-[2px]"
              style={{
                background: `color-mix(in oklab, ${track.color} 70%, transparent)`,
                boxShadow: `inset 0 1px 0 color-mix(in oklab, ${track.color} 90%, white)`,
              }}
            />
          ) : (
            <div className="h-full" />
          )}
        </div>
      ))}
    </div>
  );
}

function TrackRow({ track, index }: { track: Track; index: number }) {
  const { selectedId, select, updateTrack, removeTrack, duplicateTrack, moveTrack, setPanel, changeInstrument } =
    useStudio();
  const [renaming, setRenaming] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const isSelected = selectedId === track.id;

  const openEditor = () => {
    select(track.id);
    setPanel(track.kind === "drum" ? "drums" : track.kind === "audio" ? "mixer" : "synth");
  };

  return (
    <div
      className={`flex items-stretch border-b border-border/80 transition-colors ${isSelected ? "bg-surface-2/40" : "hover:bg-surface/50"} ${track.hidden ? "opacity-40" : ""}`}
      onClick={() => select(track.id)}
    >
      <div className="w-1 shrink-0" style={{ background: track.color, opacity: isSelected ? 1 : 0.65 }} />
      <div className="w-[240px] shrink-0 space-y-1 border-r border-border bg-surface/70 px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-primary">
            <KindIcon kind={track.kind} />
          </span>
          {renaming ? (
            <Input
              autoFocus
              defaultValue={track.name}
              className="h-7 text-xs"
              onBlur={(e) => {
                updateTrack(track.id, { name: e.target.value.toUpperCase() });
                setRenaming(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
          ) : (
            <button className="font-display text-sm font-semibold" onDoubleClick={() => setRenaming(true)}>
              {index + 1}. {track.name}
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="ml-auto size-6" aria-label="Track menu">
                <MoreVertical className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setRenaming(true)}>Rename</DropdownMenuItem>
              <DropdownMenuItem onClick={() => duplicateTrack(track.id)}>
                <Copy className="size-4" /> Duplicate track
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateTrack(track.id, { frozen: !track.frozen })}>
                <Snowflake className="size-4" /> {track.frozen ? "Unfreeze" : "Freeze"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateTrack(track.id, { hidden: !track.hidden })}>
                {track.hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                {track.hidden ? "Show" : "Hide"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openEditor}>
                <Settings2 className="size-4" /> Track settings
              </DropdownMenuItem>
              {track.patch && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="label-xs">Swap instrument (keeps MIDI)</DropdownMenuLabel>
                  {INSTRUMENTS.flatMap((g) => g.items).map((name) => (
                    <DropdownMenuItem key={name} onClick={() => changeInstrument(track.id, name)}>
                      <Repeat className="size-4" /> {name}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => moveTrack(track.id, -1)}>
                <ChevronUp className="size-4" /> Move up
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => moveTrack(track.id, 1)}>
                <ChevronDown className="size-4" /> Move down
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem

                onClick={() =>
                  (track.clips?.length ?? 0) > 0 || (track.notes?.length ?? 0) > 0
                    ? setConfirm(true)
                    : removeTrack(track.id)
                }
              >
                <Trash2 className="size-4" /> Delete track
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={track.muted ? "secondary" : "ghost"}
            className="h-6 px-2 text-[10px]"
            onClick={() => updateTrack(track.id, { muted: !track.muted })}
          >
            {track.muted ? <VolumeX className="size-3" /> : <Volume2 className="size-3" />} M
          </Button>
          <Button
            size="sm"
            variant={track.solo ? "default" : "ghost"}
            className="h-6 px-2 text-[10px]"
            onClick={() => updateTrack(track.id, { solo: !track.solo })}
          >
            <Headphones className="size-3" /> S
          </Button>
          <Button
            size="sm"
            variant={track.armed ? "destructive" : "ghost"}
            className="h-6 px-2 text-[10px]"
            onClick={() => updateTrack(track.id, { armed: !track.armed })}
          >
            ● REC
          </Button>
          <span className="label-xs ml-auto">{KIND_LABEL[track.kind]}</span>
        </div>

        <div className="flex items-center gap-2">
          <Select value={track.input} onValueChange={(v) => updateTrack(track.id, { input: v })}>
            <SelectTrigger className="h-7 flex-1 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INPUTS.map((i) => (
                <SelectItem key={i} value={i} className="text-xs">
                  {i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Slider
            className="w-16"
            value={[track.volume]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={([v = 0]) => updateTrack(track.id, { volume: v })}
          />
        </div>
      </div>

      <Lane track={track} />

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {track.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This track contains recorded material. Deleting it removes the audio and notes permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep track</AlertDialogCancel>
            <AlertDialogAction onClick={() => removeTrack(track.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function Timeline() {
  const { tracks, transport } = useStudio();
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-sm font-semibold tracking-widest">TIMELINE</h2>
        <span className="label-xs">
          {tracks.length} tracks · step {transport.step + 1}/16
        </span>
      </div>
      <div className="space-y-2">
        {tracks.map((t, i) => (
          <TrackRow key={t.id} track={t} index={i} />
        ))}
      </div>
    </section>
  );
}
