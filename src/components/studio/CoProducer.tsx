import { useEffect, useRef, useState } from "react";
import { Bot, Copy, Send } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { AiUsesLeft, announceAiUse } from "./AiUsesLeft";
import { Button } from "@/components/ui/button";
import { usePreviewTrack } from "@/lib/synclab/use-preview-track";
import { PreviewButtons } from "./PreviewButtons";
import { PatternWaveform } from "./PatternWaveform";
import { useStudio } from "@/lib/synclab/store";
import { askCoProducerFn } from "@/utils/co-producer.functions";
type CoProducerResult = Extract<Awaited<ReturnType<typeof askCoProducerFn>>, { ok: true }>["result"];
import { getBeatsPerBar } from "@/lib/synclab/timebase";

type Msg = { role: "user" | "ai"; text: string; result?: CoProducerResult; added?: boolean };
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const IDEAS = ["Write me a verse and a hook", "Write lyrics about my city", "Give me a 4-bar chord progression", "Write a bassline for my song", "Make a trap drum pattern", "How can I make my mix sound bigger?"];

export function CoProducer() {
  const { tracks, transport, addTrack, updateTrack } = useStudio();
  const ask = useServerFn(askCoProducerFn);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ id: string; r: CoProducerResult; steps: number } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ block: "nearest" }), [msgs]);

  useEffect(() => {
    const p = pending.current;
    const t = p && tracks.find((x) => x.id === p.id);
    if (!p || !t?.pads) return;
    pending.current = null;
    updateTrack(p.id, {
      steps: p.steps,
      pads: t.pads.map((pad) => {
        const steps = new Array(p.steps).fill(0);
        p.r.drumHits.forEach((h) => { if (h.kind === pad.kind && h.step >= 0 && h.step < p.steps) steps[Math.round(h.step)] = Math.max(0.1, Math.min(1, h.velocity)); });
        return { ...pad, steps };
      }),
    });
  }, [tracks, updateTrack]);

  const songSummary = () => {
    const pcs = new Array(12).fill(0);
    tracks.forEach((t) => t.notes?.forEach((n) => pcs[n.pitch % 12]++));
    const used = pcs.map((c, i) => (c ? NAMES[i] : null)).filter(Boolean).join(" ");
    return [
      `Tempo ${transport.bpm} BPM, ${getBeatsPerBar()}/4.`,
      used ? `Notes used: ${used}.` : "No notes written yet.",
      `Tracks: ${tracks.map((t) => {
        const fx = (t.plugins ?? []).filter((p) => !p.bypass).map((p) => p.name).join("/");
        return `${t.name} (${t.kind}${t.notes?.length ? `, ${t.notes.length} notes` : ""}${t.clips?.length ? `, ${t.clips.length} clips` : ""}, fader ${Math.round(t.volume * 100)}%, pan ${Math.round(t.pan * 100)}${t.muted ? ", muted" : ""}${fx ? `, effects: ${fx}` : ", no effects"})`;
      }).join("; ") || "none"}.`,
    ].join("\n").slice(0, 3800);
  };

  const send = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    setText("");
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setBusy(true);
    try {
      const res = await ask({ data: { question, song: songSummary() } });
      announceAiUse();
      if (res.ok) setMsgs((m) => [...m, { role: "ai", text: res.result.reply, result: res.result }]);
      else { setMsgs((m) => [...m, { role: "ai", text: res.error }]); }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      const auth = /unauthor|401|sign in|jwt|session/i.test(msg);
      setMsgs((m) => [...m, { role: "ai", text: auth ? "Sign in to use the co-producer, then try again." : `The co-producer couldn't answer${msg ? `: ${msg}` : ""}. Check your connection and try again.` }]);
    } finally { setBusy(false); }
  };

  const pv = usePreviewTrack();
  const [pvIndex, setPvIndex] = useState<number | null>(null);
  const build = (r: CoProducerResult, name: string) => {
    const bar = getBeatsPerBar() * 4;
    const last = r.kind === "drums" ? Math.max(0, ...r.drumHits.map((h) => h.step)) : Math.max(0, ...r.notes.map((n) => n.step + n.length - 1));
    const steps = Math.min(bar * 8, Math.max(bar, Math.ceil((last + 1) / bar) * bar));
    if (r.kind === "drums") {
      const id = addTrack("drum", name, undefined, { keepPanel: true });
      pending.current = { id, r, steps };
      return id;
    }
    const id = addTrack("instrument", name, undefined, { keepPanel: true });
    updateTrack(id, {
      steps,
      notes: r.notes.filter((n) => n.step >= 0 && n.step < steps).map((n, k) => ({
        id: `cp-${Date.now()}-${k}`, step: Math.round(n.step), length: Math.max(1, Math.round(n.length)),
        pitch: Math.max(0, Math.min(127, Math.round(n.pitch))), velocity: Math.max(0.1, Math.min(1, n.velocity)),
      })),
    });
    return id;
  };
  const nameOf = (r: CoProducerResult) => (r.trackName || "CO-PRODUCER").slice(0, 24);
  const preview = (i: number) => {
    const r = msgs[i]?.result;
    if (!r) return;
    pv.start((n) => build(r, n(nameOf(r))));
    setPvIndex(i);
  };
  const add = (i: number) => {
    const r = msgs[i]?.result;
    if (!r) return;
    const name = nameOf(r);
    if (!(pvIndex === i && pv.keep(name))) build(r, name);
    if (pvIndex !== i) pv.stop();
    setPvIndex(null);
    setMsgs((m) => m.map((x, k) => (k === i ? { ...x, added: true } : x)));
    toast.success(`${name} added to the timeline`);
  };

  return (
    <section className="flex min-h-[420px] flex-col gap-3 rounded-md border border-border bg-surface-1 p-4">
      <header className="flex items-center gap-2">
        <Bot className="size-5 text-primary" />
        <div>
          <h2 className="font-mono text-sm font-bold tracking-[0.18em]">AI CO-PRODUCER</h2>
          <p className="text-xs text-muted-foreground">Ask for ideas, chords, basslines or drum patterns. It reads your tempo, notes, track list, effects and fader/pan/mute settings — not the audio itself. Ideas play as a preview before you add them.</p>
          <AiUsesLeft />
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {msgs.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {IDEAS.map((q) => (
              <button key={q} type="button" onClick={() => void send(q)} className="min-h-11 rounded-md border border-border px-3 text-left text-xs text-muted-foreground hover:border-primary hover:text-foreground">{q}</button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "ml-auto max-w-[85%] rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground" : "max-w-[95%] text-sm"}>
            <p className="whitespace-pre-wrap">{m.text}</p>
            {m.result?.lyrics && (
              <div className="mt-2 rounded-md border border-border bg-surface-2 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold tracking-widest text-muted-foreground">LYRICS</span>
                  <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard?.writeText(m.result!.lyrics).then(() => toast.success("Lyrics copied")); }}>
                    <Copy className="size-3.5" /> Copy
                  </Button>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.result.lyrics}</p>
              </div>
            )}
            {m.result && m.result.kind !== "none" && (m.result.notes.length > 0 || m.result.drumHits.length > 0) && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-2 p-2 font-mono text-xs">
                <PatternWaveform bpm={transport.bpm} label="Co-producer pattern waveform" pattern={{ notes: m.result.kind === "drums" ? undefined : m.result.notes, hits: m.result.kind === "drums" ? m.result.drumHits : undefined, steps: Math.min(getBeatsPerBar() * 32, Math.max(getBeatsPerBar() * 4, Math.ceil((Math.max(0, ...m.result.notes.map((n) => n.step + n.length - 1), ...m.result.drumHits.map((h) => h.step)) + 1) / (getBeatsPerBar() * 4)) * getBeatsPerBar() * 4)) }} />
                <span className="flex-1">{m.result.trackName} · {m.result.kind === "drums" ? `${m.result.drumHits.length} hits` : `${m.result.notes.length} notes`}</span>
                {m.added ? <Button size="sm" disabled>Added</Button> : <PreviewButtons size="sm" pv={{ ...pv, stop: () => { pv.stop(); setPvIndex(null); } }} active={pv.previewing && pvIndex === i} onPreview={() => preview(i)} onAdd={() => add(i)} addLabel="Add to project" />}
              </div>
            )}
          </div>
        ))}
        {busy && <p className="animate-pulse text-xs text-muted-foreground">Co-producer is thinking…</p>}
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void send(text); }} className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Ask your co-producer…" className="min-h-12 flex-1 rounded-md border border-border bg-surface-2 px-3 text-sm" />
        <Button type="submit" size="lg" className="min-h-12" disabled={busy || !text.trim()} aria-label="Send"><Send className="size-4" /></Button>
      </form>
    </section>
  );
}
