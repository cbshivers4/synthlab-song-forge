import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const KIND: Record<string, string> = {
  audio: "Audio",
  instrument: "Synth",
  midi: "External MIDI",
  drum: "Drum machine",
  sampler: "Sampler",
  "ai-vocal": "AI vocal",
};
type RawTrack = {
  id?: unknown;
  name?: unknown;
  kind?: unknown;
  volume?: unknown;
  pan?: unknown;
  muted?: unknown;
  solo?: unknown;
  hidden?: unknown;
  plugins?: unknown;
  patch?: unknown;
};
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export default defineTool({
  name: "get_project",
  title: "Get project details",
  description:
    "Describe one saved project: tempo, bars, song sections, notes and each track's type, instrument sound, level, pan, mute/solo and effects.",
  inputSchema: { project_id: z.string().uuid().describe("Project ID from list_projects.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ project_id }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Sign in to SYNCLAB first.");
    const db = supabaseForUser(ctx);
    const { data, error } = await db
      .from("cloud_projects")
      .select(
        "id, name, bpm, musical_key, time_signature, updated_at, tracks:session->tracks, transport:session->transport, sections:session->sections, notes:session->projectNotes",
      )
      .eq("id", project_id)
      .maybeSingle();
    if (error) throw new ToolError(`Could not read the project: ${error.message}`);
    if (!data) throw new ToolError("No saved project with that ID.");
    const row = data as unknown as {
      id: string;
      name: string;
      bpm: number;
      musical_key: string;
      time_signature: string;
      updated_at: string;
      tracks: unknown;
      transport: unknown;
      sections: unknown;
      notes: unknown;
    };
    const transport = (row.transport && typeof row.transport === "object" ? row.transport : {}) as {
      bars?: unknown;
      loop?: unknown;
    };
    const tracks = (Array.isArray(row.tracks) ? (row.tracks as RawTrack[]) : [])
      .filter((t) => t && !t.hidden)
      .slice(0, 200)
      .map((t) => ({
        id: str(t.id),
        name: str(t.name),
        type: KIND[str(t.kind)] ?? str(t.kind),
        sound:
          t.patch && typeof t.patch === "object" ? str((t.patch as { name?: unknown }).name) : "",
        volume: Math.round(num(t.volume) * 100) / 100,
        pan: Math.round(num(t.pan) * 100) / 100,
        muted: t.muted === true,
        solo: t.solo === true,
        effects: Array.isArray(t.plugins)
          ? (t.plugins as { name?: unknown; bypass?: unknown }[]).map((p) => ({
              name: str(p?.name),
              bypassed: p?.bypass === true,
            }))
          : [],
      }));
    const sections = (
      Array.isArray(row.sections)
        ? (row.sections as { name?: unknown; start?: unknown; length?: unknown }[])
        : []
    ).map((s) => ({ name: str(s?.name), start: num(s?.start), length: num(s?.length) }));
    const project = {
      id: row.id,
      name: row.name,
      bpm: row.bpm,
      key: row.musical_key,
      timeSignature: row.time_signature,
      updatedAt: row.updated_at,
      bars: num(transport.bars),
      notes: str(row.notes).slice(0, 4000),
      sections,
      tracks,
    };
    const lines = [
      `${project.name} — ${project.bpm} BPM, ${project.key}, ${project.timeSignature}, ${project.bars} bars, saved ${project.updatedAt}`,
      sections.length ? `Sections: ${sections.map((s) => s.name).join(", ")}` : "No song sections.",
      ...tracks.map(
        (t) =>
          `• ${t.name} [${t.type}${t.sound ? `: ${t.sound}` : ""}] vol ${t.volume} pan ${t.pan}${t.muted ? " muted" : ""}${t.solo ? " solo" : ""}${t.effects.length ? ` · ${t.effects.map((e) => e.name).join(", ")}` : ""}`,
      ),
      project.notes ? `Notes: ${project.notes}` : "",
    ].filter(Boolean);
    return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: { project } };
  },
});
