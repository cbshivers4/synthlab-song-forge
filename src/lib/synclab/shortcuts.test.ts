import { describe, expect, it } from 'vitest';
import { matchShortcut, SHORTCUTS } from './shortcuts';
const event = (key: string, extra = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, repeat: false, defaultPrevented: false, ...extra });
describe('app keyboard commands', () => {
  it('matches every listed command with its exact modifiers', () => {
    for (const s of SHORTCUTS) expect(matchShortcut(event(s.key, { ctrlKey: 'mod' in s && s.mod, altKey: 'alt' in s && s.alt, shiftKey: 'shift' in s && s.shift }))).toBe(s.id);
  });
  it('saves manually with Ctrl+S and Command+S without confusing split or solo', () => {
    expect(matchShortcut(event('s', { ctrlKey: true }))).toBe('save');
    expect(matchShortcut(event('s', { metaKey: true }))).toBe('save');
    expect(matchShortcut(event('s'))).toBe('split');
    expect(matchShortcut(event('s', { altKey: true }))).toBe('solo');
  });
  it('does not repeat toggles or override typing, composition or claimed keys', () => {
    expect(matchShortcut(event(' ', { repeat: true }))).toBeUndefined();
    expect(matchShortcut(event('r'), true)).toBeUndefined();
    expect(matchShortcut(event('r', { isComposing: true }))).toBeUndefined();
    expect(matchShortcut(event('r', { defaultPrevented: true }))).toBeUndefined();
  });
  it('handles Mac Option keys and separates step and beat navigation', () => {
    expect(matchShortcut(event('®', { altKey: true, code: 'KeyR' }))).toBe('arm');
    expect(matchShortcut(event('ArrowRight'))).toBe('right');
    expect(matchShortcut(event('ArrowRight', { shiftKey: true }))).toBe('rightStep');
    expect(matchShortcut(event('s', { ctrlKey: true, altKey: true }))).toBeUndefined();
  });
});
