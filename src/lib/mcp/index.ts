import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProjects from "./tools/list-projects";
import getProject from "./tools/get-project";
import renameProject from "./tools/rename-project";
import listMedia from "./tools/list-media";
import getPlan from "./tools/get-plan";
import searchHelp from "./tools/search-help";

// Vite inlines the stable ref; the published SUPABASE_URL may be a proxy.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "synclab-app",
  title: "Synclab App",
  version: "1.0.0",
  instructions:
    "Tools for SYNCLAB, a music studio app. Read the signed-in musician's saved projects (tempo, key, tracks, effects, notes), rename projects, list their media library and plan, and search the Help Center. Playing, recording and editing sound happen in the open studio in the browser, not through these tools.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listProjects, getProject, renameProject, listMedia, getPlan, searchHelp],
});
