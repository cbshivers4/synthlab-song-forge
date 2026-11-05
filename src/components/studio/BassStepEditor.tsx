import { BASS_PATTERN_PRESETS, DEGREE_ROWS, degreeSemis, randomPattern, resizePattern, type BassPattern } from "@/lib/synclab/bass-pattern";
import { NOTE_NAMES } from "@/lib/synclab/bass-gen";
import { Button } from "@/components/ui/button";

interface Props {
  pattern: BassPattern;
  onChange: (p: BassPattern) => void;
  tonic: number;
  minor: boolean;
  onAudition: (semis: number) => void;
}

/** Step grid where you place every bass note yourself: tap a cell to set that step's note. */
export function BassStepEditor({ pattern, onChange, tonic, minor, onAudition }: Props) {
  const set = (i: number, v: BassPattern[number]) => onChange(pattern.map((s, j) => (j === i ? v : s)));
  const rows = Array.from({ length: DEGREE_ROWS }, (_, r) => DEGREE_ROWS - 1 - r);
  const cols = `2.5rem repeat(${pattern.length}, minmax(0, 1fr))`;
  const presetId = BASS_PATTERN_PRESETS.find((p) => JSON.stringify(resizePattern(p.steps, pattern.length)) === JSON.stringify(pattern))?.id ?? "";

  return (
    <div className="bassgen-steps space-y-2" aria-label="Bass note editor">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Pattern preset" value={presetId} onChange={(e) => {
          const p = BASS_PATTERN_PRESETS.find((x) => x.id === e.target.value);
          if (p) onChange(resizePattern(p.steps, pattern.length));
        }} className="min-h-11 rounded-md border border-border bg-surface-2 px-3 text-sm">
          <option value="" disabled>{presetId ? "" : "Custom pattern"}</option>
          {BASS_PATTERN_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <select aria-label="Steps" value={pattern.length} onChange={(e) => onChange(resizePattern(pattern, Number(e.target.value)))} className="min-h-11 rounded-md border border-border bg-surface-2 px-3 text-sm">
          <option value={16}>16 steps</option><option value={32}>32 steps</option>
        </select>
        <Button variant="secondary" size="sm" className="min-h-11" onClick={() => onChange(randomPattern(pattern.length))}>Randomize</Button>
        <Button variant="secondary" size="sm" className="min-h-11" onClick={() => onChange(pattern.map(() => null))}>Clear</Button>
        <span className="text-xs text-muted-foreground">Tap a square to place a note. Tap it again to remove it. Use A for accent and the arrow to tie into the next step.</span>
      </div>
      <div className="overflow-x-auto">
        <div className="bassgen-step-grid grid min-w-[36rem] gap-px" style={{ gridTemplateColumns: cols }}>
          {rows.map((deg) => (
            <div key={deg} className="contents">
              <span className="bassgen-step-label pr-1 text-right font-mono text-[10px] leading-5 text-muted-foreground">
                {NOTE_NAMES[(tonic + degreeSemis(deg, minor)) % 12]}{deg % 7 === 0 ? "•" : ""}
              </span>
              {pattern.map((st, i) => {
                const on = st?.degree === deg;
                return (
                  <button key={i} type="button" aria-label={`Step ${i + 1} ${NOTE_NAMES[(tonic + degreeSemis(deg, minor)) % 12]}`} aria-pressed={on}
                    onClick={() => { if (on) set(i, null); else { set(i, { degree: deg, accent: st?.accent ?? false, tie: st?.tie ?? false }); onAudition(degreeSemis(deg, minor)); } }}
                    className={`bassgen-step h-5 ${on ? "is-on" : ""}${deg % 7 === 0 ? " is-root" : ""}${i % 4 === 0 ? " is-beat" : ""}`} />
                );
              })}
            </div>
          ))}
          <span className="text-right font-mono text-[10px] text-muted-foreground">ACC</span>
          {pattern.map((st, i) => (
            <button key={i} type="button" disabled={!st} aria-pressed={!!st?.accent} aria-label={`Accent step ${i + 1}`}
              onClick={() => st && set(i, { ...st, accent: !st.accent })} className={`bassgen-flag h-7 text-[10px] ${st?.accent ? "is-on" : ""}`}>A</button>
          ))}
          <span className="text-right font-mono text-[10px] text-muted-foreground">TIE</span>
          {pattern.map((st, i) => (
            <button key={i} type="button" disabled={!st} aria-pressed={!!st?.tie} aria-label={`Tie step ${i + 1}`}
              onClick={() => st && set(i, { ...st, tie: !st.tie })} className={`bassgen-flag h-7 text-[10px] ${st?.tie ? "is-on" : ""}`}>→</button>
          ))}
        </div>
      </div>
    </div>
  );
}
