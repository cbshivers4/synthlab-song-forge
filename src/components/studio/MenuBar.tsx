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
import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { openExport } from "@/components/studio/ExportDialog";
import { openHelp } from "@/components/studio/HelpCenter";
import { saveCloudProject } from "@/lib/synclab/cloud";
import { usePlan } from "@/lib/synclab/plan";
import { saveUserTemplate } from "@/lib/synclab/user-templates";
import { parseMidiFile } from "@/lib/synclab/midi-file";
import { useDesktopMenu } from "@/lib/synclab/desktop-menu";
import { SYNCLAB_VERSION } from "@/lib/synclab/support";
import { AbletonHandoff } from "@/components/studio/AbletonHandoff";

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
    updateClip,
    removeClip,
    previewClip,
  } = useStudio();
  const importRef = useRef<HTMLInputElement>(null);
  const midiRef = useRef<HTMLInputElement>(null);
  const [abletonOpen, setAbletonOpen] = useState(false);

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
  const { requirePro } = usePlan();

  const save = async () => {
    if (!project) {
      toast("Create a project first");
      return;
    }
    if (!requirePro("Cloud saving")) return;
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

  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");

  const openSaveAs = () => {
    if (!requirePro("Cloud saving")) return;
    setSaveAsName(project ? `${project.name} Copy` : "Untitled project");
    setSaveAsOpen(true);
  };

  const confirmSaveAs = async () => {
    const name = saveAsName.trim() || "Untitled project";
    if (!project) {
      toast("Create a project first");
      return;
    }
    setSaveAsOpen(false);
    const { id: _id, ...copy } = project;
    const newProject = { ...copy, name, openedAt: Date.now() };
    setProject(newProject);
    const saving = toast.loading(`Saving “${name}” and its audio…`);
    try {
      const saved = await saveCloudProject({ ...newProject, id: "" }, snapshot());
      setProject({ ...newProject, id: saved.id });
      toast.success(`Saved “${name}” to your cloud`, {
        id: saving,
        description: "It keeps the original untouched as its own project.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cloud save failed", { id: saving });
    }
  };

  const needTrack = (fn: (id: string) => void) => () => {
    if (!selected) {
      toast("Select a track first", { description: "Click a track name in the timeline, then try again." });
      return;
    }
    fn(selected.id);
  };

  /** Runs a clip action on the selected track's active clip. */
  const needClip = (fn: (trackId: string, clipId: string) => void) => () => {
    if (!selected) {
      toast("Select a track first", { description: "Click a track name in the timeline, then try again." });
      return;
    }
    const clipId = selected.activeClipId ?? selected.clips?.[0]?.id;
    if (!clipId) {
      toast("No clip on this track", { description: "Click a clip in the timeline first, then try again." });
      return;
    }
    fn(selected.id, clipId);
  };

  /** Native desktop menu — every command below runs the same action as the in-app menu. */
  useDesktopMenu({
    "file:new": () => setStage("start"),
    "file:open": () => setStage("start"),
    "file:save": () => void save(),
    "file:saveas": openSaveAs,
    "file:import-audio": () => importRef.current?.click(),
    "file:import-midi": () => midiRef.current?.click(),
    "file:export": openExport,
    "edit:undo": undo,
    "edit:redo": redo,
    "edit:cut": needTrack((id) => cutTrack(id)),
    "edit:copy": needTrack((id) => copyTrack(id)),
    "edit:paste": pasteTrack,
    "edit:duplicate": needTrack((id) => duplicateTrack(id)),
    "edit:delete": needTrack((id) => removeTrack(id)),
    "edit:selectall": selectAll,
    "edit:split": splitAtPlayhead,
    "transport:play": togglePlay,
    "transport:stop": stop,
    "transport:record": toggleRecord,
    "panel:none": () => setPanel(null),
    "panel:piano": () => setPanel("piano"),
    "panel:mixer": () => setPanel("mixer"),
    "panel:browser": () => setPanel("browser"),
    "panel:keys": () => setPanel("keys"),
    "panel:synth": () => setPanel("synth"),
    "panel:drums": () => setPanel("drums"),
    "panel:sampler": () => setPanel("sampler"),
    "panel:stems": () => setPanel("stems"),
    "panel:voice": () => setPanel("voice"),
    "panel:vocal": () => setPanel("vocal"),
    "panel:coproducer": () => setPanel("coproducer"),
    "panel:bass": () => setPanel("bass"),
    "panel:plugins": () => setPanel("plugins"),
    "panel:appearance": () => setPanel("appearance"),
    "panel:settings": () => setPanel("settings"),
    "track:audio": () => addTrack("audio", "AUDIO"),
    "track:synth": () => addTrack("instrument", "INSTRUMENT", "Cybotron Lead"),
    "track:midi": () => addTrack("midi", "MIDI", "Deep Keys"),
    "track:drum": () => addTrack("drum", "DRUM MACHINE"),
    "track:sampler": () => addTrack("sampler", "SAMPLER", "Metro Pluck"),
    "track:ai-vocal": () => addTrack("ai-vocal", "AI VOCAL", "Vocoder Bot"),
    "help:center": () => openHelp("help"),
    "help:shortcuts": () => setPanel("settings"),
    "help:problem": () => openHelp("problem"),
    "help:about": () => openHelp("about"),
    "app:check-updates": () =>
      toast("You are on SYNCLAB Vocal Forge " + SYNCLAB_VERSION, {
        description: "This build loads the studio over the network, so it is always up to date. Automatic desktop updates arrive with the signed installers.",
      }),
  });


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
            <MenubarItem onClick={() => setStage("start")}>Templates</MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={() => void save()}>
              Save <MenubarShortcut>⌘S</MenubarShortcut>
            </MenubarItem>
            <MenubarItem onClick={openSaveAs}>
              Save As…
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
            <MenubarItem onClick={() => setAbletonOpen(true)}>Ableton Live handoff…</MenubarItem>
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
            <MenubarItem onClick={() => setPanel("live")}>Live View</MenubarItem>
            <MenubarItem onClick={() => setPanel("looper")}>Live Looper</MenubarItem>
            <MenubarItem onClick={() => setPanel("mixer")}>Mixer</MenubarItem>
            <MenubarItem onClick={() => setPanel("reference")}>Reference Analyzer</MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={toggleMode}>
              {mode === "simple" ? "Switch to Advanced Mode" : "Switch to Simple Mode"}
            </MenubarItem>
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
          <MenubarTrigger className="text-xs">Clip</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={splitAtPlayhead}>
              Split at Playhead <MenubarShortcut>S</MenubarShortcut>
            </MenubarItem>
            <MenubarItem onClick={selectAll}>
              Select All <MenubarShortcut>⌘A</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={needClip((t, c) => updateClip(t, c, { fadeIn: 0.25 }))}>Fade In</MenubarItem>
            <MenubarItem onClick={needClip((t, c) => updateClip(t, c, { fadeOut: 0.25 }))}>Fade Out</MenubarItem>
            <MenubarItem onClick={needClip((t, c) => previewClip(t, c))}>Preview Clip</MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={needClip((t, c) => removeClip(t, c))}>Delete Clip</MenubarItem>
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
            <MenubarItem onClick={() => setPanel("sampler")}>Sampler</MenubarItem>
            <MenubarItem onClick={() => setPanel("browser")}>Browser</MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={() => setPanel("plugins")}>Plugin Rack</MenubarItem>
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
            <MenubarItem onClick={() => openHelp("help")}>SYNCLAB Help Center</MenubarItem>
            <MenubarItem onClick={() => openHelp("support")}>Contact SYNCLAB Support</MenubarItem>
            <MenubarItem onClick={() => openHelp("problem")}>Report a Problem</MenubarItem>
            <MenubarItem onClick={() => openHelp("about")}>About SYNCLAB Vocal Forge</MenubarItem>
            <MenubarSeparator />
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
      <button
        type="button"
        onClick={() => setPanel("live")}
        className="ml-2 h-8 shrink-0 rounded-[3px] border border-primary/60 px-3 font-mono text-[10px] font-semibold tracking-widest text-primary uppercase hover:bg-primary hover:text-primary-foreground"
      >
        ● Live
      </button>

      <span className="ml-auto hidden shrink-0 font-mono text-[10px] tracking-widest text-muted-foreground uppercase lg:inline">
        {project ? `${project.name} · ${project.key} · ${project.timeSig}` : "untitled session"} · {mode} mode
      </span>

      <Dialog open={saveAsOpen} onOpenChange={setSaveAsOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save As</DialogTitle>
            <DialogDescription>
              Name this copy of the project. It saves as a new project and keeps the original untouched.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={saveAsName}
            placeholder="Project name"
            aria-label="Project name"
            autoFocus
            maxLength={80}
            onChange={(e) => setSaveAsName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void confirmSaveAs();
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveAsOpen(false)}>Cancel</Button>
            <Button onClick={() => void confirmSaveAs()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AbletonHandoff open={abletonOpen} onOpenChange={setAbletonOpen} />
    </div>
  );
}
