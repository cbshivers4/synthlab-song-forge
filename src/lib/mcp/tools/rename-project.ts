import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "rename_project",
  title: "Rename a project",
  description: "Rename one of the signed-in user's saved projects. Needs a plan that can save projects.",
  inputSchema: {
    project_id: z.string().uuid().describe("Project ID from list_projects."),
    name: z.string().trim().min(1).max(80).describe("The new project name."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ project_id, name }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Sign in to SYNCLAB first.");
    const db = supabaseForUser(ctx);
    const { data, error } = await db.from("cloud_projects").update({ name }).eq("id", project_id).select("id, name");
    if (error) throw new ToolError(`Could not rename the project: ${error.message}`);
    if (!data?.length) throw new ToolError("No saved project with that ID, or your plan can't save projects.");
    return { content: [{ type: "text", text: `Renamed to "${name}".` }], structuredContent: { id: project_id, name } };
  },
});
