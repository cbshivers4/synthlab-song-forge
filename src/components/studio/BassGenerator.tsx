import { SkinControls, skinBackground, useImageDrop } from "@/components/studio/SkinControls";
import { useSkin } from "@/lib/synclab/skins";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePreviewTrack } from "@/lib/synclab/use-preview-track";
import { PreviewButtons } from "./PreviewButtons";
import { PatternWaveform } from "./PatternWaveform";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/synclab/store";
import { getBeatsPerBar, stepSeconds } from "@/lib/synclab/timebase";
import { fitBassline, songContentBars } from "@/lib/synclab/bass-fit";
import { SYNTH_PRESETS, applyPreset } from "@/lib/synclab/presets";
import { getEngine } from "@/lib/synclab/audio-engine";
import { useLoopPreview } from "@/lib/synclab/use-loop-preview";
import { activeSongClock } from "@/lib/synclab/song-clock";
import { useIsLandscapePhone } from "@/hooks/use-mobile";
import { Copy, Dices, Play, RotateCcw, Square, Trash2 } from "lucide-react";
import { cleanBassPatch, NOTE_NAMES, PROGRESSIONS, rootsFromKey, rootsFromTracks } from "@/lib/synclab/bass-gen";
import {
  BLG_GENRES, BLG_PRESETS, BLG_RATES, blgNotes, clampSteps, currentLine, defaultBlgPattern, presetPattern, randomLane, randomizeBlg, rateLen,
  type BlgPattern, type BlgRate,
} from "@/lib/synclab/bassline-player";
import { BlgDiamond, BlgLanePanel, BlgNoteDisplay, BlgStepper } from "./BasslineParts";

const BASS_SOUNDS = SYNTH_PRESETS.filter((p) => p.category === "Bass").map((p) => p.name);
const SLOTS = 8;

interface Session {
  slots: BlgPattern[]; slot: number; names: (string | null)[]; octave: number; sound: string; bars: number;
  follow: boolean; minorKey: boolean; prog: string;
}
// Kept for this visit to the studio so switching panels doesn't lose your patterns (not saved in the project).
let session: Session | null = null;
const freshSession = (): Session => {
  const first = BLG_PRESETS.find((p) => p.id === "detroit-strings")!;
  return {
    slots: Array.from({ length: SLOTS }, (_, i) => (i === 0 ? presetPattern(first) : defaultBlgPattern(first.pattern.root))),
    slot: 0, names: Array.from({ length: SLOTS }, (_, i) => (i === 0 ? first.label : null)), octave: first.octave, sound: first.sound, bars: 4,
    follow: false, minorKey: true, prog: "1-1-1-1",
  };
};

export function BassGenerator() {
  const skin = useSkin("bass");
  const skinDrop = useImageDrop("bass");
  const skinned = !!(skin.image || skin.color);
  const { tracks, transport, addTrack, updateTrack, setTransport } = useStudio();
  const barSteps = getBeatsPerBar() * 4;
  const [s, setS] = useState<Session>(() => session ?? freshSession());
  useEffect(() => { session = s; }, [s]);
  const pat = s.slots[s.slot]!;
  const set = (patch: Partial<Session>) => setS((cur) => ({ ...cur, ...patch }));
  /** Change the current pattern. Generator moves replace hand edits; `keepEdits` is for note-display edits. */
  const setPat = (patch: Partial<BlgPattern>, keepEdits = false) =>
    setS((cur) => {
      const slots = cur.slots.slice();
      const p = slots[cur.slot]!;
      slots[cur.slot] = { ...p, ...patch, edits: keepEdits || "edits" in patch ? (patch.edits ?? (keepEdits ? p.edits : null)) : null };
      return { ...cur, slots };
    });

  const detected = useMemo(() => rootsFromTracks(tracks, s.bars, barSteps), [tracks, s.bars, barSteps]);
  const hasSong = detected.some((r) => r !== null);
  const useSong = s.follow && hasSong;
  const rootsPerBar = useMemo(() => {
    if (useSong) {
      let last = detected.find((r) => r !== null) ?? pat.root;
      return detected.map((r) => (r === null ? last : (last = r)));
    }
    return rootsFromKey(pat.root, s.minorKey, PROGRESSIONS.find((p) => p.id === s.prog)!.degrees, s.bars);
  }, [useSong, detected, pat.root, s.minorKey, s.prog, s.bars]);

  const line = useMemo(() => currentLine(pat), [pat]);
  const notes = useMemo(() => blgNotes(pat, { bars: s.bars, barSteps, octave: s.octave, rootsPerBar }), [pat, s.bars, barSteps, s.octave, rootsPerBar]);
  // Knob drags change the line many times a second; the sound preview and waveform follow once it settles.
  const [settled, setSettled] = useState(notes);
  useEffect(() => { const t = setTimeout(() => setSettled(notes), 160); return () => clearTimeout(t); }, [notes]);

  const drawPatch = useMemo(() => cleanBassPatch(applyPreset(s.sound)), [s.sound]);
  const name = s.names[s.slot] ?? `Pattern ${s.slot + 1}`;
  const label = name.toUpperCase();
  const total = s.bars * barSteps;
  const loopBars = (clampSteps(pat.steps) * rateLen(pat.rate)) / barSteps;

  const pv = usePreviewTrack();
  const [target, setTarget] = useState("new");
  const synthTracks = tracks.filter((t) => t.kind === "instrument" && !t.name.startsWith("PREVIEW · "));
  // The bassline fills only the bars your song already has (an 8-bar beat gets 8 bars of bass),
  // or the whole song when the timeline is still empty; it never runs past the song end.
  const contentBars = useMemo(
    () => songContentBars(tracks, barSteps, stepSeconds(transport.bpm), transport.bars, target !== "new" ? [target] : []),
    [tracks, barSteps, transport.bpm, transport.bars, target],
  );
  const fillBars = Math.min(transport.bars, contentBars || transport.bars);
  const fit = (n: typeof notes) => fitBassline(n, total, fillBars, transport.bars, barSteps);
  const build = (trackName: string, withSound = s.sound) => {
    const id = addTrack("instrument", trackName, withSound, { keepPanel: true });
    updateTrack(id, { ...fit(settled), patch: cleanBassPatch(applyPreset(withSound)) });
    return id;
  };
  const { previewing, update: updatePreview } = pv;
  const sent = useRef<unknown>(null);
  useEffect(() => {
    if (!previewing) { sent.current = null; return; }
    if (sent.current === null) { sent.current = settled; return; }
    if (sent.current === settled) return;
    sent.current = settled;
    updatePreview(fitBassline(settled, total, fillBars, transport.bars, barSteps));
  }, [previewing, settled, total, fillBars, transport.bars, barSteps, updatePreview]);
  const preview = (withSound?: string) => pv.start((n) => build(n(`BASS · ${label}`), withSound ?? s.sound));

  const phone = useIsLandscapePhone();
  const solo = useLoopPreview();
  const soloKey = `${JSON.stringify(settled)}|${s.sound}|${total}|${transport.bpm}`;
  const soloPlayed = useRef("");
  const playSolo = () => {
    soloPlayed.current = soloKey;
    void solo.play({ notes: settled, patch: drawPatch, steps: total }, transport.bpm)
      .catch(() => toast.error("Preview unavailable", { description: "This browser couldn't play the bassline preview." }));
  };
  useEffect(() => {
    if (!solo.playing || soloPlayed.current === soloKey) return;
    playSolo();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- soloKey captures every input playSolo reads
  }, [soloKey, solo.playing]);

  const create = () => {
    solo.stop();
    const dest = synthTracks.find((t) => t.id === target);
    if (dest) {
      pv.stop();
      updateTrack(dest.id, fit(notes));
      toast.success(`Bassline sent to ${dest.name}`, { description: `Fills ${fillBars} bar${fillBars > 1 ? "s" : ""}, played by that track's own sound.` });
      return;
    }
    if (pv.keep(`BASS · ${label}`)) { toast.success("Bassline added"); return; }
    const id = addTrack("instrument", `BASS · ${label}`, s.sound, { keepPanel: true });
    updateTrack(id, { ...fit(notes), patch: cleanBassPatch(applyPreset(s.sound)) });
    toast.success("Bassline added", { description: `Fills ${fillBars} bar${fillBars > 1 ? "s" : ""} to match your song — edit the notes in the piano roll.` });
  };

  const presetIdx = BLG_PRESETS.findIndex((p) => p.label === s.names[s.slot]);
  const loadPreset = (i: number) => {
    const p = BLG_PRESETS[(i + BLG_PRESETS.length) % BLG_PRESETS.length]!;
    setS((cur) => {
      const slots = cur.slots.slice(); slots[cur.slot] = presetPattern(p);
      const names = cur.names.slice(); names[cur.slot] = p.label;
      return { ...cur, slots, names, sound: p.sound, octave: p.octave };
    });
    toast.success(p.label, {
      description: `${p.genre} · ${p.sound}${transport.bpm !== p.bpm ? ` · usually ${p.bpm} BPM` : ""}`,
      action: transport.bpm !== p.bpm ? { label: `Use ${p.bpm} BPM`, onClick: () => setTransport({ bpm: p.bpm }) } : undefined,
    });
  };
  const rename = (n: string | null) => setS((cur) => { const names = cur.names.slice(); names[cur.slot] = n; return { ...cur, names }; });
  const randomize = () => { setPat(randomizeBlg(pat)); rename("Random"); };
  const copyToNext = () => {
    const to = (s.slot + 1) % SLOTS;
    setS((cur) => {
      const slots = cur.slots.slice(); const p = slots[cur.slot]!;
      slots[to] = { ...p, on: { ...p.on }, off: { ...p.off }, edits: p.edits ? p.edits.map((c) => (c ? { ...c } : null)) : null };
      const names = cur.names.slice(); names[to] = cur.names[cur.slot] ?? null;
      return { ...cur, slots, names, slot: to };
    });
    toast.success(`Copied to pattern ${to + 1}`, { description: "Change it there to make a variation." });
  };

  const audition = (iv: number) => {
    const e = getEngine(); e.init();
    e.playNote("bassgen-audition", drawPatch, Math.max(12, 12 * (s.octave + 1) + pat.root + iv), 0.25, 0.85);
  };

  // Step light: where the bass is in the pattern while a preview plays (20 fps, drawn straight on the display).
  const playPos = (): number | null => {
    const L = clampSteps(pat.steps), rl = rateLen(pat.rate);
    let at: number | null = null;
    const ph = solo.playing ? solo.phase() : null;
    if (ph != null) at = ph * total;
    else if (pv.previewing) {
      const now = getEngine().ctx?.currentTime;
      const c = now == null ? null : activeSongClock(now);
      if (c && now != null) at = (((c.step + (now - c.time) / c.dur) % total) + total) % total;
    }
    return at == null ? null : Math.floor(at / rl) % L;
  };

  return (
    <section className={`bassgen-device blg space-y-3 rounded-md border border-border bg-surface-1 p-4${skinned ? " studio-wallpaper" : ""}`} data-skin-panel="bass" style={skinBackground(skin)} {...skinDrop}>
      <SkinControls skinKey="bass" image />
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="bassgen-brand">SYNCLAB <b>Bassline Generator</b></h2>
          <p className="text-xs text-muted-foreground">Mix built-in on-beat and off-beat bass phrases, vary them, then edit any note. Music theory only — no AI credits used.</p>
        </div>
        <div className="blg-patterns" role="radiogroup" aria-label="Pattern slot">
          <span className="blg-label">PATTERN</span>
          {Array.from({ length: SLOTS }, (_, i) => (
            <button key={i} type="button" role="radio" aria-checked={s.slot === i} title={s.names[i] ?? `Pattern ${i + 1}`}
              onClick={() => set({ slot: i })} className={`blg-slot${s.slot === i ? " is-on" : ""}${s.names[i] || s.slots[i]!.edits ? " has-data" : ""}`}>{i + 1}</button>
          ))}
        </div>
      </header>

      <div className="blg-lcd-row">
        <label className="blg-lcd">
          <span className="blg-label">PATCH</span>
          <span className="flex items-center gap-1">
            <button type="button" className="blg-arrow" aria-label="Previous patch" onClick={() => loadPreset(presetIdx < 0 ? -1 : presetIdx - 1)}>◀</button>
            <select aria-label="Bassline patch" value={presetIdx < 0 ? "" : BLG_PRESETS[presetIdx]!.id} onChange={(e) => loadPreset(BLG_PRESETS.findIndex((p) => p.id === e.target.value))} className="blg-select min-w-44">
              {presetIdx < 0 && <option value="">{name}</option>}
              {BLG_GENRES.map((g) => (
                <optgroup key={g} label={g}>
                  {BLG_PRESETS.filter((p) => p.genre === g).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </optgroup>
              ))}
            </select>
            <button type="button" className="blg-arrow" aria-label="Next patch" onClick={() => loadPreset(presetIdx + 1)}>▶</button>
          </span>
        </label>
        <label className="blg-lcd">
          <span className="blg-label">ROOT</span>
          <select aria-label="Root note" value={pat.root} disabled={useSong} onChange={(e) => setPat({ root: Number(e.target.value) }, true)} className="blg-select">
            {NOTE_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}
          </select>
        </label>
        <label className="blg-lcd">
          <span className="blg-label">OCTAVE</span>
          <select aria-label="Octave" value={s.octave} onChange={(e) => set({ octave: Number(e.target.value) })} className="blg-select">
            <option value={0}>0 · very low</option><option value={1}>1 · low</option><option value={2}>2 · mid</option><option value={3}>3 · high</option>
          </select>
        </label>
        <BlgStepper label="STEPS" value={clampSteps(pat.steps)} min={16} max={64} onChange={(v) => setPat({ steps: v })} />
        <label className="blg-lcd">
          <span className="blg-label">RATE</span>
          <select aria-label="Rate" value={pat.rate} onChange={(e) => setPat({ rate: e.target.value as BlgRate }, true)} className="blg-select">
            {BLG_RATES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </label>
        <BlgStepper label="SHUFFLE" value={pat.shuffle} min={50} max={75} format={(v) => (v <= 50 ? "OFF" : `${v}%`)} onChange={(v) => setPat({ shuffle: v }, true)} />
        <BlgStepper label="SHIFT" value={pat.shift} min={-32} max={32} format={(v) => (v > 0 ? `+${v}` : String(v))} onChange={(v) => setPat({ shift: v })} />
      </div>

      <div className="blg-generator">
        <BlgLanePanel lane="on" title="ON-BEAT" value={pat.on} onChange={(on) => setPat({ on })} onDice={() => setPat({ on: randomLane("on") })} />
        <div className="blg-center">
          <BlgDiamond on={pat.on.index} off={pat.off.index} onAmount={pat.on.amount} offAmount={pat.off.amount}
            onChange={(on, off) => setPat({ on: { ...pat.on, index: on }, off: { ...pat.off, index: off } })} />
          <div className="blg-center-controls">
            <BlgStepper label="NOTE RANGE" value={Math.round(pat.range * 100)} min={-100} max={100} step={10} format={(v) => (v === 0 ? "0" : v > 0 ? `+${v}%` : `${v}%`)} onChange={(v) => setPat({ range: v / 100 })} />
            <div className="blg-lcd">
              <span className="blg-label">MINORNESS</span>
              <span className="blg-minor" role="radiogroup" aria-label="Minorness">
                {[0, 1, 2, 3, 4].map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={pat.minorness === m} onClick={() => setPat({ minorness: m })}
                    title={["Off — major intervals kept", "Minor 7ths", "+ minor 3rds", "+ minor 6ths", "+ minor 2nds (darkest)"][m]}
                    className={`blg-minor-led${pat.minorness >= m && m > 0 ? " is-on" : ""}${pat.minorness === m ? " is-sel" : ""}`}>{m}</button>
                ))}
              </span>
            </div>
          </div>
          <Button size="lg" className="min-h-12 w-full" onClick={randomize}><Dices className="size-4" /> Randomize</Button>
        </div>
        <BlgLanePanel lane="off" title="OFF-BEAT" value={pat.off} onChange={(off) => setPat({ off })} onDice={() => setPat({ off: randomLane("off") })} />
      </div>

      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="blg-label">NOTE DISPLAY</span>
          <span className="text-xs text-muted-foreground">Tap or drag to draw notes, tap a note to remove it. Green = on-beat, blue = off-beat.</span>
          {pat.edits && <span className="blg-edited">EDITED</span>}
          <span className="ml-auto flex flex-wrap gap-1">
            {pat.edits && <Button size="sm" variant="secondary" className="min-h-10" onClick={() => setPat({ edits: null })}><RotateCcw className="size-3.5" /> Back to generated</Button>}
            <Button size="sm" variant="secondary" className="min-h-10" onClick={() => setPat({ edits: line.map(() => null) }, true)}><Trash2 className="size-3.5" /> Clear notes</Button>
            <Button size="sm" variant="secondary" className="min-h-10" onClick={copyToNext}><Copy className="size-3.5" /> Copy to pattern {((s.slot + 1) % SLOTS) + 1}</Button>
          </span>
        </div>
        <BlgNoteDisplay line={line} root={pat.root} onEdit={(edits) => setPat({ edits }, true)} onAudition={audition} playPos={playPos} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="blg-label">CHORDS</span>
        <button type="button" className={chip(useSong)} disabled={!hasSong} onClick={() => set({ follow: true })}>Follow my chords</button>
        <button type="button" className={chip(!useSong)} onClick={() => set({ follow: false })}>Progression</button>
        {!useSong && (
          <>
            <select value={s.minorKey ? "min" : "maj"} onChange={(e) => set({ minorKey: e.target.value === "min" })} aria-label="Key scale" className="min-h-11 rounded-md border border-border bg-surface-2 px-3 text-sm">
              <option value="min">{NOTE_NAMES[pat.root]} minor</option><option value="maj">{NOTE_NAMES[pat.root]} major</option>
            </select>
            <select value={s.prog} onChange={(e) => set({ prog: e.target.value })} aria-label="Progression" className="min-h-11 rounded-md border border-border bg-surface-2 px-3 text-sm">
              {PROGRESSIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </>
        )}
        {!hasSong && <span className="text-xs text-muted-foreground">No chords in your song yet.</span>}
        <select value={s.bars} onChange={(e) => set({ bars: Number(e.target.value) })} aria-label="Bars" className="min-h-11 rounded-md border border-border bg-surface-2 px-3 text-sm">
          {[1, 2, 4, 8, 16].map((b) => <option key={b} value={b}>{b}-bar phrase</option>)}
        </select>
        <span className="font-mono text-[11px] text-foreground">
          FILLS {fillBars} BAR{fillBars > 1 ? "S" : ""} · {contentBars ? "AS LONG AS YOUR SONG" : "WHOLE SONG"}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {rootsPerBar.map((r) => NOTE_NAMES[r]).join(" → ")} · pattern is {Number(loopBars.toFixed(2))} bar{loopBars === 1 ? "" : "s"} long{loopBars > s.bars ? " (only the start fits)" : ""}
        </span>
      </div>

      <div className="space-y-2">
        <p className="blg-label">BASS SOUND · {BASS_SOUNDS.length} TO PICK FROM</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6" role="radiogroup" aria-label="Bass sound">
          {BASS_SOUNDS.map((snd) => (
            <button key={snd} type="button" role="radio" aria-checked={s.sound === snd}
              onClick={() => { set({ sound: snd }); if (pv.previewing) { pv.stop(); setTimeout(() => preview(snd), 60); } }}
              className={`min-h-11 rounded-md border px-2 text-left text-sm ${s.sound === snd ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>{snd}</button>
          ))}
        </div>
      </div>

      <PatternWaveform pattern={{ notes: settled, instrument: s.sound, patch: drawPatch, steps: total }} bpm={transport.bpm} label="Bassline waveform" closeUp color="var(--display-cyan)" />
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span className="blg-label">SEND TO</span>
        <select aria-label="Send bassline to" value={target} onChange={(e) => setTarget(e.target.value)} className="min-h-11 rounded-md border border-border bg-surface-2 px-3 text-sm">
          <option value="new">New bass track ({s.sound})</option>
          {synthTracks.map((t) => <option key={t.id} value={t.id}>{t.name} — replaces its notes</option>)}
        </select>
        <span className="font-mono text-xs text-muted-foreground">{notes.length} notes over {s.bars} bar{s.bars > 1 ? "s" : ""}</span>
      </label>
      <div className="flex flex-wrap gap-2">
        {solo.playing
          ? <Button size="lg" variant="destructive" className="min-h-12" onClick={solo.stop}><Square className="size-4 fill-current" /> Stop run</Button>
          : <Button size="lg" variant="secondary" className="min-h-12" onClick={playSolo} title="Plays only the bassline, looped — it doesn't start your song, and stays in time with it if the song is already playing"><Play className="size-4" /> Run (bass only)</Button>}
        {phone
          ? <Button size="lg" className="min-h-12" onClick={create}>{target === "new" ? "Add bassline to timeline" : "Send notes to track"}</Button>
          : <PreviewButtons pv={pv} onPreview={() => { solo.stop(); preview(); }} onAdd={create} addLabel={target === "new" ? "Add bassline to timeline" : "Send notes to track"} />}
      </div>
    </section>
  );
}

const chip = (on: boolean) => `min-h-11 rounded-md border px-3 text-sm ${on ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`;
