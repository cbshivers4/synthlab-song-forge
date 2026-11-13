import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { KNOWLEDGE_BASE } from "@/lib/synclab/help-articles";
import { searchLibrary } from "@/lib/synclab/library-search";

export default defineTool({
  name: "search_help",
  title: "Search SYNCLAB help",
  description: "Search the SYNCLAB Help Center and return the best matching articles: how to use a feature, what it can do and what it can't.",
  inputSchema: {
    query: z.string().trim().min(1).max(200).describe("What to look up, e.g. \"record vocals\", \"DJ decks\", \"MIDI keyboard\"."),
    limit: z.number().int().min(1).max(5).optional().describe("How many articles to return in full (default 2)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Sign in to SYNCLAB first.");
    const entries = KNOWLEDGE_BASE.map((a) => ({ id: a.id, kind: "help" as const, title: a.title, sub: a.category, tags: a.tags }));
    const hits = searchLibrary(entries, query, "help").slice(0, limit ?? 2);
    const articles = hits.flatMap((h) => {
      const a = KNOWLEDGE_BASE.find((x) => x.id === h.id);
      return a ? [{ id: a.id, title: a.title, category: a.category, howTo: [...a.body], canDo: [...a.can], cantDo: [...a.cant] }] : [];
    });
    if (!articles.length) return { content: [{ type: "text", text: `No help articles matched "${query}".` }], structuredContent: { articles: [] } };
    const text = articles.map((a) => [`# ${a.title} (${a.category})`, ...a.howTo, "What you can do:", ...a.canDo.map((x) => `- ${x}`), "What you can't do:", ...a.cantDo.map((x) => `- ${x}`)].join("\n")).join("\n\n");
    return { content: [{ type: "text", text }], structuredContent: { articles } };
  },
});
