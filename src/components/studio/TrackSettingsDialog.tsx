/**
 * Track settings — one dialog for a channel's name, colour, level, pan,
 * mute/solo, MIDI channel and octave. Opened from anywhere with
 * openTrackSettings(trackId); every control writes straight to the track.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStudio } from "@/lib/synclab/store";

const EVENT = "synclab:track-settings";
const COLORS = ["#f0a03c", "#ef4444", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6", "#eab308"];

export function openTrackSettings(trackId: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: trackId }));
}

export function TrackSettingsDialog() {
  const { tracks, updateTrack } = useStudio();
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const on = (e: Event) => setId((e as CustomEvent<string>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const track = tracks.find((t) => t.id === id);
  const set = (patch: Parameters<typeof updateTrack>[1]) => track && updateTrack(track.id, patch);
  const instrument = track && track.kind !== "audio";

  return (
    <Dialog open={Boolean(track)} onOpenChange={(open) => !open && setId(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Track settings</DialogTitle>
          <DialogDescription>Changes apply to this channel right away.</DialogDescription>
        </DialogHeader>
        {track && (
          <div className="space-y-4">
            <label className="block space-y-1">
              <span className="label-xs">Name</span>
              <Input value={track.name} onChange={(e) => set({ name: e.target.value })} />
            </label>
            <div className="space-y-1">
              <span className="label-xs">Colour</span>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => set({ color: c })}
                    className={`size-8 rounded-full border-2 ${track.color === c ? "border-foreground" : "border-transparent"}`} style={{ background: c }} />
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between"><span className="label-xs">Volume</span><span className="font-mono text-xs">{Math.round(track.volume * 100)}%</span></div>
              <Slider value={[track.volume]} min={0} max={1.2} step={0.01} onValueChange={([v = 0]) => set({ volume: v })} />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between"><span className="label-xs">Pan</span><span className="font-mono text-xs">{track.pan === 0 ? "C" : track.pan < 0 ? `L${Math.round(-track.pan * 100)}` : `R${Math.round(track.pan * 100)}`}</span></div>
              <Slider value={[track.pan]} min={-1} max={1} step={0.01} onValueChange={([v = 0]) => set({ pan: v })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={track.muted ? "default" : "outline"} className="h-12" onClick={() => set({ muted: !track.muted })}>Mute</Button>
              <Button variant={track.solo ? "default" : "outline"} className="h-12" onClick={() => set({ solo: !track.solo })}>Solo</Button>
            </div>
            {instrument && (
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="label-xs">MIDI channel</span>
                  <Select value={String(track.midiChannel ?? 0)} onValueChange={(v) => set({ midiChannel: v === "0" ? undefined : Number(v) })}>
                    <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">All channels</SelectItem>
                      {Array.from({ length: 16 }, (_, i) => <SelectItem key={i} value={String(i + 1)}>Channel {i + 1}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
                <label className="space-y-1">
                  <span className="label-xs">Octave</span>
                  <Select value={String(track.octave ?? 0)} onValueChange={(v) => set({ octave: Number(v) || undefined })}>
                    <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[-3, -2, -1, 0, 1, 2, 3].map((o) => <SelectItem key={o} value={String(o)}>{o > 0 ? `+${o}` : o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
