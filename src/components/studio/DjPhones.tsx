import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Headphones, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Knob } from "./Knob";
import { canPickPhonesDevice, getDj, type DeckId } from "@/lib/synclab/dj-engine";
import {
  getOutputDevice,
  listAudioDevices,
  onDeviceChange,
  type AudioDeviceInfo,
} from "@/lib/synclab/mic";
import type { PhonesMode } from "@/lib/synclab/dj";

/** Turn a deck's headphone CUE on/off; when the headphones have nowhere to go yet, say how to set them up. */
export function togglePhonesCue(id: DeckId, onNeedSetup?: () => void) {
  const dj = getDj();
  const deck = dj.deck(id);
  const on = !deck.state.phones;
  deck.setPhones(on);
  if (on && dj.state.phonesMode === "off") {
    if (onNeedSetup) onNeedSetup();
    else
      toast("Choose where your headphones are", {
        description:
          "Under HEADPHONES pick SPLIT (headphones on this output: cue in the left ear, master in the right) or a second output.",
      });
  }
}

function useOutputs() {
  const [outs, setOuts] = useState<AudioDeviceInfo[]>([]);
  const refresh = useCallback(
    async () => setOuts((await listAudioDevices()).filter((d) => d.kind === "audiooutput")),
    [],
  );
  useEffect(() => {
    void refresh();
    return onDeviceChange(() => void refresh());
  }, [refresh]);
  return { outs, refresh };
}

const MODE_TEXT: Record<PhonesMode, string> = {
  off: "Headphones off — the speakers play the master.",
  split:
    "SPLIT: left ear = headphone mix, right ear = master (both mono). Use with headphones on this output.",
  device: "Headphones play on the second output; the speakers keep the master.",
};

/**
 * HEADPHONES section of the DJ mixer: where the cue goes (off / mono split on this output /
 * a second output device), MIXING (cue ↔ master) and LEVEL.
 */
export function PhonesPanel({ big = false }: { big?: boolean }) {
  const dj = getDj();
  const m = dj.state;
  const canDevice = canPickPhonesDevice();
  const { outs, refresh } = useOutputs();
  const main = getOutputDevice() ?? "default";
  const choices = outs.filter(
    (d) => d.id !== "default" && d.id !== "communications" && d.id !== main,
  );
  const unnamed = outs.length > 0 && outs.every((d) => /^Output \d+$/.test(d.label));
  const pickMode = (mode: PhonesMode) => {
    if (mode === "device" && !m.phonesDevice) {
      const first = choices[0]?.id ?? null;
      if (!first) {
        toast("No second output found", {
          description: "Plug in USB headphones or a DJ interface, then choose it here.",
        });
        return;
      }
      void dj.setPhonesMode("device", first);
      return;
    }
    void dj.setPhonesMode(mode);
  };
  const showNames = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      await refresh();
    } catch {
      toast.error("Device names need microphone permission", {
        description: "The browser only shows output names after you allow the microphone.",
      });
    }
  };
  const k = big ? { size: 44 } : { size: 30, className: "djm-knob" };
  return (
    <div className={`djm-phones${big ? " is-big" : ""}`} aria-label="Headphones">
      <span className="djm-legend">
        <Headphones className="size-3" /> HEADPHONES
      </span>
      <div className="djm-phones-modes" role="radiogroup" aria-label="Headphone output">
        {(["off", "split", "device"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={m.phonesMode === mode}
            className="djm-switch"
            disabled={mode === "device" && !canDevice}
            onClick={() => pickMode(mode)}
            title={
              mode === "device" && !canDevice
                ? "This browser can't send sound to a second output (Chrome or Edge on a computer can)."
                : MODE_TEXT[mode]
            }
          >
            {mode === "off" ? "OFF" : mode === "split" ? "MONO SPLIT" : "2ND OUT"}
          </button>
        ))}
      </div>
      {m.phonesMode === "device" && canDevice && (
        <div className="djm-phones-dev">
          <select
            aria-label="Headphone output device"
            value={m.phonesDevice ?? ""}
            onChange={(e) => void dj.setPhonesMode("device", e.target.value || null)}
          >
            {choices.length === 0 && <option value="">No second output found</option>}
            {choices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
          {unnamed && (
            <button type="button" className="djm-link" onClick={() => void showNames()}>
              Show names
            </button>
          )}
        </div>
      )}
      <div className="djm-phones-knobs">
        <Knob
          label="MIXING"
          value={m.phonesMix}
          onChange={(v) => dj.setPhonesMix(v)}
          defaultValue={0}
          {...k}
          format={(v) =>
            v < 0.03
              ? "CUE"
              : v > 0.97
                ? "MASTER"
                : `${Math.round((1 - v) * 100)}/${Math.round(v * 100)}`
          }
          ariaLabel="Headphone mixing, cue to master"
        />
        <Knob
          label="LEVEL"
          value={m.phonesLevel}
          min={0}
          max={1.5}
          onChange={(v) => dj.setPhonesLevel(v)}
          defaultValue={0.8}
          {...k}
          format={(v) => `${Math.round(v * 100)}%`}
          ariaLabel="Headphone level"
        />
      </div>
      <p className="djm-phones-note" role="status">
        {m.phonesError ? `Couldn't use that output: ${m.phonesError}` : MODE_TEXT[m.phonesMode]}
        {m.phonesMode === "device" && " A second output can run a little behind the speakers."}
      </p>
    </div>
  );
}

/** Sideways phone: headphone setup and the two CUE buttons over the whole DJ screen. */
export function PhonesSheet({ onClose }: { onClose: () => void }) {
  const dj = getDj();
  return (
    <div className="dj-phones-sheet" role="dialog" aria-label="Headphones">
      <div className="dj-phones-sheet-head">
        <b>
          <Headphones className="size-4" /> Headphones
        </b>
        <Button variant="ghost" className="dj-pl-btn" onClick={onClose}>
          <X className="size-4" />
          Close
        </Button>
      </div>
      <div className="dj-phones-sheet-body">
        <div className="dj-phones-cues">
          {(["A", "B"] as const).map((id) => (
            <button
              key={id}
              type="button"
              className="djm-cue is-big"
              data-deck={id}
              aria-pressed={dj.deck(id).state.phones}
              onClick={() => togglePhonesCue(id, () => undefined)}
            >
              CUE {id}
            </button>
          ))}
        </div>
        <PhonesPanel big />
      </div>
    </div>
  );
}
