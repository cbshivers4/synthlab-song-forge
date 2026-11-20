import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_projects",
  title: "List saved projects",
  description:
    "List the signed-in user's saved SYNCLAB projects, newest first, with tempo, key and time signature.",
  inputSchema: {
    search: z.string().max(100).optional().describe("Only projects whose name contains this text."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("How many projects to return (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Sign in to SYNCLAB first.");
    const db = supabaseForUser(ctx);
    let query = db
      .from("cloud_projects")
      .select("id, name, bpm, musical_key, time_signature, template, updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit ?? 25);
    if (search?.trim()) query = query.ilike("name", `%${search.trim().replace(/[%_]/g, "")}%`);
    const { data, error } = await query;
    if (error) throw new ToolError(`Could not read projects: ${error.message}`);
    const projects = (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      bpm: p.bpm,
      key: p.musical_key,
      timeSignature: p.time_signature,
      template: p.template,
      updatedAt: p.updated_at,
    }));
    const text = projects.length
      ? projects
          .map(
            (p) =>
              `${p.id}: ${p.name} — ${p.bpm} BPM, ${p.key}, ${p.timeSignature}, saved ${p.updatedAt}`,
          )
          .join("\n")
      : "No saved projects.";
    return { content: [{ type: "text", text }], structuredContent: { projects } };
  },
});
