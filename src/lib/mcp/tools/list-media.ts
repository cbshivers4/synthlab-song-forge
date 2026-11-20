import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_media",
  title: "List media library",
  description:
    "List items in the signed-in user's SYNCLAB library (uploaded and exported audio/video, saved sounds and presets).",
  inputSchema: {
    kind: z
      .string()
      .max(40)
      .optional()
      .describe("Only this kind of item, e.g. audio, video, preset."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("How many items to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ kind, limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Sign in to SYNCLAB first.");
    const db = supabaseForUser(ctx);
    let query = db
      .from("library_items")
      .select("id, kind, folder, name, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (kind?.trim()) query = query.eq("kind", kind.trim());
    const { data, error } = await query;
    if (error) throw new ToolError(`Could not read the library: ${error.message}`);
    const items = (data ?? []).map((i) => ({
      id: i.id,
      kind: i.kind,
      folder: i.folder,
      name: i.name,
      createdAt: i.created_at,
    }));
    const text = items.length
      ? items
          .map(
            (i) => `${i.name} [${i.kind}${i.folder ? ` · ${i.folder}` : ""}] added ${i.createdAt}`,
          )
          .join("\n")
      : "The library is empty.";
    return { content: [{ type: "text", text }], structuredContent: { items } };
  },
});
