import { createRequire } from "node:module";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
type Studio = {
  owns: (url: string) => boolean;
  handle: (request: Request) => Promise<Response>;
  seedFrom: (dir: string) => number;
  capture: (paths: string[]) => Promise<number>;
};
const { createOfflineStudio, discoverAssets } = require("../../../electron/offline-studio.cjs") as {
  createOfflineStudio: (o: {
    appUrl: string;
    dir: string;
    fetchNetwork: (r: Request, s?: AbortSignal) => Promise<Response>;
    offline?: () => boolean;
    timeoutMs?: number;
  }) => Studio;
  discoverAssets: (text: string, url: string) => string[];
};

const APP = "https://synclabsapp.com/";
const SITE: Record<string, [string, string]> = {
  "/": [
    "text/html",
    '<script src="/assets/index-AAA.js"></script><link href="/assets/styles-BBB.css">',
  ],
  "/pricing": ["text/html", "<p>pricing</p>"],
  "/assets/index-AAA.js": ["text/javascript", 'import("./studio-CCC.js")'],
  "/assets/studio-CCC.js": [
    "text/javascript",
    'export const studio = 1; const img = "/assets/hw-DDD.jpg"',
  ],
  "/assets/styles-BBB.css": ["text/css", "body{}"],
  "/assets/hw-DDD.jpg": ["image/jpeg", "jpeg"],
};

function setup(dir = mkdtempSync(path.join(tmpdir(), "synclab-offline-"))) {
  const state = { offline: false, hits: [] as string[] };
  const fetchNetwork = async (r: Request) => {
    if (state.offline) throw new TypeError("net::ERR_INTERNET_DISCONNECTED");
    const p = new URL(r.url).pathname;
    state.hits.push(p);
    const page = SITE[p];
    return page
      ? new Response(page[1], { status: 200, headers: { "content-type": page[0] } })
      : new Response("nope", { status: 404 });
  };
  const studio = createOfflineStudio({
    appUrl: APP,
    dir,
    fetchNetwork,
    offline: () => state.offline,
  });
  return { studio, state, dir };
}
const page = (p: string) => new Request(new URL(p, APP), { headers: { accept: "text/html" } });
const settle = () => new Promise((r) => setTimeout(r, 50));

describe("desktop offline studio copy", () => {
  it("finds absolute, relative and nested code files", () => {
    expect(discoverAssets(SITE["/"]![1], APP).sort()).toEqual([
      "https://synclabsapp.com/assets/index-AAA.js",
      "https://synclabsapp.com/assets/styles-BBB.css",
    ]);
    expect(
      discoverAssets('import("./studio-CCC.js")', "https://synclabsapp.com/assets/index-AAA.js"),
    ).toEqual(["https://synclabsapp.com/assets/studio-CCC.js"]);
  });

  it("only answers the studio address and its fonts", () => {
    const { studio } = setup();
    expect(studio.owns("https://synclabsapp.com/assets/x.js")).toBe(true);
    expect(studio.owns("https://fonts.gstatic.com/s/sora.woff2")).toBe(true);
    expect(studio.owns("https://gbwxyctbdcfnauirdwwm.supabase.co/rest/v1/x")).toBe(false);
  });

  it("after one online visit the studio and every code file it reaches open offline", async () => {
    const { studio, state } = setup();
    expect(await (await studio.handle(page("/"))).text()).toContain("index-AAA");
    await settle();
    state.offline = true;
    const home = await studio.handle(page("/"));
    expect(home.status).toBe(200);
    expect(await home.text()).toContain("index-AAA");
    // The lazily loaded studio chunk was never requested by the page itself but is stored.
    expect(await (await studio.handle(new Request(APP + "assets/studio-CCC.js"))).text()).toContain(
      "studio = 1",
    );
    expect((await studio.handle(new Request(APP + "assets/hw-DDD.jpg"))).status).toBe(200);
  });

  it("online pages are always fetched fresh; versioned files come from the copy", async () => {
    const { studio, state } = setup();
    await studio.handle(page("/"));
    await settle();
    state.hits.length = 0;
    await studio.handle(page("/"));
    await studio.handle(new Request(APP + "assets/index-AAA.js"));
    expect(state.hits).toEqual(["/"]);
  });

  it("sign-in return links and unknown pages fall back to the stored studio page offline", async () => {
    const { studio, state } = setup();
    await studio.handle(page("/"));
    state.offline = true;
    expect(await (await studio.handle(page("/?code=abc"))).text()).toContain("index-AAA");
    expect(await (await studio.handle(page("/never-visited"))).text()).toContain("index-AAA");
  });

  it("server actions are never stored and fail clearly offline", async () => {
    const { studio, state, dir } = setup();
    state.offline = true;
    const res = await studio.handle(
      new Request(APP + "_serverFn/abc", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(503);
    state.offline = false;
    await studio.handle(new Request(APP + "_serverFn/abc"));
    expect(readdirSync(dir)).toEqual([]);
  });

  it("without any copy an offline page explains the internet is needed once", async () => {
    const { studio, state } = setup();
    state.offline = true;
    const res = await studio.handle(page("/"));
    expect(res.status).toBe(503);
    expect(await res.text()).toContain("Connect to the internet once");
  });

  it("a copy captured at packaging time works on the first offline launch", async () => {
    const packaged = setup();
    await packaged.studio.capture(["/", "/pricing"]);
    const user = setup();
    expect(user.studio.seedFrom(packaged.dir)).toBeGreaterThan(0);
    user.state.offline = true;
    expect(await (await user.studio.handle(page("/pricing"))).text()).toContain("pricing");
    expect(
      await (await user.studio.handle(new Request(APP + "assets/studio-CCC.js"))).text(),
    ).toContain("studio = 1");
  });
});
