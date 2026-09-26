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
  Radio,
  Scissors,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Sparkles,
  Waves,
  Wand2,
  FolderOpen,
  FileSearch,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
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
    { label: "Sounds", icon: <FolderOpen />, panel: "browser" },
    { label: "Beat Maker", icon: <Grid2x2 />, run: onBeatMode },
    { label: "Drum Machine", icon: <Disc3 />, panel: "drums" },
    { label: "Synth", icon: <Piano />, panel: "synth" },
    { label: "Sampler", icon: <Scissors />, panel: "sampler" },
    { label: "Pad Sampler", icon: <Grid2x2 />, panel: "pads" },
    { label: "AI Vocal", icon: <Mic />, panel: "vocal" },
    { label: "AI Stem Generator", icon: <Sparkles />, panel: "stemgen" },
    { label: "Hum-to-Beat", icon: <AudioLines />, panel: "hum" },
    { label: "Live View", icon: <Radio />, panel: "live" },
    { label: "Live Looper", icon: <Disc3 />, panel: "looper" },
  ];
  const more: Item[] = [
    { label: "Piano Roll", icon: <Music />, panel: "piano" },
    { label: "Mastering", icon: <Wand2 />, panel: "mastering" },
    { label: "Co-Producer", icon: <Bot />, panel: "coproducer" },
    { label: "Stem Separator", icon: <Waves />, panel: "stems" },
    { label: "Voice Remover", icon: <Waves />, panel: "voice" },
    { label: "Reference Analyzer", icon: <FileSearch />, panel: "reference" },
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
    { label: "MIX", icon: <SlidersHorizontal />, active: panel === "mixer", onClick: () => setPanel("mixer") },
    { label: "MORE", icon: <MoreHorizontal />, active: sheet === "more", onClick: () => setSheet("more") },
  ];

  const list = sheet === "create" ? create : more;

  return (
    <>
      <nav
        aria-label="Studio navigation"
        className="mobile-nav relative z-50 grid shrink-0 grid-cols-5 gap-1 border-t-2 border-border bg-surface-1 px-1.5 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]"
      >
        {tabs.map((t) => (
          <Button
            key={t.label}
            type="button"
            variant="ghost"
            onClick={t.onClick}
            aria-pressed={t.active}
            className={`h-16 min-w-0 flex-col gap-1 rounded-md px-1 text-[11px] font-bold tracking-wider [&_svg]:size-6 ${
              "rec" in t ? "relative -mt-3 h-[4.5rem] border-2 border-destructive/70 bg-surface-2 shadow-lg" : ""} ${
              t.active ? ("rec" in t ? "text-destructive" : "bg-primary/15 text-primary") : "text-muted-foreground"
            }`}
          >
            {t.icon}
            {t.label}
          </Button>
        ))}
      </nav>
      <Sheet open={sheet !== null} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent side="bottom" className="mobile-tool-sheet h-[88dvh] overflow-y-auto rounded-t-lg border-t-2 p-0 pb-[env(safe-area-inset-bottom)]">
          <SheetHeader className="sticky top-0 z-10 border-b border-border bg-background px-5 py-5 text-left">
            <SheetTitle className="text-xl">{sheet === "create" ? "Create & Sounds" : "More Tools"}</SheetTitle>
          </SheetHeader>
          <div className="mobile-tool-grid grid grid-cols-2 gap-3 p-4">
            {list.map((i) => (
              <Button
                key={i.label}
                type="button"
                variant="outline"
                onClick={() => pick(i)}
                className="mobile-tool-item h-24 min-w-0 whitespace-normal rounded-md bg-surface-2/60 px-2 text-center text-sm font-semibold leading-tight [&_svg]:size-7 [&_svg]:text-primary"
              >
                {i.icon}
                {i.label}
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
