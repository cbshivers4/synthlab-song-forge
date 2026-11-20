/**
 * Decides whether an audio interface is plugged in, from the device names the browser reports.
 * Built-in microphones/speakers and Bluetooth headsets are not interfaces, so Settings hides
 * every interface detail until a real one (USB or a known interface brand) shows up.
 */
const BRANDS =
  /\b(usb|volt|focusrite|scarlett|clarett|universal audio|apollo|presonus|audiobox|studio ?\d+c|steinberg|ur\d{2}|behringer|umc\d+|motu|m-?audio|m-?track|audient|evo \d|id\d+|ssl ?\d|solid state logic|komplete audio|native instruments|zoom|tascam|rme|babyface|fireface|roland|rubix|arturia|minifuse|apogee|duet|antelope|irig|ik multimedia|mbox|avid|line ?6|mackie|esi|yamaha ag|ag0\d|rode(caster)?|shure mvi|interface)\b/i;
const NOT_INTERFACE = /\b(bluetooth|airpods|hands-?free|headset|beats|buds)\b/i;

/** Chrome lists the system default twice ("Default - Scarlett 2i2"); compare the real name. */
export function cleanDeviceLabel(label: string): string {
  return label.replace(/^(default|communications)\s*-\s*/i, "").trim();
}

export function isInterfaceLabel(label: string): boolean {
  const name = cleanDeviceLabel(label);
  return !!name && !NOT_INTERFACE.test(name) && BRANDS.test(name);
}

/** The connected interface's name, or null when only built-in/Bluetooth devices are present. */
export function connectedInterface(
  inputs: { label: string }[],
  outputs: { label: string }[] = [],
  preferred?: string,
): string | null {
  const all = [...inputs, ...outputs]
    .map((d) => cleanDeviceLabel(d.label))
    .filter(isInterfaceLabel);
  if (!all.length) return null;
  const pick = preferred ? cleanDeviceLabel(preferred) : "";
  return all.find((l) => l === pick) ?? all[0] ?? null;
}
