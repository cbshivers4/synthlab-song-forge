// Mackie Control (MCU) messages, as sent by the Korg nanoKONTROL Studio / nanoKONTROL2 in their
// DAW modes (Cubase, Digital Performer, Live, SONAR, Studio One). In those modes the faders send
// pitch bend (one MIDI channel per strip), the knobs send relative CCs and every button is a note.
// Pure decoding only: the store applies the result to tracks and the transport.
import type { RemoteButton } from "./controller-profiles";

export type SurfaceAction =
  | { kind: "volume"; strip: number; value: number }
  | { kind: "pan"; strip: number; delta: number }
  | { kind: "switch"; strip: number; param: "arm" | "solo" | "mute" | "select" }
  | { kind: "master"; value: number }
  | { kind: "button"; button: RemoteButton }
  | { kind: "jog"; dir: 1 | -1 }
  /** A Mackie message the app deliberately swallows (button release, fader touch, unused keys). */
  | { kind: "ignore" };

/** Pan moved per knob detent (pan runs −1…1). */
export const PAN_STEP = 0.03;

const BUTTON_NOTES: Record<number, RemoteButton> = {
  46: "bank-prev", 47: "bank-next", // BANK ◀ / ▶
  48: "bank-prev", 49: "bank-next", // CHANNEL ◀ / ▶ (the Korg's TRACK buttons send these in some modes)
  86: "loop", 91: "rewind", 92: "forward", 93: "stop", 94: "play", 95: "record",
};

/** True for messages only a Mackie-mode surface sends (fader pitch bend or button notes). */
export function looksLikeMackie(status: number): boolean {
  const cmd = status & 0xf0;
  return cmd === 0xe0 || cmd === 0x90 || cmd === 0x80;
}

/** Decode one raw message from a Mackie-mode surface, or null when it is not a Mackie message. */
export function mackieAction(status: number, d1: number, d2: number): SurfaceAction | null {
  const cmd = status & 0xf0;
  const channel = status & 0x0f;
  if (cmd === 0xe0) {
    const value = ((d2 << 7) | d1) / 16383;
    if (channel < 8) return { kind: "volume", strip: channel, value };
    if (channel === 8) return { kind: "master", value };
    return { kind: "ignore" };
  }
  if (cmd === 0xb0) {
    // V-pots: bit 6 = turned left, low 6 bits = how many detents.
    if (d1 >= 16 && d1 <= 23) {
      const steps = d2 & 0x3f;
      const sign = d2 & 0x40 ? -1 : 1;
      return { kind: "pan", strip: d1 - 16, delta: sign * steps * PAN_STEP };
    }
    if (d1 === 60) return { kind: "jog", dir: d2 & 0x40 ? -1 : 1 };
    return null;
  }
  if (cmd === 0x90 || cmd === 0x80) {
    const pressed = cmd === 0x90 && d2 > 0;
    if (!pressed) return { kind: "ignore" }; // act on press only
    if (d1 <= 7) return { kind: "switch", strip: d1, param: "arm" };
    if (d1 <= 15) return { kind: "switch", strip: d1 - 8, param: "solo" };
    if (d1 <= 23) return { kind: "switch", strip: d1 - 16, param: "mute" };
    if (d1 <= 31) return { kind: "switch", strip: d1 - 24, param: "select" };
    const button = BUTTON_NOTES[d1];
    return button ? { kind: "button", button } : { kind: "ignore" };
  }
  return null;
}
