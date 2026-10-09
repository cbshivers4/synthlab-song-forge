import { useEffect, useState } from "react";
import { requestBluetoothSettings } from "./Settings";
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
  Play,
  Pause,
  Square,
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
export function MobileNav({ onBeatMode, view, setView, moreSignal = 0, landscape = false, toolsOpen = false, onToggleTools }: { landscape?: boolean; toolsOpen?: boolean; onToggleTools?: () => void; onBeatMode: () => void; view: "create" | "edit"; setView: (v: "create" | "edit") => void; moreSignal?: number }) {
  const { panel, setPanel, toggleRecord, togglePlay, stop, transport } = useStudio();
  const [sheet, setSheet] = useState<null | "create" | "more">(null);
  useEffect(() => { if (moreSignal) setSheet("more"); }, [moreSignal]);

  const create: Item[] = [
    { label: "Sounds", icon: <FolderOpen />, panel: "browser" },
    { label: "Beat Maker", icon: <Grid2x2 />, run: () => { setPanel(null); onBeatMode(); } },
    { label: "Drum Machine", icon: <Disc3 />, panel: "drums" },
    { label: "Synth", icon: <Piano />, panel: "synth" },
    { label: "Sampler", icon: <Scissors />, panel: "sampler" },
    { label: "Pad Sampler", icon: <Grid2x2 />, panel: "pads" },
    { label: "Live View", icon: <Radio />, panel: "live" },
    { label: "Live Looper", icon: <Disc3 />, panel: "looper" },
    { label: "Hum to Beat", icon: <Mic />, panel: "humbeat" },
    { label: "Separate Stems", icon: <Scissors />, panel: "stems" },
    { label: "AI Co-Producer", icon: <Bot />, panel: "coproducer" },
    { label: "Convert Voice", icon: <Mic />, panel: "voice" },
    { label: "Generate Stem", icon: <Sparkles />, panel: "genstem" },
    { label: "Bass Generator", icon: <Music />, panel: "bassgen" },
  ];
  const more: Item[] = [
    { label: "Piano Roll", icon: <Music />, panel: "piano" },
    { label: "Mastering", icon: <Wand2 />, panel: "mastering" },
    { label: "Reference Analyzer", icon: <FileSearch />, panel: "reference" },
    { label: "Help", icon: <LifeBuoy />, run: () => openHelp("help") },
  ];

  const pick = (i: Item) => {
    setSheet(null);
    if (i.run) i.run();
    else if (i.panel) setPanel(i.panel);
  };

  const tabs = [
     { label: "HOME", icon: <Home />, active: panel === null && view === "create", onClick: () => { setPanel(null); setView("create"); } },
    { label: "EDIT", icon: <Scissors />, active: (panel === null && view === "edit") || panel === "piano", onClick: () => { setPanel(null); setView("edit"); } },
    {
      label: transport.recording ? "STOP" : "REC",
      icon: <Mic />,
      active: !!transport.recording,
      onClick: toggleRecord,
      rec: true,
    },
    { label: "MIX", icon: <SlidersHorizontal />, active: panel === "mixer", onClick: () => setPanel("mixer") },
    { label: "SOUNDS", icon: <FolderOpen />, active: panel === "browser", onClick: () => setPanel("browser") },
    { label: "TOOLS", icon: <Wand2 />, active: sheet === "more", onClick: () => setSheet("more") },
  ];

  const prodTabs = [
    { label: "HOME", icon: <Home />, active: panel === null && view === "create", onClick: () => { setPanel(null); setView("create"); } },
    { label: "EDIT", icon: <AudioLines />, active: panel === null && view === "edit", onClick: () => { setPanel(null); setView("edit"); } },
    { label: "MIX", icon: <SlidersHorizontal />, active: panel === "mixer", onClick: () => setPanel("mixer") },
    { label: "MIDI", icon: <Music />, active: panel === "piano", onClick: () => setPanel("piano") },
    { label: transport.recording ? "STOP" : "REC", icon: <Mic />, active: !!transport.recording, onClick: toggleRecord, rec: true },
    { label: "TOOLS", icon: <Wand2 />, active: toolsOpen, onClick: () => onToggleTools?.() },
    { label: "MORE", icon: <MoreHorizontal />, active: sheet === "more", onClick: () => setSheet("more") },
  ];
  const shown = landscape ? prodTabs : tabs;

  const list = sheet === "create" ? create : more;

  return (
    <>
      <nav
        aria-label="Studio navigation"
        className={landscape
          ? "relative z-50 order-last flex w-20 shrink-0 flex-col justify-start gap-0.5 overflow-y-auto border-l-2 border-border bg-surface-1 px-1 py-1 pr-[max(0.25rem,env(safe-area-inset-right))]"
          : "mobile-nav relative z-50 grid shrink-0 grid-cols-6 gap-1 border-t-2 border-border bg-surface-1 px-1.5 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]"}
      >
        {shown.map((t) => (
          <Button
            key={t.label}
            type="button"
            variant="ghost"
            onClick={t.onClick}
            aria-pressed={t.active}
            className={`${landscape ? "!h-11 shrink-0 !gap-0.5 [&_svg]:!size-4 !text-[9px]" : "h-16"} min-w-0 flex-col gap-1 rounded-md px-1 text-[11px] font-bold tracking-wider [&_svg]:size-6 ${
              "rec" in t ? landscape ? "border-2 border-destructive/70 bg-surface-2" : "relative -mt-3 h-[4.5rem] border-2 border-destructive/70 bg-surface-2 shadow-lg" : ""} ${
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
          {sheet === "more" && (
            <div className="px-4 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => pick({ label: "Phone settings", icon: <SettingsIcon />, panel: "settings" })}
                className="h-16 w-full justify-start gap-4 border border-primary/50 px-4 text-base font-semibold [&_svg]:size-7 [&_svg]:shrink-0"
              >
                <SettingsIcon /> Phone settings
              </Button>
               <Button variant="outline" className="mt-2 h-12 w-full" onClick={() => { requestBluetoothSettings(); pick({ label: "Bluetooth devices", icon: <Radio />, panel: "settings" }); }}>Bluetooth devices</Button>
            </div>
          )}
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
