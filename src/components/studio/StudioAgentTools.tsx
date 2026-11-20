import { useWebMCP } from "use-webmcp-tool";
import { useStudio } from "@/lib/synclab/store";
import { useMaybeApp } from "@/lib/synclab/app-state";
import { KIND_LABEL } from "@/lib/synclab/presets";
import { faderGain, faderPosition } from "@/lib/synclab/fader-taper";
import { LIBRARY_KINDS, searchLibrary, type LibraryKind } from "@/lib/synclab/library-search";
import { LIBRARY_PANELS, useLibraryActions } from "@/components/studio/library-actions";
import { runWebMCPTool } from "@/lib/webmcp-telemetry";
import type { TrackKind } from "@/lib/synclab/types";

/** Same range as the tempo slider in the transport bar. */
const BPM_MIN = 60;
const BPM_MAX = 190;
const TRACK_KINDS: TrackKind[] = ["instrument", "drum", "sampler", "audio", "midi"];
const TRANSPORT_ACTIONS = ["play", "pause", "stop", "start_recording", "stop_recording"] as const;
type TransportAction = (typeof TRANSPORT_ACTIONS)[number];

const db = (gain: number) => (gain > 0 ? `${(20 * Math.log10(gain)).toFixed(1)} dB` : "−∞ dB");
const isBool = (v: unknown) => typeof v === "boolean";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Browser tools an AI assistant in an agent browser can call while the studio is open.
 * Every tool runs the same store action as the matching button, in the signed-in user's tab.
 */
export function StudioAgentTools() {
  const studio = useStudio();
  const app = useMaybeApp();
  const library = useLibraryActions();
  const { tracks, transport, panel, selected } = studio;
  const visible = tracks.filter((t) => !t.hidden);

  const findTrack = (id: unknown) => {
    if (typeof id !== "string" || !id)
      throw new Error("track_id is required — use get_studio_state to find track IDs.");
    const track = visible.find((t) => t.id === id);
    if (!track) throw new Error("That track is not in the current project view.");
    return track;
  };

  useWebMCP({
    name: "get_studio_state",
    description:
      "Read the open SYNCLAB project: tempo, loop, play/record state, open panel, selected track, and every track with its ID, type, fader, pan, mute/solo/arm and effects.",
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: () =>
      runWebMCPTool("get_studio_state", () => {
        const head = [
          `Project: ${app?.project?.name ?? "Untitled"}`,
          `Tempo ${transport.bpm} BPM · ${transport.bars} bars · loop ${transport.loop ? "on" : "off"} · metronome ${transport.metronome ? "on" : "off"}`,
          `Transport: ${transport.recording ? "recording" : transport.playing ? "playing" : transport.paused ? "paused" : "stopped"}`,
          `Open panel: ${panel ?? "timeline"} · Selected track: ${selected ? `${selected.name} (${selected.id})` : "none"}`,
        ];
        const rows = visible.map((t) => {
          const fx = t.plugins?.length
            ? ` · effects: ${t.plugins.map((p) => `${p.name}${p.bypass ? " (bypassed)" : ""}`).join(", ")}`
            : "";
          const flags = [t.muted && "muted", t.solo && "solo", t.armed && "armed"]
            .filter(Boolean)
            .join(", ");
          return `${t.id}: ${t.name} [${KIND_LABEL[t.kind] ?? t.kind}] fader ${faderPosition(t.volume).toFixed(2)} (${db(t.volume)}) pan ${t.pan.toFixed(2)}${flags ? ` · ${flags}` : ""}${fx}`;
        });
        return [...head, rows.length ? "Tracks:" : "No tracks yet.", ...rows].join("\n");
      }),
  });

  useWebMCP({
    name: "control_transport",
    description:
      "Start or stop the song: play, pause, stop (returns to the start), start_recording on the armed track, or stop_recording.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [...TRANSPORT_ACTIONS],
          description: "What the transport should do.",
        },
      },
      required: ["action"],
    },
    execute: ({ action }: { action: TransportAction }) =>
      runWebMCPTool("control_transport", async () => {
        if (!TRANSPORT_ACTIONS.includes(action))
          throw new Error(
            "Unknown action; expected play, pause, stop, start_recording or stop_recording.",
          );
        if (action === "play") {
          if (!transport.playing) studio.togglePlay();
          return "Playing.";
        }
        if (action === "pause") {
          if (transport.playing) studio.pause();
          return "Paused.";
        }
        if (action === "stop") {
          await studio.stop();
          return "Stopped.";
        }
        if (action === "start_recording") {
          if (!tracks.some((t) => t.armed))
            throw new Error("No track is armed for recording — arm one with set_track_mix first.");
          if (!transport.recording) studio.toggleRecord();
          return "Recording started.";
        }
        if (transport.recording) studio.toggleRecord();
        return "Recording stopped.";
      }),
  });

  useWebMCP({
    name: "set_transport",
    description: `Change song settings: tempo (${BPM_MIN}–${BPM_MAX} BPM), loop on/off and metronome on/off. Omit what should stay the same.`,
    inputSchema: {
      type: "object",
      properties: {
        bpm: {
          type: "number",
          minimum: BPM_MIN,
          maximum: BPM_MAX,
          description: "Tempo in beats per minute (whole numbers).",
        },
        loop: { type: "boolean", description: "Loop playback between the loop markers." },
        metronome: { type: "boolean", description: "Click track during playback." },
      },
    },
    execute: (args: { bpm?: number; loop?: boolean; metronome?: boolean }) =>
      runWebMCPTool("set_transport", () => {
        const patch: { bpm?: number; loop?: boolean; metronome?: boolean } = {};
        if (args.bpm !== undefined) {
          if (
            !isNum(args.bpm) ||
            !Number.isInteger(args.bpm) ||
            args.bpm < BPM_MIN ||
            args.bpm > BPM_MAX
          )
            throw new Error(`bpm must be a whole number from ${BPM_MIN} to ${BPM_MAX}.`);
          patch.bpm = args.bpm;
        }
        if (args.loop !== undefined) {
          if (!isBool(args.loop)) throw new Error("loop must be true or false.");
          patch.loop = args.loop;
        }
        if (args.metronome !== undefined) {
          if (!isBool(args.metronome)) throw new Error("metronome must be true or false.");
          patch.metronome = args.metronome;
        }
        if (!Object.keys(patch).length)
          throw new Error("Nothing to change — pass bpm, loop or metronome.");
        studio.setTransport(patch);
        return `Updated ${Object.keys(patch).join(", ")}.`;
      }),
  });

  useWebMCP({
    name: "add_track",
    description:
      "Add a new empty track: instrument (synth), drum (drum machine), sampler, audio (microphone/interface) or midi (external hardware).",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: TRACK_KINDS, description: "Type of track to add." },
      },
      required: ["kind"],
    },
    execute: ({ kind }: { kind: TrackKind }) =>
      runWebMCPTool("add_track", () => {
        if (!TRACK_KINDS.includes(kind))
          throw new Error("Unknown kind; expected instrument, drum, sampler, audio or midi.");
        const id = studio.addTrack(kind);
        return `Added a ${KIND_LABEL[kind] ?? kind} track (${id}).`;
      }),
  });

  useWebMCP({
    name: "set_track_mix",
    description:
      "Change one track's mixer settings: fader position (0–1, 0.8 = 0 dB, like the mixer fader), pan (-1 left to 1 right), mute, solo or record arm. Omit what should stay the same.",
    annotations: { untrustedContentHint: true },
    inputSchema: {
      type: "object",
      properties: {
        track_id: { type: "string", description: "Track ID from get_studio_state." },
        fader: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description: "Fader position 0–1 (0.8 is unity gain, 1 is +6 dB).",
        },
        pan: {
          type: "number",
          minimum: -1,
          maximum: 1,
          description: "Pan from -1 (left) to 1 (right).",
        },
        muted: { type: "boolean", description: "Mute the track." },
        solo: { type: "boolean", description: "Solo the track." },
        armed: { type: "boolean", description: "Arm the track for recording." },
      },
      required: ["track_id"],
    },
    execute: (args: {
      track_id: string;
      fader?: number;
      pan?: number;
      muted?: boolean;
      solo?: boolean;
      armed?: boolean;
    }) =>
      runWebMCPTool("set_track_mix", () => {
        const track = findTrack(args.track_id);
        const patch: {
          volume?: number;
          pan?: number;
          muted?: boolean;
          solo?: boolean;
          armed?: boolean;
        } = {};
        if (args.fader !== undefined) {
          if (!isNum(args.fader) || args.fader < 0 || args.fader > 1)
            throw new Error("fader must be a number from 0 to 1.");
          patch.volume = faderGain(args.fader);
        }
        if (args.pan !== undefined) {
          if (!isNum(args.pan) || args.pan < -1 || args.pan > 1)
            throw new Error("pan must be a number from -1 to 1.");
          patch.pan = args.pan;
        }
        for (const key of ["muted", "solo", "armed"] as const) {
          const v = args[key];
          if (v !== undefined) {
            if (!isBool(v)) throw new Error(`${key} must be true or false.`);
            patch[key] = v;
          }
        }
        if (!Object.keys(patch).length)
          throw new Error("Nothing to change — pass fader, pan, muted, solo or armed.");
        studio.updateTrack(track.id, patch);
        return `Updated ${track.name}${patch.volume !== undefined ? ` (fader ${db(patch.volume)})` : ""}.`;
      }),
  });

  useWebMCP({
    name: "select_track",
    description: "Select a track so synth sounds and effects load onto it.",
    annotations: { untrustedContentHint: true },
    inputSchema: {
      type: "object",
      properties: { track_id: { type: "string", description: "Track ID from get_studio_state." } },
      required: ["track_id"],
    },
    execute: ({ track_id }: { track_id: string }) =>
      runWebMCPTool("select_track", () => {
        const track = findTrack(track_id);
        studio.select(track.id);
        return `Selected ${track.name}.`;
      }),
  });

  useWebMCP({
    name: "open_panel",
    description:
      "Open a studio screen such as the mixer, synth editor, drum machine, piano roll, FX rack, reel-to-reel recorder or DJ Decks.",
    inputSchema: {
      type: "object",
      properties: {
        panel: {
          type: "string",
          enum: LIBRARY_PANELS.map((p) => p.id),
          description: "Which screen to open.",
        },
      },
      required: ["panel"],
    },
    execute: ({ panel: target }: { panel: string }) =>
      runWebMCPTool("open_panel", () => library.load(`panel:${target}`)),
  });

  useWebMCP({
    name: "search_library",
    description:
      "Search SYNCLAB's library of synth sounds, drum kits, effects, effect presets, tools and help by typing words (like the ⌘K search). Returns item IDs to pass to load_library_item.",
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: 'Words to search for, e.g. "dub delay", "808", "warm pad".',
        },
        category: {
          type: "string",
          enum: ["all", ...LIBRARY_KINDS.map((k) => k.id)],
          description: "Limit results to one category (default all).",
        },
      },
      required: ["query"],
    },
    execute: ({ query, category }: { query: string; category?: LibraryKind | "all" }) =>
      runWebMCPTool("search_library", () => {
        if (typeof query !== "string" || !query.trim()) throw new Error("query is required.");
        const kind = category ?? "all";
        if (kind !== "all" && !LIBRARY_KINDS.some((k) => k.id === kind))
          throw new Error("Unknown category.");
        const results = searchLibrary(library.catalog(), query, kind).slice(0, 25);
        if (!results.length) return `Nothing matched "${query}".`;
        return results.map((e) => `${e.id} — ${e.title}${e.sub ? ` (${e.sub})` : ""}`).join("\n");
      }),
  });

  useWebMCP({
    name: "load_library_item",
    description:
      "Load a search_library result: synth sounds go on the selected synth track, effects and effect presets go on the selected track, kits and new tracks are added, panels and help open.",
    annotations: { untrustedContentHint: true },
    inputSchema: {
      type: "object",
      properties: {
        item_id: { type: "string", description: "Item ID returned by search_library." },
      },
      required: ["item_id"],
    },
    execute: ({ item_id }: { item_id: string }) =>
      runWebMCPTool("load_library_item", () => {
        if (typeof item_id !== "string" || !item_id) throw new Error("item_id is required.");
        const known = library.catalog().some((e) => e.id === item_id);
        if (!known) throw new Error("Unknown item — use an ID from search_library.");
        return library.load(item_id);
      }),
  });

  return null;
}
