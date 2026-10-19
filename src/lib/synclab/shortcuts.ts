/** One source for shortcut matching and the Settings reference. Mod means Ctrl or Command. */
export const SHORTCUTS = [
  { id: "play", group: "Transport", keys: "Space", key: " ", description: "Play or pause the song." },
  { id: "stop", group: "Transport", keys: "Shift + Space", key: " ", shift: true, description: "Stop playback and finish recording." },
  { id: "record", group: "Transport", keys: "Mod + Enter", key: "Enter", mod: true, description: "Start or stop recording armed tracks." },
  { id: "record", group: "Transport", keys: "R", key: "r", description: "Start or stop recording armed tracks." },
  { id: "loop", group: "Transport", keys: "Alt + L", key: "l", alt: true, description: "Turn loop playback on or off." },
  { id: "click", group: "Transport", keys: "Alt + C", key: "c", alt: true, description: "Turn the metronome on or off." },
  { id: "follow", group: "Transport", keys: "Alt + F", key: "f", alt: true, description: "Turn follow-playhead scrolling on or off." },
  { id: "home", group: "Transport", keys: "Home", key: "Home", description: "Move the playhead to the song start." },
  { id: "end", group: "Transport", keys: "End", key: "End", description: "Move the playhead to the last song step." },
  { id: "left", group: "Transport", keys: "←", key: "ArrowLeft", description: "Move the playhead back one quarter-note beat." },
  { id: "right", group: "Transport", keys: "→", key: "ArrowRight", description: "Move the playhead forward one quarter-note beat." },
  { id: "leftStep", group: "Transport", keys: "Shift + ←", key: "ArrowLeft", shift: true, description: "Move the playhead back one sixteenth-note step." },
  { id: "rightStep", group: "Transport", keys: "Shift + →", key: "ArrowRight", shift: true, description: "Move the playhead forward one sixteenth-note step." },
  { id: "stop", group: "Transport", keys: "Escape", key: "Escape", description: "Stop playback (dialogs handle Escape first)." },
  { id: "save", group: "Project & editing", keys: "Mod + S", key: "s", mod: true, description: "Manually save the current project." },
  { id: "undo", group: "Project & editing", keys: "Mod + Z", key: "z", mod: true, description: "Undo the last edit." },
  { id: "redo", group: "Project & editing", keys: "Mod + Shift + Z", key: "z", mod: true, shift: true, description: "Redo an undone edit." },
  { id: "redo", group: "Project & editing", keys: "Mod + Y", key: "y", mod: true, description: "Redo an undone edit." },
  { id: "copy", group: "Project & editing", keys: "Mod + C", key: "c", mod: true, description: "Copy the selected clip, or selected track contents." },
  { id: "cut", group: "Project & editing", keys: "Mod + X", key: "x", mod: true, description: "Cut the selected clip, or selected track contents." },
  { id: "paste", group: "Project & editing", keys: "Mod + V", key: "v", mod: true, description: "Paste contents at the playhead into the selected channel." },
  { id: "duplicate", group: "Project & editing", keys: "Mod + D", key: "d", mod: true, description: "Duplicate the selected track, including its settings." },
  { id: "selectAll", group: "Project & editing", keys: "Mod + A", key: "a", mod: true, description: "Select all timeline tracks." },
  { id: "delete", group: "Project & editing", keys: "Delete", key: "Delete", description: "Delete the active clip or cut part; otherwise delete the selected channel." },
  { id: "delete", group: "Project & editing", keys: "Backspace", key: "Backspace", description: "Same as Delete; select a clip or part to keep its channel." },
  { id: "split", group: "Project & editing", keys: "Alt + X", key: "x", alt: true, description: "Split the selected track material at the playhead." },
  { id: "quantize", group: "Project & editing", keys: "Alt + Q", key: "q", alt: true, description: "Quantize notes on the selected track to the current grid." },
  { id: "arm", group: "Track & tools", keys: "Alt + R", key: "r", alt: true, description: "Arm or disarm the selected track for recording." },
  { id: "mute", group: "Track & tools", keys: "Alt + M", key: "m", alt: true, description: "Mute or unmute the selected track." },
  { id: "solo", group: "Track & tools", keys: "Alt + S", key: "s", alt: true, description: "Solo or unsolo the selected track." },
  { id: "selectTool", group: "Track & tools", keys: "Alt + V", key: "v", alt: true, description: "Choose the Select tool." },
  { id: "drawTool", group: "Track & tools", keys: "Alt + B", key: "b", alt: true, description: "Choose the Draw tool for notes and drum hits." },
  { id: "razorTool", group: "Track & tools", keys: "Alt + T", key: "t", alt: true, description: "Choose the Razor tool for cutting parts." },
  { id: "settings", group: "Windows & devices", keys: "Mod + ,", key: ",", mod: true, description: "Open Settings." },
  { id: "shortcuts", group: "Windows & devices", keys: "Mod + Shift + K", key: "k", mod: true, shift: true, description: "Open this keyboard-shortcut reference." },
  { id: "typing", group: "Windows & devices", keys: "Alt + K", key: "k", alt: true, description: "Enable or disable computer-keyboard note playing." },
  ...(["mixer", "piano", "instrument", "drums", "browser", "plugins", "keys", "studio-view", "closePanel"] as const).map((id, i) => ({ id, group: "Windows & devices", keys: `Alt + ${i + 1}`, key: String(i + 1), alt: true, description: ["Open the mixer.", "Open the selected track’s piano/drum roll.", "Open the selected instrument or sampler.", "Open the drum machine.", "Open the sound browser.", "Open the effects rack.", "Open the on-screen keyboard.", "Open Studio View.", "Close the current editor and return to the timeline."][i] ?? "" })),
  ...([ ["loop", "l"], ["mute", "m"], ["split", "s"], ["quantize", "q"], ["selectTool", "v"], ["drawTool", "b"], ["splitTool", "c"], ["razorTool", "t"] ] as const).map(([id, key]) => ({ id, group: "Single-key alternatives", keys: key.toUpperCase(), key, description: ({loop:"Toggle loop playback.", mute:"Toggle selected-track mute.", split:"Split at the playhead.", quantize:"Quantize selected-track notes.", selectTool:"Select tool.", drawTool:"Draw tool.", splitTool:"Split tool.", razorTool:"Razor tool."})[id] })),
] as const;

export type ShortcutAction = (typeof SHORTCUTS)[number]["id"];
export function matchShortcut(event: { key: string; code?: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean; repeat: boolean; isComposing?: boolean; defaultPrevented: boolean }, blocked = false): ShortcutAction | undefined {
  if (blocked || event.repeat || event.isComposing || event.defaultPrevented) return;
  // Alt can produce a different character on macOS; use physical letter/digit codes.
  const key = event.altKey && /^(Key[A-Z]|Digit[0-9])$/.test(event.code ?? "") ? (event.code ?? "").replace(/^(Key|Digit)/, "").toLowerCase() : event.key.toLowerCase();
  return SHORTCUTS.find((s) => s.key.toLowerCase() === key && Boolean("mod" in s && s.mod) === (event.ctrlKey || event.metaKey) && Boolean("alt" in s && s.alt) === event.altKey && Boolean("shift" in s && s.shift) === event.shiftKey)?.id;
}