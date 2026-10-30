import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const security = require('../../../electron/security.cjs') as {
  isAllowedNavigation: (url: string, app: string) => boolean;
  isSafeExternal: (url: string) => boolean;
  allowPermission: (permission: string, url: string, app: string) => boolean;
  isTrustedSender: (url: string, origin: string, app: string) => boolean;
};
const APP = 'https://synclab-app.lovable.app/';

describe('desktop window trust rules', () => {
  it('the studio window stays on SYNCLAB and its sign-in pages', () => {
    expect(security.isAllowedNavigation('https://synclab-app.lovable.app/studio', APP)).toBe(true);
    expect(security.isAllowedNavigation('https://synclabsapp.com/', APP)).toBe(true);
    expect(security.isAllowedNavigation('https://oauth.lovable.app/initiate?x=1', APP)).toBe(true);
    expect(security.isAllowedNavigation('https://accounts.google.com/o/oauth2', APP)).toBe(true);
    expect(security.isAllowedNavigation('https://evil.example.com/', APP)).toBe(false);
    expect(security.isAllowedNavigation('http://accounts.google.com/', APP)).toBe(false);
  });
  it('only web and email links are handed to the operating system', () => {
    expect(security.isSafeExternal('https://example.com')).toBe(true);
    expect(security.isSafeExternal('mailto:christophershivers@synclabsapp.com')).toBe(true);
    expect(security.isSafeExternal('file:///etc/passwd')).toBe(false);
    expect(security.isSafeExternal('smb://server/share')).toBe(false);
  });
  it('microphone and MIDI are granted to SYNCLAB pages only', () => {
    expect(security.allowPermission('media', 'https://synclab-app.lovable.app/', APP)).toBe(true);
    expect(security.allowPermission('midi', 'https://evil.example.com/', APP)).toBe(false);
    expect(security.allowPermission('geolocation', 'https://synclab-app.lovable.app/', APP)).toBe(false);
  });
  it('native file actions answer SYNCLAB pages and its pop-out panels only', () => {
    expect(security.isTrustedSender('https://synclab-app.lovable.app/', 'https://synclab-app.lovable.app', APP)).toBe(true);
    expect(security.isTrustedSender('about:blank', 'https://synclab-app.lovable.app', APP)).toBe(true);
    expect(security.isTrustedSender('https://evil.example.com/', 'https://evil.example.com', APP)).toBe(false);
  });
});
