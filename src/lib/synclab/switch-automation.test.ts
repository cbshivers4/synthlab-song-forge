import { describe, expect, it } from 'vitest';
import { switchEdge, switchStateAt, writeSwitchStep } from './switch-automation';

describe('recorded mute/solo', () => {
  it('records a mute press during a take with its step and replays it', () => {
    // take starts at step 0 unmuted; user mutes at step 8
    let events = writeSwitchStep(undefined, -1, 0, false, false, 0) ?? undefined;
    expect(events).toBeUndefined();
    events = writeSwitchStep(events, 7, 8, true, false, 0)!;
    expect(events).toEqual([{ step: 0, on: false }, { step: 8, on: true }]);
    expect(switchStateAt(events, 4)).toBe(false);
    expect(switchStateAt(events, 12)).toBe(true);
  });
  it('recording over earlier presses replaces them', () => {
    const old = [{ step: 0, on: false }, { step: 8, on: true }, { step: 12, on: false }];
    // new take passes steps 4..12 with the button left off: the old presses at 8 and 12 go away
    let events = old;
    for (let s = 4; s <= 12; s++) events = writeSwitchStep(events, s - 1, s, false, false, 4) ?? events;
    expect(events).toEqual([{ step: 0, on: false }]);
  });
  it('replay only sets the button at recorded presses, so manual presses between them stick', () => {
    const events = [{ step: 0, on: false }, { step: 8, on: true }];
    expect(switchEdge(events, -1, 0)).toBe(true);
    expect(switchEdge(events, 3, 4)).toBe(false);
    expect(switchEdge(events, 7, 8)).toBe(true);
  });
});
