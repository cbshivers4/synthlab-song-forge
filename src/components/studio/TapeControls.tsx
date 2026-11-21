import type { ReactNode } from "react";
import { Headphones, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getReelRecorder, type TapeState } from "@/lib/synclab/reel-recorder";

export const tapeClock = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Record source, input enable and monitor — the same input for every machine. */
export function TapeSourceControls({ state, locked }: { state: TapeState; locked: boolean }) {
  const recorder = getReelRecorder();
  const recording = state.mode === "recording";
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-xs text-muted-foreground">
        Record from
        <select
          value={state.source}
          disabled={locked || recording}
          onChange={(e) => void recorder.setSource(e.target.value as "input" | "song")}
          className="h-11 rounded border border-input bg-background px-2 text-foreground"
        >
          <option value="input">Microphone / interface</option>
          <option value="song">Song master (what the studio plays)</option>
        </select>
      </label>
      <Button
        variant={state.ready ? "secondary" : "default"}
        className="h-11"
        disabled={locked || recording}
        onClick={() => void (state.ready ? recorder.release() : recorder.enable())}
      >
        {state.ready
          ? "Release input"
          : state.source === "input"
            ? "Enable microphone"
            : "Enable song input"}
      </Button>
      <Button
        variant={state.monitor ? "secondary" : "outline"}
        className="h-11"
        aria-pressed={state.monitor}
        disabled={state.source !== "input"}
        onClick={() => recorder.configure({ monitor: !state.monitor })}
      >
        <Headphones />
        Monitor
      </Button>
      <AutoLevelButton state={state} locked={locked} />
    </div>
  );
}

/** Auto level on/off, with the boost the last take received. */
export function AutoLevelButton({ state, locked }: { state: TapeState; locked: boolean }) {
  const recorder = getReelRecorder();
  const boost = state.lastBoostDb;
  return (
    <Button
      variant={state.autoLevel ? "secondary" : "outline"}
      className="h-11"
      aria-pressed={state.autoLevel}
      disabled={locked || state.mode === "recording"}
      title="Makes quiet recordings loud: when you stop, the take is raised to a strong, steady level and its loudest moments are held just under full volume so it never clips. Loud takes are left as they are."
      onClick={() => recorder.configure({ autoLevel: !state.autoLevel })}
    >
      <Volume2 />
      Auto level {state.autoLevel ? "on" : "off"}
      {state.autoLevel && boost != null && boost > 0.05 && (
        <span className="text-[10px] text-muted-foreground">+{boost.toFixed(1)} dB</span>
      )}
    </Button>
  );
}

/** A raised transport key on a deck face. */
export function DeckKey({
  label,
  icon,
  onClick,
  disabled,
  active,
  danger,
  title,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      className="deck-key"
      data-active={active || undefined}
      data-danger={danger || undefined}
      disabled={disabled}
      onClick={onClick}
      title={title ?? label}
      aria-label={title ?? label}
      aria-pressed={active}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/** Horizontal peak meters for a deck display, from the engine's real L/R levels. */
export function DeckMeters({ state }: { state: TapeState }) {
  return (
    <div className="deck-meters" aria-label="Recording level">
      {(["L", "R"] as const).map((ch, i) => {
        const level = i === 0 ? state.levelL : state.levelR;
        const db = level > 0 ? 20 * Math.log10(level) : -60;
        const pct = Math.max(0, Math.min(100, ((db + 48) / 51) * 100));
        return (
          <div key={ch} className="deck-meter-row">
            <span>{ch}</span>
            <div
              className="deck-meter"
              role="meter"
              aria-label={`${ch} level`}
              aria-valuemin={-48}
              aria-valuemax={3}
              aria-valuenow={Math.round(Math.max(-48, db))}
            >
              <div className="deck-meter-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
      <div className="deck-meter-scale" aria-hidden="true">
        {[-40, -20, -10, -3, 0].map((db) => (
          <span key={db} style={{ left: `${((db + 48) / 51) * 100}%` }}>
            {db}
          </span>
        ))}
        <span className={`deck-over${state.clipped ? " deck-clip-on" : ""}`}>OVER</span>
      </div>
    </div>
  );
}
