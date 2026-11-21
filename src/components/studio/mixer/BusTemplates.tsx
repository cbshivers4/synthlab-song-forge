import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Layers, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStudio } from "@/lib/synclab/store";
import {
  BUS_TEMPLATES_EVENT,
  FACTORY_BUS_TEMPLATES,
  allBusTemplates,
  isCustomBusId,
  loadUserBusTemplates,
  saveUserBusTemplates,
  templateFromPlugins,
  type BusTemplate,
  type BusTemplateStep,
} from "@/lib/synclab/bus-templates";
import type { CustomBusId, TrackBusId } from "@/lib/synclab/types";
import { cn } from "@/lib/utils";
import { NameEditDialog } from "../NameEditDialog";

export const BUS_SWATCHES = [
  "oklch(0.75 0.19 330)",
  "oklch(0.72 0.2 20)",
  "oklch(0.75 0.19 30)",
  "oklch(0.82 0.17 95)",
  "oklch(0.78 0.18 145)",
  "oklch(0.78 0.16 195)",
  "oklch(0.7 0.16 250)",
  "oklch(0.72 0.18 265)",
];

/** Factory + the producer's own bus templates (saved on this device). */
export function useBusTemplates() {
  const [user, setUser] = useState<BusTemplate[]>([]);
  useEffect(() => {
    const read = () => setUser(loadUserBusTemplates());
    read();
    window.addEventListener(BUS_TEMPLATES_EVENT, read);
    return () => window.removeEventListener(BUS_TEMPLATES_EVENT, read);
  }, []);
  const templates = useMemo(() => allBusTemplates(user), [user]);
  const save = (t: BusTemplate) => {
    const { factory: _f, ...plain } = t;
    saveUserBusTemplates([...user.filter((u) => u.id !== t.id), plain]);
  };
  const remove = (id: string) => saveUserBusTemplates(user.filter((u) => u.id !== id));
  const isEdited = (id: string) =>
    FACTORY_BUS_TEMPLATES.some((f) => f.id === id) && user.some((u) => u.id === id);
  return { templates, save, remove, isEdited };
}

const newTemplateId = () => `my-${Math.random().toString(36).slice(2, 9)}`;

/**
 * Make an effect bus from a template (target unset), or load a template onto an existing bus.
 * The effect list is editable and can be saved back into the template.
 */
export function BusTemplateDialog({
  open,
  onOpenChange,
  target,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** load onto this bus instead of creating a new one */
  target?: TrackBusId;
}) {
  const {
    tracks,
    selectedIds,
    installedPlugins,
    addCustomBus,
    applyBusTemplate,
    busName,
    fxChains,
  } = useStudio();
  const { templates, save, remove, isEdited } = useBusTemplates();
  const [pickedId, setPickedId] = useState("vocal-chain");
  const picked = templates.find((t) => t.id === pickedId) ?? templates[0]!;
  const [steps, setSteps] = useState<BusTemplateStep[]>(picked.effects);
  const [name, setName] = useState(picked.name);
  const [color, setColor] = useState(picked.color);
  const [members, setMembers] = useState<string[]>([]);
  const [naming, setNaming] = useState<null | { kind: "bus" | "template"; value: string }>(null);

  // Opening starts from the Vocal Chain with the highlighted channels ticked.
  useEffect(() => {
    if (!open) return;
    setMembers(selectedIds.filter((id) => tracks.some((t) => t.id === id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const pickedEffects = JSON.stringify(picked.effects);
  useEffect(() => {
    setSteps(JSON.parse(pickedEffects) as BusTemplateStep[]);
  }, [pickedEffects]);
  useEffect(() => {
    setName(picked.name);
    setColor(picked.color);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked.id]);

  const effectNames = useMemo(
    () => [...new Set(installedPlugins.map((d) => d.name))].sort((a, b) => a.localeCompare(b)),
    [installedPlugins],
  );
  const dirty = JSON.stringify(steps) !== JSON.stringify(picked.effects);
  const current: BusTemplate = { ...picked, effects: steps };
  const move = (i: number, by: number) =>
    setSteps((list) => {
      const next = [...list];
      const j = i + by;
      if (j < 0 || j >= next.length) return list;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  const saveChanges = () => {
    save(current);
    toast.success(`${picked.name} template saved`, {
      description: "Saved on this device for your next buses.",
    });
  };
  const saveAsNew = (templateName: string) => {
    const t: BusTemplate = {
      id: newTemplateId(),
      name: templateName.trim() || "My bus",
      description: `${steps.length} effect${steps.length === 1 ? "" : "s"}`,
      color,
      effects: steps,
    };
    save(t);
    setPickedId(t.id);
    toast.success(`${t.name} added to your bus templates`);
  };
  const finish = () => {
    if (target) {
      applyBusTemplate(target, current);
      toast.success(`${current.name} loaded on ${busName(target)}`, {
        description: `${steps.length} effect${steps.length === 1 ? "" : "s"} replace what was on the bus.`,
      });
    } else {
      addCustomBus({ name, color, template: current, memberIds: members });
      toast.success(`${name} bus added`, {
        description: members.length
          ? `${members.length} channel${members.length === 1 ? "" : "s"} now play through it.`
          : "Assign channels with the bus strip's Channels button.",
      });
    }
    onOpenChange(false);
  };
  const replacing = target ? (fxChains[`bus:${target}`] ?? []).length : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="app-menu flex max-h-[90vh] w-[min(96vw,880px)] max-w-none flex-col gap-3 overflow-hidden p-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="size-4" />
              {target ? `Load a template on ${busName(target)}` : "Add an effect bus"}
            </DialogTitle>
            <DialogDescription>
              {target
                ? "Pick a chain of effects for this bus. You can change which effects it uses before loading it."
                : "An effect bus is one fader and one chain of effects shared by every channel you send to it — like a vocal chain for all your vocals."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
            <div role="listbox" aria-label="Bus templates" className="flex flex-col gap-1">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="option"
                  aria-selected={t.id === picked.id}
                  onClick={() => setPickedId(t.id)}
                  className={cn(
                    "flex items-start gap-2 rounded-md border px-2 py-1.5 text-left transition-colors",
                    t.id === picked.id
                      ? "border-primary bg-primary/15"
                      : "border-border hover:bg-muted",
                  )}
                >
                  <span
                    className="mt-1 size-3 shrink-0 rounded-sm"
                    style={{ background: t.color }}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">
                      {t.name}
                      {!t.factory ? " · mine" : isEdited(t.id) ? " · edited" : ""}
                    </span>
                    <span className="block text-[11px] leading-snug text-muted-foreground">
                      {t.effects.length} effect{t.effects.length === 1 ? "" : "s"} · {t.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            <div className="flex min-w-0 flex-col gap-3">
              {!target && (
                <section className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Bus name
                  </span>
                  <span className="text-sm font-bold">{name}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1"
                    onClick={() => setNaming({ kind: "bus", value: name })}
                  >
                    <Pencil className="size-3.5" /> Rename
                  </Button>
                  <div className="ml-auto flex gap-1" role="radiogroup" aria-label="Bus colour">
                    {BUS_SWATCHES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={color === c}
                        aria-label={`Colour ${c}`}
                        onClick={() => setColor(c)}
                        className={cn(
                          "size-6 rounded-sm border-2",
                          color === c ? "border-foreground" : "border-transparent",
                        )}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </section>
              )}

              <section>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Effects, in order
                  </span>
                  <Select
                    value=""
                    onValueChange={(effect) => setSteps((list) => [...list, { effect }])}
                  >
                    <SelectTrigger className="h-8 w-48" aria-label="Add an effect to this template">
                      <SelectValue placeholder="+ Add effect" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {effectNames.map((n) => (
                        <SelectItem key={n} value={n}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {steps.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                    No effects yet — add some, or leave it empty and add effects on the bus later.
                  </p>
                ) : (
                  <ol className="flex flex-col gap-1">
                    {steps.map((s, i) => (
                      <li
                        key={`${s.effect}-${i}`}
                        className="flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1"
                      >
                        <span className="w-5 font-mono text-[11px] text-muted-foreground">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {s.effect}
                          {!installedPlugins.some((d) => d.name === s.effect) && (
                            <span className="ml-1 text-[11px] text-destructive">
                              (not installed — skipped)
                            </span>
                          )}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          aria-label={`Move ${s.effect} up`}
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          aria-label={`Move ${s.effect} down`}
                          disabled={i === steps.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          aria-label={`Remove ${s.effect}`}
                          onClick={() => setSteps((list) => list.filter((_, k) => k !== i))}
                        >
                          <X className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ol>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" disabled={!dirty} onClick={saveChanges}>
                    Save changes to {picked.name}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setNaming({ kind: "template", value: `${picked.name} (mine)` })}
                  >
                    Save as new template…
                  </Button>
                  {(isEdited(picked.id) || !picked.factory) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        remove(picked.id);
                        if (!picked.factory) setPickedId("vocal-chain");
                      }}
                    >
                      {picked.factory ? "Reset to original" : "Delete template"}
                    </Button>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Templates you save stay on this device. Knob settings are fine-tuned on the bus
                  after it&rsquo;s made.
                </p>
              </section>

              {!target && (
                <section>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Channels that play through this bus
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {members.length} picked
                    </span>
                  </div>
                  {tracks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No channels yet.</p>
                  ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1">
                      {tracks.map((t) => {
                        const on = members.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() =>
                              setMembers((m) => (on ? m.filter((x) => x !== t.id) : [...m, t.id]))
                            }
                            className={cn(
                              "flex min-h-10 items-center gap-2 rounded-md border px-2 text-left text-sm",
                              on ? "border-primary bg-primary/15" : "border-border hover:bg-muted",
                            )}
                            style={on ? undefined : { borderLeft: `4px solid ${t.color}` }}
                          >
                            <span className="w-4">{on ? "✓" : ""}</span>
                            <span className="min-w-0 truncate">{t.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            {target && replacing > 0 && (
              <span className="mr-auto self-center text-[11px] text-muted-foreground">
                Replaces the {replacing} effect{replacing === 1 ? "" : "s"} on this bus.
              </span>
            )}
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={finish}>
              {target ? (
                `Load ${picked.name}`
              ) : (
                <>
                  <Plus className="size-4" /> Add {name} bus
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <NameEditDialog
        open={!!naming}
        title={naming?.kind === "bus" ? "Name this bus" : "Name your template"}
        label={naming?.kind === "bus" ? "Bus name" : "Template name"}
        value={naming?.value ?? ""}
        onChange={(value) => setNaming((n) => (n ? { ...n, value } : n))}
        onClose={() => setNaming(null)}
        onSave={() => {
          if (!naming) return;
          if (naming.kind === "bus") setName(naming.value.trim() || name);
          else saveAsNew(naming.value);
          setNaming(null);
        }}
      />
    </>
  );
}

/** "+ Effect bus" button that opens the template dialog. */
export function AddBusButton({
  className,
  label = "+ Effect bus",
}: {
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        className={className}
        onClick={() => setOpen(true)}
        title="Add a bus with its own effect chain (Vocal Chain, Drum Bus…)"
      >
        {label}
      </Button>
      {open && <BusTemplateDialog open={open} onOpenChange={setOpen} />}
    </>
  );
}

/** Bus strip menu: load a template, save the bus as a template, rename or delete a custom bus. */
export function BusTemplateMenu({ id, className }: { id: TrackBusId; className?: string }) {
  const { fxChains, customBuses, removeCustomBus, updateCustomBus, busName } = useStudio();
  const { save } = useBusTemplates();
  const [dialog, setDialog] = useState(false);
  const [naming, setNaming] = useState<null | { kind: "rename" | "template"; value: string }>(null);
  const custom = isCustomBusId(id) ? customBuses.find((b) => b.id === id) : undefined;
  const label = custom?.template ?? "Template";
  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-7 w-full items-center justify-center gap-1 truncate rounded-md bg-surface px-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground hover:text-foreground",
              className,
            )}
            title={`Bus template for ${busName(id)}`}
            aria-label={`Bus template for ${busName(id)}`}
          >
            <Layers className="size-3 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="app-menu w-60 p-1.5" align="start">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-muted"
            onClick={() => setDialog(true)}
          >
            <Layers className="size-4" /> Load a template…
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
            disabled={!(fxChains[`bus:${id}`] ?? []).length}
            onClick={() => setNaming({ kind: "template", value: `${busName(id)} chain` })}
          >
            <Plus className="size-4" /> Save these effects as a template
          </button>
          {custom && (
            <>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-muted"
                onClick={() => setNaming({ kind: "rename", value: custom.name })}
              >
                <Pencil className="size-4" /> Rename bus
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm text-destructive hover:bg-muted"
                onClick={() => {
                  if (
                    !window.confirm(
                      `Delete the ${custom.name} bus? Its channels go straight to the master.`,
                    )
                  )
                    return;
                  removeCustomBus(custom.id as CustomBusId);
                  toast.success(`${custom.name} bus deleted`);
                }}
              >
                <Trash2 className="size-4" /> Delete bus
              </button>
            </>
          )}
        </PopoverContent>
      </Popover>
      {dialog && <BusTemplateDialog open={dialog} onOpenChange={setDialog} target={id} />}
      <NameEditDialog
        open={!!naming}
        title={naming?.kind === "rename" ? "Rename bus" : "Name your template"}
        label={naming?.kind === "rename" ? "Bus name" : "Template name"}
        value={naming?.value ?? ""}
        onChange={(value) => setNaming((n) => (n ? { ...n, value } : n))}
        onClose={() => setNaming(null)}
        onSave={() => {
          if (!naming) return;
          const value = naming.value.trim();
          if (naming.kind === "rename" && custom && value)
            updateCustomBus(custom.id, { name: value });
          if (naming.kind === "template") {
            const t = templateFromPlugins(
              {
                id: newTemplateId(),
                name: value || "My bus",
                description: `Saved from ${busName(id)}`,
                color: custom?.color ?? "oklch(0.78 0.16 195)",
              },
              fxChains[`bus:${id}`] ?? [],
            );
            save(t);
            toast.success(`${t.name} saved to your bus templates`, {
              description: "Saved on this device, with its knob settings.",
            });
          }
          setNaming(null);
        }}
      />
    </>
  );
}

/** Picks which channels play through a bus. */
export function BusAssign({
  id,
  className,
  short,
}: {
  id: TrackBusId;
  className?: string;
  short?: boolean;
}) {
  const { tracks, setBusMembers, busName } = useStudio();
  const members = tracks.filter((t) => t.bus === id).map((t) => t.id);
  const n = members.length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={n ? "outline" : "secondary"}
          size="sm"
          className={cn("h-7 w-full font-mono text-[9px]", className)}
          aria-label={`Choose channels for ${busName(id)} bus`}
          title={`Choose which channels play through the ${busName(id)} bus`}
        >
          {short
            ? n
              ? `${n} CH`
              : "SET"
            : n
              ? `${n} CHANNEL${n > 1 ? "S" : ""}`
              : "ASSIGN CHANNELS"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="app-menu w-60 p-2">
        <div className="mb-1 font-mono text-[10px] font-bold uppercase text-muted-foreground">
          Channels on {busName(id)}
        </div>
        {tracks.length === 0 && <div className="text-xs text-muted-foreground">No tracks yet.</div>}
        {tracks.map((t) => (
          <label
            key={t.id}
            className="flex min-h-8 cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-muted"
          >
            <input
              type="checkbox"
              checked={t.bus === id}
              onChange={(e) =>
                setBusMembers(
                  id,
                  e.target.checked ? [...members, t.id] : members.filter((x) => x !== t.id),
                )
              }
              aria-label={`${t.name} on ${busName(id)}`}
            />
            <span className="truncate">{t.name}</span>
            {t.bus !== id && t.bus !== "master" && (
              <span className="ml-auto truncate font-mono text-[9px] uppercase text-muted-foreground">
                {busName(t.bus)}
              </span>
            )}
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}
