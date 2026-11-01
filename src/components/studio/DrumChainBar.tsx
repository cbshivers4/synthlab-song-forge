import { usePlayStep } from "@/lib/synclab/playhead";
import { Link2, Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useStudio } from "@/lib/synclab/store";
import { chainPosition, type DrumChainItem } from "@/lib/synclab/drum-chain";
import { DRUM_PATTERN_LABELS } from "@/lib/synclab/drum-banks";
import { stepsPerBar } from "@/lib/synclab/timebase";
import type { Track } from "@/lib/synclab/types";
import { cn } from "@/lib/utils";

/** Song pattern chain: add patterns 1–8 in order, set bars for each, switch the chain on. */
export function DrumChainBar({ track }: { track: Track }) {
  const { updateTrack, transport } = useStudio();
  const step = usePlayStep();
  const chain = track.drumChain ?? { on: false, items: [] };
  const set = (patch: Partial<typeof chain>) => updateTrack(track.id, { drumChain: { ...chain, ...patch } });
  const setItems = (items: DrumChainItem[]) => set({ items, on: items.length ? chain.on : false });
  const playing = chain.on && transport.playing ? chainPosition(chain.items, step, stepsPerBar())?.index ?? -1 : -1;
  const totalBars = chain.items.reduce((s, i) => s + i.bars, 0);
  return (
    <div className="drum-chain flex flex-wrap items-center gap-2" role="group" aria-label="Pattern chain">
      <span className="label-xs flex items-center gap-1"><Link2 className="size-3" /> CHAIN</span>
      <label className="flex items-center gap-1.5 font-mono text-[10px]">
        <Switch aria-label="Play the pattern chain" checked={chain.on} disabled={!chain.items.length} onCheckedChange={(on) => set({ on })} />
        {chain.on ? "ON" : "OFF"}
      </label>
      <ol className="flex flex-wrap items-center gap-1" aria-label="Chain order">
        {chain.items.map((item, i) => (
          <li key={i} className={cn("flex items-center gap-0.5 rounded-sm border px-1 py-0.5 font-mono text-[10px]", playing === i ? "border-primary bg-primary/20 text-primary" : "border-border bg-surface-2")}
            aria-current={playing === i ? "step" : undefined}>
            <span className="px-0.5 font-semibold">{item.slot + 1}</span>
            <Button size="icon" variant="ghost" className="size-5" aria-label={`Fewer bars for chain step ${i + 1}`} disabled={item.bars <= 1}
              onClick={() => setItems(chain.items.map((x, j) => (j === i ? { ...x, bars: Math.max(1, x.bars - 1) } : x)))}><Minus className="size-3" /></Button>
            <span aria-label={`${item.bars} bars`}>×{item.bars}</span>
            <Button size="icon" variant="ghost" className="size-5" aria-label={`More bars for chain step ${i + 1}`} disabled={item.bars >= 16}
              onClick={() => setItems(chain.items.map((x, j) => (j === i ? { ...x, bars: Math.min(16, x.bars + 1) } : x)))}><Plus className="size-3" /></Button>
            <Button size="icon" variant="ghost" className="size-5 text-muted-foreground" aria-label={`Remove chain step ${i + 1}`}
              onClick={() => setItems(chain.items.filter((_, j) => j !== i))}><X className="size-3" /></Button>
          </li>
        ))}
      </ol>
      <span className="font-mono text-[10px] text-muted-foreground">ADD</span>
      <div className="flex flex-wrap gap-0.5">
        {DRUM_PATTERN_LABELS.map((n, slot) => (
          <Button key={n} size="sm" variant="outline" className="h-7 w-7 p-0 font-mono text-[10px]" aria-label={`Add pattern ${n} to the chain`} disabled={chain.items.length >= 32}
            onClick={() => setItems([...chain.items, { slot, bars: 1 }])}>{n}</Button>
        ))}
      </div>
      <span className="font-mono text-[10px] text-muted-foreground">
        {chain.items.length ? `${totalBars} bar${totalBars === 1 ? "" : "s"}, repeats across the song${chain.on ? "" : " — switch ON to hear it"}` : "Add patterns in the order they should play"}
      </span>
    </div>
  );
}
