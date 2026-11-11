/**
 * SYNCLAB desktop trust rules — pure functions so they can be unit-tested without Electron.
 *
 * The studio window may only show SYNCLAB itself plus the sign-in pages it redirects through.
 * Everything else opens in the user's own browser, and only for web/email links.
 */

/** Hosts the sign-in flow passes through (Lovable broker, Google, Apple). Exact host or a subdomain. */
const AUTH_HOSTS = ["oauth.lovable.app", "accounts.google.com", "appleid.apple.com"];

function parse(url) {
  try {
    return new URL(String(url));
  } catch {
    return null;
  }
}

/** SYNCLAB's own pages: the configured studio origin and its official domains. */
function trustedOrigins(appUrl) {
  const app = parse(appUrl);
  const origins = new Set(["https://synclabsapp.com", "https://www.synclabsapp.com", "https://synclab-app.lovable.app"]);
  if (app) origins.add(app.origin);
  return origins;
}

function isAppUrl(url, appUrl) {
  const u = parse(url);
  return !!u && trustedOrigins(appUrl).has(u.origin);
}

const hostMatches = (host, allowed) => host === allowed || host.endsWith(`.${allowed}`);

/** May the studio window itself navigate here? SYNCLAB pages and HTTPS sign-in pages only. */
function isAllowedNavigation(url, appUrl) {
  if (isAppUrl(url, appUrl)) return true;
  const u = parse(url);
  return !!u && u.protocol === "https:" && AUTH_HOSTS.some((h) => hostMatches(u.hostname, h));
}

/** May this link be handed to the operating system? Web and email links only — never file:, custom schemes, etc. */
function isSafeExternal(url) {
  const u = parse(url);
  return !!u && (u.protocol === "https:" || u.protocol === "http:" || u.protocol === "mailto:");
}

/** Permissions the studio needs, granted only to SYNCLAB's own pages. */
const STUDIO_PERMISSIONS = new Set(["media", "audioCapture", "midi", "midiSysex", "speaker-selection", "display-capture"]);
function allowPermission(permission, requestingUrl, appUrl) {
  return STUDIO_PERMISSIONS.has(permission) && isAppUrl(requestingUrl, appUrl);
}

/** Native file actions only answer SYNCLAB's own page (pop-out panels are about:blank children of it). */
function isTrustedSender(frameUrl, frameOrigin, appUrl) {
  if (frameOrigin && frameOrigin !== "null" && trustedOrigins(appUrl).has(frameOrigin)) return true;
  return isAppUrl(frameUrl, appUrl);
}

/**
 * Applied to SYNCLAB's own responses. Blocks plugins/objects, embedding SYNCLAB inside other
 * sites, and base-URL hijacking. Script/style/connect sources are left to the web app, which
 * loads payments, sign-in and AI services from several domains.
 */
const CONTENT_SECURITY_POLICY = "object-src 'none'; base-uri 'self'; frame-ancestors 'self'";

module.exports = { AUTH_HOSTS, CONTENT_SECURITY_POLICY, allowPermission, isAllowedNavigation, isAppUrl, isSafeExternal, isTrustedSender, trustedOrigins };
