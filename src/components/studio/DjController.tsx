import { useEffect, useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronUp, Cable, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useStudio } from "@/lib/synclab/store";
import { getDjMidi } from "@/lib/synclab/dj-midi";
import { DJ_ACTIONS, djKeyLabel, djProfileFor, type DjActionDef } from "@/lib/synclab/dj-midi-map";
import { midiInputEnabled, midiSupported, midiUnsupportedMessage, toggleMidiInput } from "@/lib/synclab/midi";

const OPEN_KEY = "synclab.dj.controller.open";

function useDjMidi() {
  const m = getDjMidi();
  useSyncExternalStore((fn) => m.subscribe(fn), () => m.version, () => 0);
  return m;
}

/**
 * DJ controller section: connect a USB / Bluetooth MIDI DJ controller, see which controls it sends,
 * and Learn any control. Uses the studio's MIDI inputs (same on/off switches as Settings → MIDI).
 */
export function DjController({ sheet, onClose }: { sheet?: boolean; onClose?: () => void }) {
  const m = useDjMidi();
  const { midiInputs, midiInputId, enableMidi, setMidiInput } = useStudio();
  const [open, setOpen] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => { m.load(); try { if (localStorage.getItem(OPEN_KEY) === "1") setOpen(true); } catch { /* private mode */ } }, [m]);
  // the activity light fades a moment after the last message
  useEffect(() => { if (!m.last) return; const t = setTimeout(() => tick((n) => n + 1), 700); return () => clearTimeout(t); }, [m.last]);
  const toggle = () => setOpen((v) => { try { localStorage.setItem(OPEN_KEY, v ? "0" : "1"); } catch { /* private mode */ } return !v; });
  const show = sheet || open;

  const supported = midiSupported();
  const djPorts = midiInputs.filter((p) => djProfileFor(p.name));
  const enabledDj = djPorts.filter((p) => midiInputEnabled(midiInputId, p.id));
  const recent = m.last && performance.now() - m.last.at < 700;
  const status = !supported ? "Not available in this browser"
    : !midiInputs.length ? "No controller connected"
    : enabledDj.length ? `${djProfileFor(enabledDj[0]!.name)!.name} ready`
    : `${midiInputs.length} MIDI device${midiInputs.length === 1 ? "" : "s"} — use Learn`;

  const body = (
    <div className="dj-hw-body">
      {!supported ? (
        <p className="dj-hw-note">{midiUnsupportedMessage()}</p>
      ) : (
        <>
          <div className="dj-hw-ports">
            <div className="dj-hw-row-head">
              <b>1 · Connect</b>
              <Button size="sm" variant="secondary" className="dj-browser-btn" onClick={() => enableMidi()}>{midiInputs.length ? "Refresh" : "Connect controller"}</Button>
            </div>
            {!midiInputs.length && <p className="dj-hw-note">Plug your DJ controller in by USB (or pair it as Bluetooth MIDI), then press Connect controller and allow MIDI. Works in Chrome or Edge on a computer and Chrome on Android.</p>}
            <ul>
              {midiInputs.map((p) => {
                const profile = djProfileFor(p.name);
                const on = midiInputEnabled(midiInputId, p.id);
                return (
                  <li key={p.id} className="dj-hw-port" data-on={on ? "1" : "0"}>
                    <label className="flex min-w-0 flex-1 items-center gap-2">
                      <Checkbox checked={on} onCheckedChange={(v) => setMidiInput(toggleMidiInput(midiInputId, p.id, v === true, midiInputs))} aria-label={`Use ${p.name}`} />
                      <span className="truncate font-semibold" title={p.name}>{p.name}</span>
                    </label>
                    <span className="dj-hw-tag" data-kind={profile ? "ready" : "learn"}>{profile ? `Ready: ${profile.name} layout` : "Set up with Learn"}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="dj-hw-activity" data-live={recent ? "1" : "0"} aria-live="polite">
            <span className="dj-hw-led" aria-hidden />
            {m.learning ? <span>Now move or press the control for <b>{DJ_ACTIONS.find((a) => a.id === m.learning)?.group} · {DJ_ACTIONS.find((a) => a.id === m.learning)?.label}</b>… <button type="button" className="dj-hw-link" onClick={() => m.cancelLearn()}>Cancel</button></span>
              : m.last ? <span>Last control: <b>{m.last.label}</b> <small>from {m.last.port || "controller"}</small></span>
              : <span>Move a knob or press a button on your controller — it shows up here.</span>}
          </div>

          <div className="dj-hw-opts">
            <label><Checkbox checked={m.reverseTempo} onCheckedChange={(v) => m.setReverseTempo(v === true)} /> Reverse tempo sliders</label>
            <label title="Only for learned jog wheels: most send 64 at rest; some send 1 forwards and 127 backwards"><Checkbox checked={m.jogSigned} onCheckedChange={(v) => m.setJogSigned(v === true)} /> Learned jog wheels send 1 / 127</label>
          </div>

          <div className="dj-hw-learn">
            <div className="dj-hw-row-head">
              <b>2 · Learn (optional)</b>
              <span className="dj-hw-note">Press Learn next to a job, then move that control on your hardware. Learned controls override the built-in layout.</span>
              {Object.keys(m.learned).length > 0 && <Button size="sm" variant="ghost" className="dj-browser-btn" onClick={() => { if (window.confirm("Forget every learned DJ control on this device?")) m.clearAll(); }}>Forget learned</Button>}
            </div>
            <div className="dj-hw-groups">
              {(["Deck A", "Deck B", "Mixer"] as const).map((g) => (
                <section key={g} className="dj-hw-group" data-deck={g === "Deck A" ? "A" : g === "Deck B" ? "B" : undefined} aria-label={`${g} controls`}>
                  <h4>{g}</h4>
                  <ul>{DJ_ACTIONS.filter((a) => a.group === g && !a.hidden).map((a) => <LearnRow key={a.id} a={a} />)}</ul>
                </section>
              ))}
            </div>
          </div>
          <p className="dj-hw-note">
            Controller sound: to hear the decks through your controller's own sound card, pick it as the Output device in Settings → Audio; for its headphone jack use HEADPHONES → 2ND OUT. Lights on Pioneer DDJ buttons (play, cue, headphone cue, hot cues, loops) follow the decks.
          </p>
        </>
      )}
    </div>
  );

  if (sheet) {
    return (
      <div className="dj-phones-sheet dj-hw is-sheet" role="dialog" aria-label="DJ controller">
        <div className="dj-phones-sheet-head">
          <b><Cable className="size-4" /> Controller <small className="dj-hw-status">{status}</small></b>
          <Button variant="ghost" className="dj-pl-btn" onClick={onClose}><X className="size-4" />Close</Button>
        </div>
        <div className="dj-hw-scroll">{body}</div>
      </div>
    );
  }
  return (
    <section className="dj-hw dj-browser" data-open={show ? "1" : "0"} aria-label="DJ controller">
      <header className="dj-browser-head">
        <Cable className="size-4 shrink-0" />
        <span className="dj-label">CONTROLLER</span>
        <span className="dj-hw-led" data-live={recent ? "1" : "0"} aria-hidden />
        <b className="dj-hw-status truncate">{status}</b>
        <button type="button" className="dj-browser-btn ml-auto" onClick={toggle} aria-expanded={show}>
          {show ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}{show ? "Hide" : "Set up hardware"}
        </button>
      </header>
      {show && body}
    </section>
  );
}

function LearnRow({ a }: { a: DjActionDef }) {
  const m = getDjMidi();
  const key = m.learnedKeyFor(a.id);
  const learning = m.learning === a.id;
  return (
    <li className="dj-hw-action" data-learning={learning ? "1" : "0"}>
      <span className="truncate" title={a.label}>{a.label}</span>
      <small className="dj-hw-key">{learning ? "waiting…" : key ? djKeyLabel(key) : ""}</small>
      <button type="button" className="dj-hw-btn" aria-pressed={learning} onClick={() => (learning ? m.cancelLearn() : m.startLearn(a.id))} aria-label={`Learn ${a.group} ${a.label}`}>{learning ? "Cancel" : "Learn"}</button>
      {key && <button type="button" className="dj-hw-btn is-x" onClick={() => m.clear(a.id)} aria-label={`Forget ${a.group} ${a.label}`}><X className="size-3" /></button>}
    </li>
  );
}
