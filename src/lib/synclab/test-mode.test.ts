import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { TEST_MODE, installNetworkGuard, isAllowedRequest, readTestFlag, studioEntry } from './test-mode';

const ORIGIN = 'https://synclabsapp.com';
const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

describe('test mode (?test=1)', () => {
  it('turns on only for ?test=1', () => {
    expect(readTestFlag('?test=1')).toBe(true);
    expect(readTestFlag('')).toBe(false);
    expect(readTestFlag('?test=0')).toBe(false);
    expect(readTestFlag('?test=true')).toBe(false);
    expect(readTestFlag('?demo=1')).toBe(false);
  });

  it('without the flag, window.__synclabTest does not exist and the sign-in flow is unchanged', () => {
    expect(TEST_MODE).toBe(false);
    expect((globalThis as { __synclabTest?: unknown }).__synclabTest).toBeUndefined();
    expect(studioEntry(false, 'welcome')).toBe('welcome');
    expect(studioEntry(false, 'start')).toBe('start');
    expect(studioEntry(false, 'studio')).toBe('studio');
    expect(studioEntry(true, 'welcome')).toBe('test');
  });

  it('the normal entry still mounts the sign-in screen and the real plan provider', () => {
    const route = read('../../routes/index.tsx');
    expect(route).toMatch(/stage === "welcome" && [^\n]*<WelcomeScreen \/>/);
    expect(route).toMatch(/function Stages\(\)[\s\S]*?<PlanProvider>/);
    // The test studio is reachable only behind the ?test=1 check.
    expect(route).toMatch(/if \(asked\) return studioEntry\(booted && TEST_MODE, "loading"\) === "test" \? <TestStages \/>/);
  });

  it('test-mode code imports no account, payment, cloud or backend module', () => {
    const banned = /integrations\/supabase|paddle|payments|\/plan["']|\/cloud["']|library["']|support["']|auth/i;
    for (const file of ['./test-mode.ts', '../../components/studio/TestMode.tsx']) {
      const imports = read(file).match(/^import[^\n]*from\s+["'][^"']+["']/gm) ?? [];
      for (const line of imports) expect(line, `${file}: ${line}`).not.toMatch(banned);
    }
  });

  it('refuses every request that would leave the site, including backend and server functions', async () => {
    expect(isAllowedRequest('/assets/app.js', ORIGIN)).toBe(true);
    expect(isAllowedRequest('blob:https://synclabsapp.com/x', ORIGIN)).toBe(true);
    expect(isAllowedRequest('https://abc.supabase.co/rest/v1/cloud_projects', ORIGIN)).toBe(false);
    expect(isAllowedRequest('https://abc.supabase.co/auth/v1/token', ORIGIN)).toBe(false);
    expect(isAllowedRequest('wss://abc.supabase.co/realtime/v1', ORIGIN)).toBe(false);
    expect(isAllowedRequest('https://checkout.paddle.com/', ORIGIN)).toBe(false);
    expect(isAllowedRequest('/_serverFn/abc', ORIGIN)).toBe(false);
    expect(isAllowedRequest('/api/public/paddle-webhook', ORIGIN)).toBe(false);

    const real = vi.fn(async () => new Response('ok'));
    const win = { location: { origin: ORIGIN }, fetch: real as unknown as typeof fetch };
    const guard = installNetworkGuard(win);
    await expect(win.fetch('https://abc.supabase.co/rest/v1/subscriptions')).rejects.toThrow(/test mode/);
    await expect(win.fetch(`${ORIGIN}/_serverFn/coproducer`)).rejects.toThrow(/test mode/);
    await win.fetch('/assets/kick.wav');
    expect(real).toHaveBeenCalledTimes(1);
    expect(guard.blocked()).toBe(2);
  });
});
