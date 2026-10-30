/**
 * Stores a copy of the published SYNCLAB studio in build-resources/offline-studio so the
 * packaged desktop app opens even on its very first launch without internet.
 * Needs internet while packaging. The copy is whatever is published at that moment.
 *
 *   node scripts/capture-offline-studio.mjs
 */
import { createRequire } from "node:module";
import { rmSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const info = require("../electron/app-info.cjs");
const { createOfflineStudio } = require("../electron/offline-studio.cjs");

export async function captureOfflineStudio(dir = path.resolve("build-resources", "offline-studio")) {
  rmSync(dir, { recursive: true, force: true });
  const studio = createOfflineStudio({
    appUrl: info.website,
    dir,
    fetchNetwork: (request, signal) => fetch(request, signal ? { signal } : undefined),
  });
  const count = await studio.capture(["/", "/pricing", "/privacy", "/terms", "/refunds"]);
  console.log(`offline copy: ${count} files from ${info.website} → ${dir}`);
  return count;
}

if (import.meta.url === `file://${process.argv[1]}`) await captureOfflineStudio();
