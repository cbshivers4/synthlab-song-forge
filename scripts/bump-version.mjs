/**
 * SYNCLAB — version bump.
 *
 * Run this whenever you publish changes, so open tabs and desktop apps see the
 * update notice:
 *
 *   node scripts/bump-version.mjs 1.0.1 "Fixed the mixer faders."
 *
 * It updates the single source of truth (electron/app-info.cjs), the web
 * version file (public/app-version.json), the desktop release list version
 * (public/desktop-release.json) and SYNCLAB_VERSION in src/lib/synclab/support.ts.
 * Download URLs in desktop-release.json are left untouched.
 */
import { readFileSync, writeFileSync } from "node:fs";

const [, , version, notes = ""] = process.argv;
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("usage: node scripts/bump-version.mjs <x.y.z> [notes]");
  process.exit(1);
}

const patch = (path, fn) => writeFileSync(path, fn(readFileSync(path, "utf8")));

patch("electron/app-info.cjs", (s) => s.replace(/version: "[^"]+"/, `version: "${version}"`));
patch("src/lib/synclab/support.ts", (s) =>
  s.replace(/SYNCLAB_VERSION = "[^"]+"/, `SYNCLAB_VERSION = "${version}"`),
);

const appVersion = { version, notes };
writeFileSync("public/app-version.json", JSON.stringify(appVersion, null, 2) + "\n");

const release = JSON.parse(readFileSync("public/desktop-release.json", "utf8"));
release.version = version;
if (notes) release.notes = notes;
writeFileSync("public/desktop-release.json", JSON.stringify(release, null, 2) + "\n");

console.log(
  `SYNCLAB is now version ${version}. Publish the app so open tabs and desktop apps get the update notice.`,
);
