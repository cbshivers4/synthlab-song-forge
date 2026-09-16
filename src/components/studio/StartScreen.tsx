import { useState } from "react";
import { Clock, FolderOpen, Import, LayoutTemplate, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/lib/synclab/app-state";
import { KEYS, TEMPLATES, TIME_SIGS, templateById } from "@/lib/synclab/templates";
import { useStudio } from "@/lib/synclab/store";
import { toast } from "sonner";
import synclabLogoAsset from "@/assets/synclab-logo.jpg.asset.json";

export function StartScreen() {
  const { setStage, setProject, removeRecent, recents } = useApp();
  const { tracks, addTrack, removeTrack, setTransport } = useStudio();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Untitled Project");
  const [templateId, setTemplateId] = useState("empty");
  const [bpm, setBpm] = useState(128);
  const [key, setKey] = useState(KEYS[1] as string);
  const [sig, setSig] = useState(TIME_SIGS[0] as string);

  const openDialog = (tpl: string) => {
    const t = templateById(tpl);
    setTemplateId(tpl);
    if (t) {
      setBpm(t.bpm);
      setKey(t.key);
      setName(t.id === "empty" ? "Untitled Project" : t.name);
    }
    setOpen(true);
  };

  const create = () => {
    for (const t of tracks) removeTrack(t.id);
    const tpl = templateById(templateId);
    for (const t of tpl?.tracks ?? []) addTrack(t.kind, t.name, t.preset);
    setTransport({ bpm, playing: false, recording: false, step: 0 });
    setProject({ name, bpm, key, timeSig: sig, template: templateId, openedAt: Date.now() });
    setOpen(false);
    setStage("studio");
    toast.success(`${name} is open`, {
      description: `${bpm} BPM · ${key} · ${sig}${tpl && tpl.tracks.length ? ` · ${tpl.tracks.length} tracks` : ""}`,
    });
  };

  return (
    <div className="min-h-screen overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-5xl px-5 py-12">
        <div className="flex items-center gap-3">
          <img src={synclabLogoAsset.url} alt="SYNCLAB" className="h-10 w-auto rounded object-cover" />
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight">Start a session</h1>
            <p className="text-xs text-muted-foreground">Pick where you want to begin. Everything happens on one screen after this.</p>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Action icon={<Plus className="size-4" />} title="New empty project" body="A blank timeline." onClick={() => openDialog("empty")} />
          <Action icon={<LayoutTemplate className="size-4" />} title="Choose template" body="Start with tracks ready." onClick={() => document.getElementById("tpl")?.scrollIntoView({ behavior: "smooth" })} />
          <Action
            icon={<Import className="size-4" />}
            title="Import song"
            body="Bring an instrumental in."
            onClick={() => {
              setStage("studio");
              toast("Import from the studio", { description: "Use File → Import Audio, or drag a file onto the timeline." });
            }}
          />
          <Action
            icon={<Sparkles className="size-4" />}
            title="Start with AI"
            body="Describe the track you want."
            onClick={() =>
              toast("AI project start is coming in the AI stage", {
                description: "The AI Co-Producer needs its backend before it can build a project for you.",
              })
            }
          />
          <Action
            icon={<FolderOpen className="size-4" />}
            title="Open project"
            body="Saved projects need an account."
            onClick={() =>
              toast("Saved projects arrive with accounts", { description: "Cloud project storage is the next stage." })
            }
          />
          <Action
            icon={<Clock className="size-4" />}
            title="Continue in studio"
            body="Keep the current session."
            onClick={() => setStage("studio")}
          />
        </div>

        {recents.length > 0 && (
          <section className="mt-10">
            <h2 className="label-xs">Recent</h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {recents.map((r) => (
                <button
                  key={`${r.name}-${r.openedAt}`}
                  onClick={() => {
                    setProject(r);
                    setStage("studio");
                  }}
                  className="panel p-3 text-left transition-colors hover:bg-surface-2"
                >
                  <div className="font-display text-sm font-semibold">{r.name}</div>
                  <div className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                    {r.bpm} BPM · {r.key} · {r.timeSig}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        <section id="tpl" className="mt-10">
          <h2 className="label-xs">Templates</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => openDialog(t.id)}
                className="panel p-3 text-left transition-colors hover:bg-surface-2"
              >
                <div className="font-display text-sm font-semibold tracking-wide">{t.name}</div>
                <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                <div className="mt-2 font-mono text-[10px] tracking-widest text-primary uppercase">
                  {t.bpm} BPM · {t.key} · {t.tracks.length} tracks
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display tracking-wide">New project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label className="label-xs">Project name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="label-xs">BPM</Label>
                <Input type="number" min={40} max={220} value={bpm} onChange={(e) => setBpm(Number(e.target.value) || 120)} />
              </div>
              <div className="grid gap-1.5">
                <Label className="label-xs">Key</Label>
                <Select value={key} onValueChange={setKey}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {KEYS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="label-xs">Time signature</Label>
                <Select value={sig} onValueChange={setSig}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIME_SIGS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="label-xs">Template</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEMPLATES.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="glow" onClick={create}>OPEN STUDIO</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Action({ icon, title, body, onClick }: { icon: React.ReactNode; title: string; body: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="panel flex gap-3 p-4 text-left transition-colors hover:bg-surface-2">
      <span className="mt-0.5 text-primary">{icon}</span>
      <div>
        <div className="font-display text-sm font-semibold tracking-wide">{title}</div>
        <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      </div>
    </button>
  );
}
