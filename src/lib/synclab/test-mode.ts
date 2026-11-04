/**
 * Test mode: opened only with `?test=1` in the address. Read once at page load and never stored,
 * so a normal visit can never land in it. In test mode the studio opens a fixed local demo,
 * nothing is saved, and every request that would leave this site (accounts, cloud, payments,
 * AI, analytics) is refused before it is sent.
 *
 * Keep this module free of imports: it must load before anything that talks to a server.
 */

export const TEST_MODE_MESSAGE = "Not available in test mode — nothing is saved or sent.";

/** True when the address asks for test mode. */
export function readTestFlag(search: string): boolean {
  return new URLSearchParams(search).get("test") === "1";
}

/** Read once at boot (browser only). */
export const TEST_MODE: boolean = typeof window !== "undefined" && readTestFlag(window.location.search);

/** Which screen the studio route shows. Outside test mode this is always the normal stage. */
export function studioEntry<S extends string>(testMode: boolean, stage: S): S | "test" {
  return testMode ? "test" : stage;
}

/** Local page files only: same-site files, blob: and data: URLs. Server functions and API routes are refused too. */
export function isAllowedRequest(url: string, origin: string): boolean {
  let u: URL;
  try {
    u = new URL(url, origin);
  } catch {
    return false;
  }
  if (u.protocol === "blob:" || u.protocol === "data:") return true;
  const sameSite = u.origin === origin || (u.protocol.startsWith("ws") && u.host === new URL(origin).host);
  if (!sameSite) return false;
  return !u.pathname.startsWith("/_serverFn") && !u.pathname.startsWith("/api/");
}

const urlOf = (input: unknown): string => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  if (input && typeof input === "object" && "url" in input) return String((input as { url: string }).url);
  return String(input);
};

type GuardWindow = {
  location: { origin: string };
  fetch: typeof fetch;
  WebSocket?: typeof WebSocket;
  XMLHttpRequest?: typeof XMLHttpRequest;
  navigator?: { sendBeacon?: (url: string, data?: unknown) => boolean };
};

/** Refuse every request that would leave this site. Returns how many were refused (for tests). */
export function installNetworkGuard(win: GuardWindow): { blocked: () => number } {
  let blocked = 0;
  const origin = win.location.origin;
  const refuse = (url: string) => {
    blocked++;
    console.info(`[test mode] blocked request to ${url.split("?")[0]}`);
  };
  const realFetch = win.fetch.bind(win);
  win.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = urlOf(input);
    if (isAllowedRequest(url, origin)) return realFetch(input, init);
    refuse(url);
    return Promise.reject(new TypeError(TEST_MODE_MESSAGE));
  }) as typeof fetch;
  const RealWS = win.WebSocket;
  if (RealWS) {
    win.WebSocket = new Proxy(RealWS, {
      construct(target, args: [string | URL, (string | string[])?]) {
        const url = urlOf(args[0]);
        if (!isAllowedRequest(url, origin)) {
          refuse(url);
          throw new Error(TEST_MODE_MESSAGE);
        }
        return new target(...args);
      },
    });
  }
  const XHR = win.XMLHttpRequest;
  if (XHR) {
    const open = XHR.prototype.open;
    XHR.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
      const href = urlOf(url);
      if (!isAllowedRequest(href, origin)) {
        refuse(href);
        throw new Error(TEST_MODE_MESSAGE);
      }
      return (open as (...a: unknown[]) => void).call(this, method, url, ...rest);
    } as typeof XHR.prototype.open;
  }
  if (win.navigator?.sendBeacon) {
    const beacon = win.navigator.sendBeacon.bind(win.navigator);
    win.navigator.sendBeacon = (url: string, data?: unknown) => {
      if (isAllowedRequest(url, origin)) return beacon(url, data);
      refuse(url);
      return false;
    };
  }
  return { blocked: () => blocked };
}

if (TEST_MODE) installNetworkGuard(window as unknown as GuardWindow);
