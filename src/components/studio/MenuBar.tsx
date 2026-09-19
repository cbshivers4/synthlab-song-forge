import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { useStudio } from "@/lib/synclab/store";
import { useApp } from "@/lib/synclab/app-state";
import { toast } from "sonner";
import { useEffect, useRef } from "react";
import { openExport } from "@/components/studio/ExportDialog";
import { saveCloudProject } from "@/lib/synclab/cloud";
import { saveUserTemplate } from "@/lib/synclab/user-templates";
import { parseMidiFile } from "@/lib/synclab/midi-file";


const notYet = (what: string, why: string) => () => toast(what, { description: why });

export function MenuBar() {
  const {
    setPanel,
    addTrack,
    selected,
    duplicateTrack,
    removeTrack,
    togglePlay,
    toggleRecord,
    stop,
    transport,
    setTransport,
    copyTrack,
    cutTrack,
    pasteTrack,
    clipboardName,
    editTool,
    setEditTool,
    selectAll,
    splitAtPlayhead,
    snapshot,
    loadSample,
    setNotes,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useStudio();
  const importRef = useRef<HTMLInputElement>(null);
  const midiRef = useRef<HTMLInputElement>(null);

  /** Loads a .mid file and puts each of its tracks on its own MIDI channel. */
  const importMidi = async (file: File) => {
    try {
      const parsed = parseMidiFile(await file.arrayBuffer());
      parsed.forEach((t) => {
        const id = addTrack("midi", t.name || "MIDI", "Deep Keys");
        setNotes(id, t.notes);
      });
      setPanel("piano");
      toast.success(`Imported ${file.name}`, {
        description: `${parsed.length} part${parsed.length === 1 ? "" : "s"} loaded — open the piano roll to edit.`,
      });
    } catch (error) {
      toast.error("Could not read that MIDI file", {
        description: error instanceof Error ? error.message : "Try exporting it again as a standard MIDI file.",
      });
    }
  };

  const importAudio = (file: File) => {
    const id = addTrack("sampler", file.name.replace(/\.[^.]+$/, "").toUpperCase().slice(0, 16));
    setPanel("sampler");
    void loadSample(id, file);
    toast.success(`Imported ${file.name}`, { description: "Loaded into a new sampler channel." });
  };
  const { setStage, mode, toggleMode, project, setProject } = useApp();

  const save = async () => {
    if (!project) {
      toast("Create a project first");
      return;
    }
    const saving = toast.loading("Saving project and audio…");
    try {
      const saved = await saveCloudProject({ ...project, id: project.id ?? "" }, snapshot());
      setProject({ ...project, id: saved.id, openedAt: Date.now() });
      toast.success("Project saved to your cloud", { id: saving });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cloud save failed", { id: saving });
    }
  };

  useEffect(() => {
    const onSave = () => void save();
    document.addEventListener("synclab:cloud-save", onSave);
    return () => document.removeEventListener("synclab:cloud-save", onSave);
  });

  const needTrack = (fn: (id: string) => void) => () => {
    if (!selected) {
      toast("Select a track first", { description: "Click a track name in the timeline, then try again." });
      return;
    }
    fn(selected.id);
  };

  return (
    <div className="flex min-h-11 items-center gap-2 overflow-x-auto border-b border-border bg-surface/70 px-2 [scrollbar-width:none]">
      <input
        ref={importRef}
        type="file"
        accept="audio/*,.mp3,.wav,.wave,.aif,.aiff,.m4a,.aac,.ogg,.flac,.webm"
        multiple
        className="hidden"
        aria-label="Import audio files"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          files.forEach(importAudio);
          e.target.value = "";
        }}
      />
      <input
        ref={midiRef}
        type="file"
        accept=".mid,.midi,audio/midi"
        multiple
        className="hidden"
        aria-label="Import MIDI files"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          files.forEach((f) => void importMidi(f));
          e.target.value = "";
        }}
      />
      <Menubar className="h-10 min-w-max border-0 bg-transparent p-0 [&_[role=menuitem]]:min-h-11 [&_[role=menuitem]]:touch-manipulation">
        <MenubarMenu>
          <MenubarTrigger className="min-h-10 touch-manipulation px-3 text-xs">File</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={() => setStage("start")}>New Project</MenubarItem>
            <MenubarItem onClick={() => setStage("start")}>Open Project</MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={() => void save()}>
              Save <MenubarShortcut>⌘S</MenubarShortcut>
            </MenubarItem>
            <MenubarItem onClick={() => {
              if (!project) return;
              const { id: _id, ...copy } = project;
              setProject({ ...copy, name: `${project.name} Copy`, openedAt: Date.now() });
              toast("Copy ready", { description: "Choose Save to store it as a separate cloud project." });
            }}>
              Save As
            </MenubarItem>
            <MenubarItem
              onClick={() => {
                try {
                  const name = project?.name ?? "My template";
                  saveUserTemplate(name, snapshot());
                  toast.success(`Saved “${name}” as a template`, {
                    description: "It shows up under Your templates on the start screen.",
                  });
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not save that template");
                }
              }}
            >
              Save Template
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={() => importRef.current?.click()}>Import Audio…</MenubarItem>
            <MenubarItem onClick={() => midiRef.current?.click()}>Import MIDI…</MenubarItem>
            <MenubarItem onClick={openExport}>Export / Share (WAV, MP3)</MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={() => setPanel(null)}>Close Editor</MenubarItem>
            <MenubarItem onClick={() => setStage("start")}>
              Close Project <MenubarShortcut>⌘W</MenubarShortcut>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="text-xs">Edit</MenubarTrigger>
          <MenubarContent>
            <MenubarItem disabled={!canUndo} onClick={undo}>
              Undo <MenubarShortcut>⌘Z</MenubarShortcut>
            </MenubarItem>
            <MenubarItem disabled={!canRedo} onClick={redo}>
              Redo <MenubarShortcut>⇧⌘Z</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={needTrack((id) => cutTrack(id))}>
              Cut Track <MenubarShortcut>⌘X</MenubarShortcut>
            </MenubarItem>
            <MenubarItem onClick={needTrack((id) => copyTrack(id))}>
              Copy Track <MenubarShortcut>⌘C</MenubarShortcut>
            </MenubarItem>
            <MenubarItem onClick={pasteTrack}>
              Paste{clipboardName ? ` “${clipboardName}”` : ""} <MenubarShortcut>⌘V</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={needTrack((id) => duplicateTrack(id))}>
              Duplicate Track <MenubarShortcut>⌘D</MenubarShortcut>
            </MenubarItem>
            <MenubarItem onClick={needTrack((id) => removeTrack(id))}>Delete Track</MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={selectAll}>
              Select All <MenubarShortcut>⌘A</MenubarShortcut>
            </MenubarItem>
            <MenubarItem onClick={splitAtPlayhead}>
              Split at Playhead <MenubarShortcut>S</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={() => setEditTool("select")}>
              {editTool === "select" ? "✓ " : ""}Select Tool <MenubarShortcut>V</MenubarShortcut>
            </MenubarItem>
            <MenubarItem onClick={() => setEditTool("draw")}>
              {editTool === "draw" ? "✓ " : ""}Draw Tool <MenubarShortcut>B</MenubarShortcut>
            </MenubarItem>
            <MenubarItem onClick={() => setEditTool("split")}>
              {editTool === "split" ? "✓ " : ""}Split Tool <MenubarShortcut>C</MenubarShortcut>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="text-xs">View</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={() => setPanel("mixer")}>Mixer</MenubarItem>
            <MenubarItem onClick={() => setPanel("piano")}>Piano Roll</MenubarItem>
            <MenubarItem onClick={() => setPanel("keys")}>Keyboard</MenubarItem>
            <MenubarItem onClick={() => setPanel("appearance")}>Appearance & Themes</MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={toggleMode}>
              {mode === "simple" ? "Switch to Advanced Mode" : "Switch to Simple Mode"}
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="text-xs">Project</MenubarTrigger>
          <MenubarContent>
            <MenubarItem disabled>{project ? project.name : "Untitled session"}</MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={() => setPanel("settings")}>Project Settings</MenubarItem>
            <MenubarItem onClick={() => setStage("start")}>Templates</MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="text-xs">Track</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={() => addTrack("audio", "AUDIO")}>Add Audio Track</MenubarItem>
            <MenubarItem onClick={() => addTrack("instrument", "INSTRUMENT", "Cybotron Lead")}>Add Instrument</MenubarItem>
            <MenubarItem onClick={() => addTrack("midi", "MIDI", "Deep Keys")}>Add MIDI Track</MenubarItem>
            <MenubarItem onClick={() => addTrack("drum", "DRUM MACHINE")}>Add Drum Machine</MenubarItem>
            <MenubarItem onClick={() => addTrack("sampler", "SAMPLER", "Metro Pluck")}>Add Sampler</MenubarItem>
            <MenubarItem onClick={() => addTrack("ai-vocal", "AI VOCAL", "Vocoder Bot")}>Add AI Vocal</MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="text-xs">Audio</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={togglePlay}>{transport.playing ? "Pause" : "Play"}</MenubarItem>
            <MenubarItem onClick={stop}>Stop</MenubarItem>
            <MenubarItem onClick={toggleRecord}>Record</MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={() => setTransport({ metronome: !transport.metronome })}>Metronome</MenubarItem>
            <MenubarItem onClick={() => setTransport({ countIn: !transport.countIn })}>Count-in</MenubarItem>
            <MenubarItem onClick={() => setPanel("settings")}>Audio Settings</MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="text-xs">MIDI</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={() => setPanel("piano")}>Piano Roll</MenubarItem>
            <MenubarItem onClick={() => setPanel("keys")}>Virtual Keyboard</MenubarItem>
            <MenubarItem onClick={() => setPanel("settings")}>MIDI Devices</MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="text-xs">Tools</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={() => setPanel("synth")}>Synthesizer</MenubarItem>
            <MenubarItem onClick={() => setPanel("drums")}>Drum Machine</MenubarItem>
            <MenubarItem onClick={() => setPanel("browser")}>Browser</MenubarItem>
            <MenubarItem onClick={() => setPanel("mixer")}>Mixer</MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="text-xs">AI</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={() => setPanel("vocal")}>Vocal Forge</MenubarItem>
            <MenubarItem onClick={() => setPanel("coproducer")}>AI Co-Producer</MenubarItem>
            <MenubarItem onClick={() => setPanel("bass")}>Bass Generator</MenubarItem>
            <MenubarItem onClick={() => setPanel("stems")}>Stem Separator</MenubarItem>
            <MenubarItem onClick={() => setPanel("voice")}>Voice Remover</MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="text-xs">Plugins</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={() => setPanel("plugins")}>Plugin Rack</MenubarItem>
            <MenubarItem onClick={() => setPanel("settings")}>Plugin Settings</MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="text-xs">Window</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={() => setPanel("mixer")}>Mixer (pop out from its header)</MenubarItem>
            <MenubarItem onClick={() => setPanel(null)}>Close Editor</MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="text-xs">Help</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={() => setPanel("settings")}>Preferences</MenubarItem>
            <MenubarItem
              onClick={() =>
                toast("Keyboard shortcuts", {
                  description: "Space play/stop · R record · S split · Delete remove · ⌘D duplicate",
                })
              }
            >
              Keyboard Shortcuts
            </MenubarItem>
            <MenubarItem
              onClick={() =>
                toast("Quick start", {
                  description:
                    "1 · Add a track  2 · Open Drum Machine or Synthesizer to make a part  3 · Arm ● REC to record  4 · Shape it in the Mixer  5 · Set the export flags and share a WAV or MP3.",
                  duration: 12000,
                })
              }
            >
              Quick start guide
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>

      <span className="ml-auto hidden shrink-0 font-mono text-[10px] tracking-widest text-muted-foreground uppercase lg:inline">
        {project ? `${project.name} · ${project.key} · ${project.timeSig}` : "untitled session"} · {mode} mode
      </span>
    </div>
  );
}
