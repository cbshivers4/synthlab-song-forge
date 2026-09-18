import { useEffect, useState } from "react";
import { Cloud, Clock, FolderOpen, Import, LayoutTemplate, Loader2, LogOut, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/lib/synclab/app-state";
import { KEYS, TEMPLATES, TIME_SIGS, templateById } from "@/lib/synclab/templates";
import { useStudio } from "@/lib/synclab/store";
import { toast } from "sonner";
import synclabLogoAsset from "@/assets/synclab-logo-neon.jpg.asset.json";
import { listUserTemplates, removeUserTemplate, type UserTemplate } from "@/lib/synclab/user-templates";
import { deleteCloudProject, listCloudProjects, loadCloudProject, type CloudProject } from "@/lib/synclab/cloud";
import { supabase } from "@/integrations/supabase/client";

export function StartScreen() {
  const { setStage, setProject, setSignedIn, removeRecent, recents } = useApp();
  const { tracks, addTrack, removeTrack, setTransport, restore, setPanel } = useStudio();
  const [cloud, setCloud] = useState<CloudProject[]>([]);
  const [templates, setTemplates] = useState<UserTemplate[]>([]);
  const [cloudBusy, setCloudBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Untitled Project");
  const [templateId, setTemplateId] = useState("empty");
  const [bpm, setBpm] = useState(128);
  const [key, setKey] = useState(KEYS[1] as string);
  const [sig, setSig] = useState(TIME_SIGS[0] as string);

  useEffect(() => {
    void listCloudProjects().then(setCloud).catch(() => setCloud([]));
    setTemplates(listUserTemplates());
  }, []);

  const openTemplate = (tpl: UserTemplate) => {
    restore(tpl.session);
    setProject({
      name: `${tpl.name} copy`,
      bpm: tpl.bpm,
      key: "A Minor",
      timeSig: "4/4",
      template: tpl.id,
      openedAt: Date.now(),
    });
    setStage("studio");
    toast.success(`Started from “${tpl.name}”`);
  };

  const openCloud = async (item: CloudProject) => {
    setCloudBusy(item.id);
    try {
      const loaded = await loadCloudProject(item.id);
      if (!loaded.session) throw new Error("This project has no saved session.");
      restore(loaded.session);
      setProject({ id: loaded.id, name: loaded.name, bpm: loaded.bpm, key: loaded.key, timeSig: loaded.timeSig, template: loaded.template, openedAt: Date.now() });
      setStage("studio");
      toast.success(`${loaded.name} opened from your cloud`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open cloud project");
    } finally {
      setCloudBusy(null);
    }
  };

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
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <img src={synclabLogoAsset.url} alt="SYNCLAB" className="h-10 w-auto rounded object-cover" />
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight">Start a session</h1>
            <p className="text-xs text-muted-foreground">Pick where you want to begin. Everything happens on one screen after this.</p>
          </div>
          <Button
            variant="outline"
            className="min-h-11 gap-2"
            onClick={() => void supabase.auth.signOut().then(() => { setSignedIn(false); setStage("welcome"); })}
          >
            <LogOut className="size-4" /> <span className="hidden sm:inline">Sign out</span>
          </Button>
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
            onClick={() => {
              setStage("studio");
              setPanel("coproducer");
              toast("Co-Producer open", { description: "Describe the track you want and it will plan it with you." });
            }}
          />
          <Action
            icon={<FolderOpen className="size-4" />}
            title="Open project"
            body={cloud.length ? `${cloud.length} saved in your cloud.` : "Open a saved cloud project."}
            onClick={() => document.getElementById("cloud-projects")?.scrollIntoView({ behavior: "smooth" })}
          />
          <Action
            icon={<Clock className="size-4" />}
            title="Continue in studio"
            body="Keep the current session."
            onClick={() => setStage("studio")}
          />
        </div>

        <section id="cloud-projects" className="mt-10">
          <div className="flex items-center gap-2">
            <Cloud className="size-4 text-primary" />
            <h2 className="label-xs">Your cloud projects</h2>
          </div>
          {cloud.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No cloud projects yet. Open a session and choose File → Save.</p>
          ) : (
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {cloud.map((item) => (
                <div key={item.id} className="group panel relative p-3">
                  <button className="block w-full text-left" onClick={() => void openCloud(item)} disabled={cloudBusy !== null}>
                    <div className="flex items-center gap-2 font-display text-sm font-semibold">
                      {cloudBusy === item.id && <Loader2 className="size-3.5 animate-spin" />}{item.name}
                    </div>
                    <div className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                      {item.bpm} BPM · {item.key} · {item.timeSig}
                    </div>
                  </button>
                  <button
                    aria-label={`Delete cloud project ${item.name}`}
                    title="Delete cloud project"
                    className="absolute right-2 top-2 rounded p-1 text-muted-foreground opacity-0 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                    onClick={() => {
                      setCloudBusy(item.id);
                      void deleteCloudProject(item)
                        .then(() => { setCloud((items) => items.filter((p) => p.id !== item.id)); toast.success("Cloud project deleted"); })
                        .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not delete project"))
                        .finally(() => setCloudBusy(null));
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {templates.length > 0 && (
          <section className="mt-10">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="size-4 text-primary" />
              <h2 className="label-xs">Your templates</h2>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((tpl) => (
                <div key={tpl.id} className="group panel relative p-3">
                  <button className="block w-full text-left" onClick={() => openTemplate(tpl)}>
                    <div className="font-display text-sm font-semibold">{tpl.name}</div>
                    <div className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                      {tpl.bpm} BPM · {tpl.trackCount} tracks
                    </div>
                  </button>
                  <button
                    aria-label={`Delete template ${tpl.name}`}
                    title="Delete template"
                    onClick={() => {
                      removeUserTemplate(tpl.id);
                      setTemplates(listUserTemplates());
                      toast.success("Template deleted");
                    }}
                    className="absolute right-2 top-2 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {recents.length > 0 && (
          <section className="mt-10">
            <h2 className="label-xs">Recent</h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {recents.map((r) => (
                <div
                  key={`${r.name}-${r.openedAt}`}
                  className="group panel relative p-3 text-left transition-colors hover:bg-surface-2"
                >
                  <button
                    onClick={() => {
                      setProject(r);
                      setStage("studio");
                    }}
                    className="block w-full"
                  >
                    <div className="font-display text-sm font-semibold">{r.name}</div>
                    <div className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                      {r.bpm} BPM · {r.key} · {r.timeSig}
                    </div>
                  </button>
                  <button
                    aria-label={`Delete recent project ${r.name}`}
                    title="Remove from recent"
                    onClick={() => removeRecent(r)}
                    className="absolute top-2 right-2 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
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
