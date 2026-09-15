import { createFileRoute } from "@tanstack/react-router";
import { Disc3, Music2, Piano, SlidersHorizontal, Waves, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio, type PanelId } from "@/lib/synclab/store";
import { TopBar } from "@/components/studio/TopBar";
import { Timeline } from "@/components/studio/Timeline";
import { Mixer } from "@/components/studio/Mixer";
import { SynthEditor } from "@/components/studio/SynthEditor";
import { DrumMachine } from "@/components/studio/DrumMachine";
import { PianoRoll } from "@/components/studio/PianoRoll";
import { VocalForge } from "@/components/studio/VocalForge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SYNCLAB Studio — One-Page Detroit DAW" },
      {
        name: "description",
        content:
          "SYNCLAB is a browser DAW: unlimited tracks, a deep three-oscillator synth, a step-sequenced drum machine, piano roll and mixer, all on one page.",
      },
      { property: "og:title", content: "SYNCLAB Studio — One-Page Detroit DAW" },
      {
        property: "og:description",
        content:
          "Add tracks, program beats, design synths and mix a whole record without leaving a single screen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Studio,
});

function Panels() {
  const { selected, tracks, panel, setPanel, select } = useStudio();
  const drumTrack = selected?.kind === "drum" ? selected : tracks.find((t) => t.kind === "drum");
  const synthTrack = selected?.patch ? selected : tracks.find((t) => t.patch);
  if (!panel) return null;

  const config: Record<Exclude<PanelId, null>, { title: string; icon: React.ReactNode }> = {
    mixer: { title: "MIXER", icon: <SlidersHorizontal className="size-4" /> },
    synth: { title: "INSTRUMENT EDITOR", icon: <Music2 className="size-4" /> },
    drums: { title: "DRUM MACHINE", icon: <Disc3 className="size-4" /> },
    piano: { title: "PIANO ROLL", icon: <Piano className="size-4" /> },
    vocal: { title: "VOCAL FORGE", icon: <Waves className="size-4" /> },
  };
  const current = config[panel];

  return (
    <section className="border-t border-border pt-4">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-primary">{current.icon}</span>
        <h2 className="font-display text-sm font-semibold tracking-widest">{current.title}</h2>
        <Button size="icon" variant="ghost" className="ml-auto size-8" onClick={() => setPanel(null)} aria-label="Close editor">
          <X className="size-4" />
        </Button>
      </div>
      {panel === "mixer" && <Mixer />}
      {panel === "synth" &&
        (synthTrack ? (
          <>
            <p className="label-xs mb-3">Editing {synthTrack.name}</p>
            <SynthEditor track={synthTrack} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Add an instrument track to open the synthesizer.</p>
        ))}
      {panel === "drums" &&
        (drumTrack ? (
          <DrumMachine track={drumTrack} />
        ) : (
          <p className="text-sm text-muted-foreground">Add a drum machine track to program a beat.</p>
        ))}
      {panel === "piano" &&
        (synthTrack ? (
          <PianoRoll track={synthTrack} />
        ) : (
          <p className="text-sm text-muted-foreground">Select an instrument or MIDI track to edit its notes.</p>
        ))}
      {panel === "vocal" && <VocalForge />}

      {selected && (
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="label-xs self-center">Selected: {selected.name}</span>
          <Button size="sm" variant="ghost" onClick={() => setPanel(selected.kind === "drum" ? "drums" : "synth")}>
            Open editor
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPanel("piano")}>
            Open piano roll
          </Button>
          <Button size="sm" variant="ghost" onClick={() => select(selected.id)}>
            Track settings
          </Button>
        </div>
      )}
    </section>
  );
}

function Studio() {
  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-4">
        <Timeline />
        <Panels />
        <footer className="label-xs pb-8 text-center">
          SYNCLAB — simple on the surface, professional underneath.
        </footer>
      </main>
    </div>
  );
}
