export interface SavedPad {
  name: string;
  url: string;
  cloudPath?: string;
  duration: number;
  peaks: number[];
  start: number;
  end: number;
  gain: number;
  pitch: number;
  reverse: boolean;
  loop: boolean;
  oneShot: boolean;
  attack: number;
  release: number;
  choke: number;
  steps: number[];
}

let padBank: Record<number, SavedPad> = {};
const listeners = new Set<(pads: Record<number, SavedPad>) => void>();

export const getPadBank = () => structuredClone(padBank);

export function setPadBank(pads: Record<number, SavedPad>) {
  padBank = structuredClone(pads);
  for (const listener of listeners) listener(structuredClone(padBank));
}

export function subscribePadBank(listener: (pads: Record<number, SavedPad>) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}