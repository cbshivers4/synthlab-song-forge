/**
 * SYNCLAB desktop — offline studio copy.
 *
 * The desktop window keeps showing https://synclabsapp.com (same address, same saved sign-in,
 * same local projects), but every page and code file it receives is also stored on this
 * computer. When the internet is down the window is served from that copy, so the studio
 * still opens and plays. A copy made at packaging time ships inside the app, so even the very
 * first launch works offline.
 *
 * Online:  pages are always fetched fresh (updates arrive without a new desktop release);
 *          versioned code files (/assets/…) are read from the copy because they never change.
 * Offline: pages and files come from the copy; sign-in, cloud saving, payments and AI tools
 *          need the internet and report their own connection errors.
 *
 * Pure Node (no Electron imports) so it is unit-tested with a fake network.
 */
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

/** Font files the studio loads from Google; cached too so the look survives offline. */
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];
/** Never cached: server actions, API routes, hosting internals (analytics, sign-in broker). */
const NETWORK_ONLY = [/^\/_serverFn\//, /^\/api\//, /^\/~/, /^\/__l5e\/(?!assets-v1\/)/];
/** File names in the build always carry a content hash, so a stored copy is always correct. */
const IMMUTABLE = [/^\/assets\//, /^\/__l5e\/assets-v1\//];
const PAGE_TIMEOUT_MS = 8000;
const KEEP_DAYS = 45;

/** Asset references inside HTML, JS and CSS (absolute /assets/…, relative ./chunk.js, CDN assets). */
const ASSET_RE = /(?:(?:\.{1,2})?\/)?(?:__l5e\/assets-v1\/[A-Za-z0-9_-]+\/|assets\/)[A-Za-z0-9_.-]+\.[A-Za-z0-9]{2,5}|["'`]\.\/[A-Za-z0-9_.-]+\.(?:js|css)["'`]/g;

function discoverAssets(text, fileUrl) {
  const base = new URL(fileUrl);
  const out = new Set();
  for (const match of String(text).matchAll(ASSET_RE)) {
    const ref = match[0].replace(/["'`]/g, "");
    const url = ref.startsWith("./") || ref.startsWith("../") ? new URL(ref, base) : new URL("/" + ref.replace(/^\.{0,2}\/+/, ""), base.origin);
    if (url.origin === base.origin) out.add(url.origin + url.pathname);
  }
  return [...out];
}

function isDocumentRequest(request) {
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}

function createOfflineStudio({ appUrl, dir, fetchNetwork, offline = () => false, now = () => Date.now(), timeoutMs = PAGE_TIMEOUT_MS }) {
  const app = new URL(appUrl);
  fs.mkdirSync(dir, { recursive: true });
  const warmed = new Set();

  /** Requests this copy answers: the studio's own address and its fonts. */
  function owns(url) {
    try {
      const u = new URL(url);
      return u.origin === app.origin || (u.protocol === "https:" && FONT_HOSTS.includes(u.hostname));
    } catch {
      return false;
    }
  }

  /** Pages are stored by path (sign-in return codes in ?query never become separate copies). */
  function keyFor(url, document) {
    const u = new URL(url);
    const id = u.origin === app.origin ? (document ? `page:${u.pathname}` : `file:${u.pathname}`) : `font:${u.href}`;
    return crypto.createHash("sha1").update(id).digest("hex");
  }

  async function read(key) {
    try {
      const meta = JSON.parse(await fsp.readFile(path.join(dir, `${key}.json`), "utf8"));
      const body = await fsp.readFile(path.join(dir, `${key}.body`));
      const t = new Date(now());
      fsp.utimes(path.join(dir, `${key}.json`), t, t).catch(() => {});
      return { meta, body };
    } catch {
      return null;
    }
  }

  async function write(key, url, response) {
    const body = Buffer.from(await response.arrayBuffer());
    const meta = { url, status: response.status, type: response.headers.get("content-type") || "application/octet-stream", savedAt: now() };
    const tmp = path.join(dir, `${key}.${process.pid}.tmp`);
    await fsp.writeFile(tmp, body);
    await fsp.rename(tmp, path.join(dir, `${key}.body`));
    await fsp.writeFile(path.join(dir, `${key}.json`), JSON.stringify(meta));
    return body;
  }

  const fromCopy = (hit, extra = {}) =>
    new Response(hit.body, { status: 200, headers: { "content-type": hit.meta.type, "x-synclab-offline-copy": "1", ...extra } });

  async function network(request, ms) {
    if (offline()) throw new Error("offline");
    if (!ms) return fetchNetwork(request);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetchNetwork(request, ctrl.signal);
    } finally {
      clearTimeout(timer);
    }
  }

  /** After a fresh page arrives, fetch every code file it can reach so the whole studio works offline. */
  async function warm(startUrl, text) {
    const queue = discoverAssets(text, startUrl);
    while (queue.length) {
      const url = queue.shift();
      if (warmed.has(url)) continue;
      warmed.add(url);
      const key = keyFor(url, false);
      let hit = await read(key);
      if (!hit) {
        try {
          if (offline()) return;
          const res = await fetchNetwork(new Request(url));
          if (!res.ok) continue;
          hit = { meta: { type: res.headers.get("content-type") || "" }, body: await write(key, url, res) };
        } catch {
          continue;
        }
      }
      if (/javascript|css|html/.test(hit.meta.type)) for (const next of discoverAssets(hit.body.toString("utf8"), url)) if (!warmed.has(next)) queue.push(next);
    }
  }

  async function handle(request) {
    const u = new URL(request.url);
    const sameOrigin = u.origin === app.origin;
    if (request.method !== "GET" || (sameOrigin && NETWORK_ONLY.some((re) => re.test(u.pathname)))) {
      try {
        return await network(request);
      } catch {
        return new Response("SYNCLAB is offline", { status: 503, headers: { "content-type": "text/plain" } });
      }
    }
    const document = sameOrigin && isDocumentRequest(request);
    const key = keyFor(request.url, document);
    const immutable = !sameOrigin ? u.hostname === "fonts.gstatic.com" : IMMUTABLE.some((re) => re.test(u.pathname));

    if (immutable) {
      const hit = await read(key);
      if (hit) return fromCopy(hit, { "cache-control": "public, max-age=31536000, immutable" });
    }
    try {
      const res = await network(request, document ? timeoutMs : 0);
      if (res.status !== 200) return res;
      const body = await write(key, request.url, res.clone());
      if (document) void warm(request.url, body.toString("utf8"));
      return res;
    } catch {
      const hit = (await read(key)) || (document ? await read(keyFor(app.origin + "/", true)) : null);
      if (hit) return fromCopy(hit);
      if (document) return new Response(offlinePage(), { status: 503, headers: { "content-type": "text/html; charset=utf-8" } });
      return new Response("", { status: 504 });
    }
  }

  /** Ship-time copy → this computer, without overwriting anything newer already stored. */
  function seedFrom(seedDir) {
    if (!seedDir || !fs.existsSync(seedDir)) return 0;
    let copied = 0;
    for (const name of fs.readdirSync(seedDir)) {
      if (!/^[0-9a-f]{40}\.(json|body)$/.test(name)) continue;
      const target = path.join(dir, name);
      if (fs.existsSync(target)) continue;
      fs.copyFileSync(path.join(seedDir, name), target);
      copied++;
    }
    return copied;
  }

  /** Drops stored files nobody has used for a long time (old app versions). Pages are kept. */
  async function prune(keepDays = KEEP_DAYS) {
    const cutoff = now() - keepDays * 86400000;
    let removed = 0;
    for (const name of await fsp.readdir(dir)) {
      if (!name.endsWith(".json")) continue;
      const file = path.join(dir, name);
      try {
        const [stat, meta] = [await fsp.stat(file), JSON.parse(await fsp.readFile(file, "utf8"))];
        if (stat.mtimeMs >= cutoff || new URL(meta.url).pathname === "/" || !IMMUTABLE.some((re) => re.test(new URL(meta.url).pathname))) continue;
        await fsp.rm(file, { force: true });
        await fsp.rm(file.replace(/\.json$/, ".body"), { force: true });
        removed++;
      } catch {
        /* unreadable entry: leave it */
      }
    }
    return removed;
  }

  /** Stores pages and everything they reach (used at packaging time). */
  async function capture(paths) {
    for (const p of paths) {
      const url = new URL(p, app.origin).href;
      const res = await fetchNetwork(new Request(url, { headers: { accept: "text/html" } }));
      if (res.status !== 200) throw new Error(`${url} answered ${res.status}`);
      const body = await write(keyFor(url, true), url, res);
      await warm(url, body.toString("utf8"));
    }
    return fs.readdirSync(dir).filter((n) => n.endsWith(".json")).length;
  }

  return { owns, handle, seedFrom, prune, capture, keyFor };
}

function offlinePage() {
  return `<!doctype html><meta charset="utf-8"><title>SYNCLAB</title>
<body style="background:#0a0a0c;color:#e6e6e6;font:14px system-ui;padding:40px">
<h2>SYNCLAB is offline</h2>
<p>This page hasn't been stored on this computer yet. Connect to the internet once and it will be kept for offline use.</p>
<p><a style="color:#5eead4" href="/">Open the studio</a></p></body>`;
}

module.exports = { createOfflineStudio, discoverAssets, FONT_HOSTS };
