/**
 * SYNCLAB — desktop packaging.
 *
 * Produces a real Electron application folder per platform and zips it with a
 * version-stamped name. Signing, notarization and .dmg / .exe installers need a
 * macOS or Windows machine with the right toolchain — see DESKTOP_BUILD.md. This
 * script never fabricates those files.
 *
 *   node scripts/build-desktop.mjs --platform=darwin --arch=arm64
 *   node scripts/build-desktop.mjs --platform=win32  --arch=x64
 */
import { packager } from "@electron/packager";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const info = require("../electron/app-info.cjs");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);

const platform = args.platform || process.platform;
const arch = args.arch || "x64";
// Builds are hundreds of MB — keep them outside the repository by default.
const out = path.resolve(args.out || process.env.SYNCLAB_OUT || "/tmp/synclab-release");
const icon = path.resolve("build-resources", "icon"); // packager appends .icns/.ico/.png

mkdirSync(out, { recursive: true });

const appPaths = await packager({
  dir: process.cwd(),
  name: info.productName,
  appVersion: info.version,
  buildVersion: info.version,
  appBundleId: info.appId,
  appCopyright: info.copyright,
  platform,
  arch,
  out,
  overwrite: true,
  icon,
  extendInfo: {
    NSMicrophoneUsageDescription:
      "SYNCLAB records from your microphone or audio interface into tracks and sampler pads.",
    NSCameraUsageDescription: "SYNCLAB does not use the camera.",
  },
  win32metadata: {
    CompanyName: info.publisher,
    FileDescription: info.description,
    ProductName: info.productName,
    InternalName: info.productName,
  },
  ignore: [
    /^\/src/,
    /^\/public/,
    /^\/supabase/,
    /^\/scripts/,
    /^\/electron-release/,
    /^\/\.lovable/,
    /^\/\.git/,
    /^\/node_modules\/(?!ws(?:\/|$))/,
    /^\/dist/,
  ],
});

const label = platform === "darwin" ? "macOS" : platform === "win32" ? "Windows" : "Linux";
for (const built of appPaths) {
  const zip = path.join(out, `SYNCLAB-${info.version}-${label}-${arch}.zip`);
  execFileSync("zip", ["-qry", zip, path.basename(built)], { cwd: path.dirname(built), stdio: "inherit" });
  console.log(`packaged ${built}\nzipped    ${zip}`);
}
