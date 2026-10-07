import { Disc3, FolderOpen, Grid2x2, Radio, Scissors, Waves, AudioLines, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio, type PanelId } from "@/lib/synclab/store";

type Tile = { label: string; hint: string; icon: React.ReactNode; panel?: PanelId; run?: () => void; big?: boolean };

/**
 * Phone portrait CREATE screen: large tiles that open the real studio tools
 * (same project and engine as desktop) so a beat can start within seconds.
 */
export function MobileCreate({ onBeatMode, onMore }: { onBeatMode: () => void; onMore: () => void }) {
  const { setPanel, transport, tracks } = useStudio();
  const armed = tracks.filter((t) => t.armed).map((t) => t.name);

  const tiles: Tile[] = [
    { label: "Drum Machine", hint: "Pads & patterns", icon: <Disc3 />, panel: "drums", big: true },
    { label: "Synth", hint: "Sound design", icon: <Waves />, panel: "synth" },
    { label: "Pads", hint: "Sample pads", icon: <Grid2x2 />, panel: "pads" },
    { label: "Sampler", hint: "Trim & chop", icon: <Scissors />, panel: "sampler" },
    { label: "Looper", hint: "Live loops", icon: <Disc3 />, panel: "looper" },
    { label: "Live View", hint: "Clip launch", icon: <Radio />, panel: "live" },
    { label: "Import", hint: "Audio & MIDI files", icon: <FolderOpen />, panel: "browser" },
    { label: "More", hint: "Settings & tools", icon: <MoreHorizontal />, run: onMore },
  ];

  return (
    <section aria-label="Create" className="absolute inset-0 z-30 overflow-y-auto bg-background p-3 pb-6">
      <p className="mb-3 flex items-center gap-2 rounded-md border border-border bg-surface-1 px-3 py-2 text-sm text-muted-foreground">
        <AudioLines className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 truncate">
          {armed.length ? `Armed: ${armed.join(", ")}` : "No track armed — recording uses the selected track"}
          {transport.monitor ? " · Monitoring on" : ""}
        </span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <Button
            key={t.label}
            type="button"
            variant="outline"
            onClick={() => (t.run ? t.run() : t.panel && setPanel(t.panel))}
            className={`flex min-w-0 flex-col items-start justify-between gap-2 whitespace-normal rounded-lg bg-surface-2/60 p-4 text-left [&_svg]:size-8 [&_svg]:text-primary ${t.big ? "h-36" : "h-28"}`}
          >
            {t.icon}
            <span className="min-w-0">
              <span className="block text-base font-bold leading-tight">{t.label}</span>
              <span className="block text-xs font-normal text-muted-foreground">{t.hint}</span>
            </span>
          </Button>
        ))}
      </div>
    </section>
  );
}
