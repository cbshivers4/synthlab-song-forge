import { useState } from "react";
import {
  AudioLines,
  Bot,
  Disc3,
  Grid2x2,
  Home,
  LifeBuoy,
  Mic,
  MoreHorizontal,
  Music,
  Piano,
  Plus,
  Scissors,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Sparkles,
  Waves,
  Wand2,
  FolderOpen,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useStudio, type PanelId } from "@/lib/synclab/store";
import { openHelp } from "./HelpCenter";

type Item = { label: string; icon: React.ReactNode; panel?: PanelId; run?: () => void };

/**
 * Touch-first bottom navigation for phones. Every button opens a real studio
 * tool — the same project and engine as the desktop layout.
 */
export function MobileNav({ onBeatMode }: { onBeatMode: () => void }) {
  const { panel, setPanel, toggleRecord, transport } = useStudio();
  const [sheet, setSheet] = useState<null | "create" | "more">(null);

  const create: Item[] = [
    { label: "Beat Maker", icon: <Grid2x2 />, run: onBeatMode },
    { label: "Drum Machine", icon: <Disc3 />, panel: "drums" },
    { label: "Synth", icon: <Piano />, panel: "synth" },
    { label: "Sampler", icon: <Scissors />, panel: "sampler" },
    { label: "Pad Sampler", icon: <Grid2x2 />, panel: "pads" },
    { label: "AI Vocal", icon: <Mic />, panel: "vocal" },
    { label: "AI Stem Generator", icon: <Sparkles />, panel: "stemgen" },
    { label: "Hum-to-Beat", icon: <AudioLines />, panel: "hum" },
  ];
  const more: Item[] = [
    { label: "Piano Roll", icon: <Music />, panel: "piano" },
    { label: "Mastering", icon: <Wand2 />, panel: "mastering" },
    { label: "Co-Producer", icon: <Bot />, panel: "coproducer" },
    { label: "Stem Separator", icon: <Waves />, panel: "stems" },
    { label: "Voice Remover", icon: <Waves />, panel: "voice" },
    { label: "Settings", icon: <SettingsIcon />, panel: "settings" },
    { label: "Help", icon: <LifeBuoy />, run: () => openHelp("help") },
  ];

  const pick = (i: Item) => {
    setSheet(null);
    if (i.run) i.run();
    else if (i.panel) setPanel(i.panel);
  };

  const tabs = [
    { label: "HOME", icon: <Home />, active: panel === null, onClick: () => setPanel(null) },
    { label: "CREATE", icon: <Plus />, active: sheet === "create", onClick: () => setSheet("create") },
    {
      label: transport.recording ? "STOP" : "RECORD",
      icon: <Mic />,
      active: !!transport.recording,
      onClick: toggleRecord,
      rec: true,
    },
    { label: "SOUNDS", icon: <FolderOpen />, active: panel === "browser", onClick: () => setPanel("browser") },
    { label: "MIX", icon: <SlidersHorizontal />, active: panel === "mixer", onClick: () => setPanel("mixer") },
    { label: "MORE", icon: <MoreHorizontal />, active: sheet === "more", onClick: () => setSheet("more") },
  ];

  const list = sheet === "create" ? create : more;

  return (
    <>
      <nav
        aria-label="Studio navigation"
        className="grid shrink-0 grid-cols-6 border-t border-border bg-surface-1 pb-[env(safe-area-inset-bottom)]"
      >
        {tabs.map((t) => (
          <button
            key={t.label}
            onClick={t.onClick}
            aria-pressed={t.active}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-semibold tracking-wider [&_svg]:size-5 ${
              t.active ? ("rec" in t ? "text-destructive" : "text-primary") : "text-muted-foreground"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>
      <Sheet open={sheet !== null} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{sheet === "create" ? "Create" : "More"}</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3 p-4">
            {list.map((i) => (
              <button
                key={i.label}
                onClick={() => pick(i)}
                className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-surface-2/60 text-sm font-medium [&_svg]:size-6 [&_svg]:text-primary"
              >
                {i.icon}
                {i.label}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
