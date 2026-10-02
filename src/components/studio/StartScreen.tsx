import { useEffect, useMemo, useState } from "react";
import {
  AudioWaveform, Cloud, Copy, Disc3, Drum, FileMusic, Flame, FolderOpen, Guitar, Heart, Home,
  Import, LayoutTemplate, Loader2, LogOut, Mic, Pencil, Plus, Radio, Sparkles, Square, Star, Trash2, Waves, Zap,
} from "lucide-react";
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
import { deleteCloudProject, listCloudProjects, loadCloudProject, renameCloudProject, saveCloudProject, type CloudProject } from "@/lib/synclab/cloud";
import { supabase } from "@/integrations/supabase/client";

const FAVS_KEY = "synclab.start.favs";

function loadFavs(): string[] {
  try {
    const raw = localStorage.getItem(FAVS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function hashOf(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

function relTime(ts: number) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  empty: <Square className="size-5" />,
  "detroit-techno": <Zap className="size-5" />,
  "detroit-electro": <Radio className="size-5" />,
  "ghetto-tech": <Flame className="size-5" />,
  house: <Home className="size-5" />,
  "deep-house": <Waves className="size-5" />,
  "hip-hop": <Disc3 className="size-5" />,
  trap: <Drum className="size-5" />,
  rnb: <Heart className="size-5" />,
  pop: <Star className="size-5" />,
  rock: <Guitar className="size-5" />,
  ambient: <Cloud className="size-5" />,
  podcast: <Mic className="size-5" />,
  vocal: <AudioWaveform className="size-5" />,
};

export function StartScreen() {
  const { setStage, setProject, setSignedIn, removeRecent, renameRecent, recents } = useApp();
  const { tracks, addTrack, removeTrack, setTransport, restore, setPanel } = useStudio();
  const [cloud, setCloud] = useState<CloudProject[]>([]);
  const [templates, setTemplates] = useState<UserTemplate[]>([]);
  const [cloudBusy, setCloudBusy] = useState<string | null>(null);
  const [favs, setFavs] = useState<string[]>(loadFavs);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Untitled Project");
  const [templateId, setTemplateId] = useState("empty");
  const [bpm, setBpm] = useState(128);
  const [key, setKey] = useState(KEYS[1] as string);
  const [sig, setSig] = useState(TIME_SIGS[0] as string);
  const [rename, setRename] = useState<{ kind: "cloud"; item: CloudProject } | { kind: "recent"; item: (typeof recents)[number] } | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);

  const toggleFav = (id: string) => {
    setFavs((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem(FAVS_KEY, JSON.stringify(next)); } catch { /* storage full/blocked */ }
      return next;
    });
  };

  const sortedCloud = useMemo(
    () => [...cloud].sort((a, b) => Number(favs.includes(`cloud:${b.id}`)) - Number(favs.includes(`cloud:${a.id}`)) || b.updatedAt - a.updatedAt),
    [cloud, favs],
  );

  const openRename = (target: NonNullable<typeof rename>) => {
    setRename(target);
    setRenameName(target.item.name);
  };

  const confirmRename = async () => {
    if (!rename) return;
    const name = renameName.trim();
    if (!name) {
      toast.error("Give it a name first");
      return;
    }
    setRenameBusy(true);
    try {
      if (rename.kind === "cloud") {
        await renameCloudProject(rename.item.id, name);
        setCloud((items) => items.map((p) => (p.id === rename.item.id ? { ...p, name } : p)));
        toast.success(`Renamed to “${name}”`);
      } else {
        renameRecent(rename.item, name);
        toast.success(`Renamed to “${name}”`);
      }
      setRename(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not rename project");
    } finally {
      setRenameBusy(false);
    }
  };

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

  const duplicateCloud = async (item: CloudProject) => {
    setCloudBusy(item.id);
    try {
      const loaded = await loadCloudProject(item.id);
      if (!loaded.session) throw new Error("This project has no saved session.");
      await saveCloudProject(
        { id: "", name: `${loaded.name} copy`, bpm: loaded.bpm, key: loaded.key, timeSig: loaded.timeSig, template: loaded.template, openedAt: Date.now() },
        loaded.session,
      );
      setCloud(await listCloudProjects());
      toast.success(`Duplicated as “${loaded.name} copy”`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not duplicate project");
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

  const importHint = (what: string, where: string) => {
    setStage("studio");
    toast(`Import ${what} from the studio`, { description: where });
  };

  return (
    <div className="min-h-screen overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-6xl px-5 py-10">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <img src={synclabLogoAsset.url} alt="SYNCLAB" className="h-10 w-auto rounded object-cover" />
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold tracking-tight">Projects</h1>
            <p className="text-xs text-muted-foreground">Open a recent session or start something new.</p>
          </div>
          <Button
            variant="outline"
            className="min-h-11 gap-2"
            onClick={() => void supabase.auth.signOut().then(() => { setSignedIn(false); setStage("welcome"); })}
          >
            <LogOut className="size-4" /> <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Action icon={<Plus className="size-4" />} title="New Project" body="Blank timeline." onClick={() => openDialog("empty")} />
          <Action icon={<FolderOpen className="size-4" />} title="Open Project" body={cloud.length ? `${cloud.length} in your cloud.` : "Your saved projects."} onClick={() => document.getElementById("recent-projects")?.scrollIntoView({ behavior: "smooth" })} />
          <Action icon={<Import className="size-4" />} title="Import Audio" body="Bring a file in." onClick={() => importHint("audio", "Use File → Import Audio, or drag a file onto the timeline.")} />
          <Action icon={<FileMusic className="size-4" />} title="Import MIDI" body="Standard MIDI files." onClick={() => importHint("MIDI", "Use Tools → Ableton Handoff to import a .mid file onto a track.")} />
        </div>

        <section id="recent-projects" className="mt-10">
          <div className="flex items-center gap-2">
            <Cloud className="size-4 text-primary" />
            <h2 className="label-xs">Recent projects</h2>
          </div>
          {cloud.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No cloud projects yet. Open a session and choose File → Save.</p>
          ) : (
            <div className="mt-3 divide-y divide-border border-y border-border">
              {sortedCloud.map((item) => {
                const fav = favs.includes(`cloud:${item.id}`);
                return (
                  <div key={item.id} className="group flex min-h-16 items-center gap-2 py-2">
                    <Button variant="ghost" className="min-w-0 flex-1 justify-start gap-3 px-2 text-left h-auto py-2" onClick={() => void openCloud(item)} disabled={cloudBusy !== null}>
                      <span className="flex size-9 shrink-0 items-center justify-center rounded bg-primary/10 text-primary"><FolderOpen className="size-4" /></span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-display text-sm font-semibold">
                          {cloudBusy === item.id && <Loader2 className="size-3.5 animate-spin" />}{item.name}
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                          {item.bpm} BPM · {item.key} · {item.timeSig}{item.trackCount ? ` · ${item.trackCount} tracks` : ""}
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] tracking-widest text-muted-foreground/70 uppercase">
                          Modified {relTime(item.updatedAt)}
                        </div>
                      </div>
                    </Button>
                    <div className="flex shrink-0 gap-1">
                      <IconBtn label={`Favorite ${item.name}`} title={fav ? "Unfavorite" : "Favorite"} onClick={() => toggleFav(`cloud:${item.id}`)} active={fav}>
                        <Star className={`size-3.5 ${fav ? "fill-primary text-primary" : ""}`} />
                      </IconBtn>
                      <IconBtn label={`Rename ${item.name}`} title="Rename" onClick={() => openRename({ kind: "cloud", item })}>
                        <Pencil className="size-3.5" />
                      </IconBtn>
                      <IconBtn label={`Duplicate ${item.name}`} title="Duplicate" onClick={() => void duplicateCloud(item)}>
                        <Copy className="size-3.5" />
                      </IconBtn>
                      <IconBtn
                        label={`Delete ${item.name}`}
                        title="Delete"
                        danger
                        onClick={() => {
                          setCloudBusy(item.id);
                          void deleteCloudProject(item)
                            .then(() => { setCloud((items) => items.filter((p) => p.id !== item.id)); toast.success("Cloud project deleted"); })
                            .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not delete project"))
                            .finally(() => setCloudBusy(null));
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </IconBtn>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {recents.length > 0 && (
          <section className="mt-10">
            <h2 className="label-xs">On this device</h2>
            <div className="mt-3 divide-y divide-border border-y border-border">
              {recents.map((r) => {
                const id = `recent:${r.name}-${r.openedAt}`;
                const fav = favs.includes(id);
                return (
                  <div key={id} className="group flex min-h-14 items-center gap-2 py-2 text-left transition-colors hover:bg-surface-2">
                    <button
                      onClick={() => { setProject(r); setStage("studio"); }}
                      className="min-w-0 flex-1 text-left px-2"
                    >
                      <div className="font-display text-sm font-semibold">{r.name}</div>
                      <div className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                        {r.bpm} BPM · {r.key} · {r.timeSig} · opened {relTime(r.openedAt)}
                      </div>
                    </button>
                    <div className="flex shrink-0 gap-1">
                      <IconBtn label={`Favorite ${r.name}`} title={fav ? "Unfavorite" : "Favorite"} onClick={() => toggleFav(id)} active={fav}>
                        <Star className={`size-3.5 ${fav ? "fill-primary text-primary" : ""}`} />
                      </IconBtn>
                      <IconBtn label={`Rename ${r.name}`} title="Rename" onClick={() => openRename({ kind: "recent", item: r })}>
                        <Pencil className="size-3.5" />
                      </IconBtn>
                      <IconBtn label={`Remove ${r.name}`} title="Remove from list" danger onClick={() => removeRecent(r)}>
                        <Trash2 className="size-3.5" />
                      </IconBtn>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {templates.length > 0 && (
          <section className="mt-10">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="size-4 text-primary" />
              <h2 className="label-xs">Your templates</h2>
            </div>
            <div className="mt-3 divide-y divide-border border-y border-border">
              {templates.map((tpl) => (
                <div key={tpl.id} className="group flex min-h-14 items-center gap-2 py-2">
                  <Button variant="ghost" className="min-w-0 flex-1 justify-start text-left h-auto px-2" onClick={() => openTemplate(tpl)}>
                    <div className="font-display text-sm font-semibold">{tpl.name}</div>
                    <div className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                      {tpl.bpm} BPM · {tpl.trackCount} tracks
                    </div>
                  </Button>
                  <IconBtn
                    label={`Delete template ${tpl.name}`}
                    title="Delete template"
                    danger
                    className="shrink-0"
                    onClick={() => {
                      removeUserTemplate(tpl.id);
                      setTemplates(listUserTemplates());
                      toast.success("Template deleted");
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </IconBtn>
                </div>
              ))}
            </div>
          </section>
        )}

        <section id="tpl" className="mt-10">
          <h2 className="label-xs">Templates</h2>
          <div className="mt-3 divide-y divide-border border-y border-border">
            {TEMPLATES.map((t) => {
              return (
                <Button key={t.id} variant="ghost" onClick={() => openDialog(t.id)}
                  className="flex h-auto min-h-16 w-full items-center justify-start gap-3 rounded-none px-2 py-3 text-left">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">{TEMPLATE_ICONS[t.id] ?? <LayoutTemplate className="size-5" />}</span>
                  <span className="min-w-0 flex-1"><span className="block font-display text-sm font-semibold">{t.name}</span><span className="block truncate text-xs text-muted-foreground">{t.description}</span></span>
                  <span className="hidden shrink-0 font-mono text-[10px] text-muted-foreground sm:block">{t.bpm} BPM · {t.key} · {t.tracks.length} tracks</span>
                </Button>
              );
            })}
          </div>
        </section>

        <section className="mt-10">
          <button
            onClick={() => { setStage("studio"); setPanel("coproducer"); toast("Co-Producer open", { description: "Describe the track you want and it will plan it with you." }); }}
            className="panel flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-surface-2"
          >
            <span className="text-primary"><Sparkles className="size-4" /></span>
            <div>
              <div className="font-display text-sm font-semibold tracking-wide">Start with AI</div>
              <p className="mt-1 text-xs text-muted-foreground">Describe the track you want and let the Co-Producer plan it.</p>
            </div>
          </button>
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

      <Dialog open={rename !== null} onOpenChange={(v) => { if (!v) setRename(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display tracking-wide">Rename project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label className="label-xs">Project name</Label>
            <Input
              aria-label="Project name"
              autoFocus
              maxLength={80}
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void confirmRename(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRename(null)}>Cancel</Button>
            <Button className="glow" disabled={renameBusy} onClick={() => void confirmRename()}>
              {renameBusy && <Loader2 className="size-4 animate-spin" />} Rename
            </Button>
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

function IconBtn({ label, title, onClick, danger, active, className = "", children }: {
  label: string;
  title: string;
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`rounded bg-background/70 p-1.5 backdrop-blur-sm transition-colors ${
        danger ? "text-muted-foreground hover:bg-destructive/15 hover:text-destructive" : active ? "text-primary hover:bg-surface-2" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
      } ${className}`}
    >
      {children}
    </button>
  );
}
