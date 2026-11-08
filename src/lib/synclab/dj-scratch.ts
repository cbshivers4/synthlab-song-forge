import { scratchRate } from "./dj";

/**
 * The sound of a record moved by hand. While your hand is on the record the deck's normal player is
 * paused and this voice plays instead, at the speed and in the direction your hand moves it:
 * forwards reads the track, backwards reads a reversed copy of the music around the hand
 * (a window, never a reversed copy of the whole track, so long tracks don't double memory).
 * When the hand stops, the record slows to a stop and goes quiet, like a real platter under a finger.
 * It feeds the deck's own input, so trim, EQ, filter, fader, crossfader, headphones and the mix
 * recording all hear it exactly like normal playback.
 */
const WINDOW = 12; // seconds of reversed music each side of the hand
const IDLE_MS = 45; // no movement this long = the hand is holding the record still
const DRIFT = 0.06; // seconds the sound may wander from the hand before it is re-placed

interface Voice { src: AudioBufferSourceNode; gain: GainNode; dir: 1 | -1 }

export class ScratchVoice {
  private voice: Voice | null = null;
  private rev: { buf: AudioBuffer; start: number; end: number } | null = null;
  /** where the sound is in the track (seconds), integrated from the speeds we asked for */
  private soundPos = 0;
  private rate = 0;
  private lastT = 0;
  private lastPos = 0;
  private idle: ReturnType<typeof setTimeout> | null = null;

  constructor(private ctx: AudioContext, private buffer: AudioBuffer, private out: AudioNode, pos: number) {
    this.soundPos = this.lastPos = pos;
    this.lastT = performance.now();
  }

  /** The hand moved the record to `pos` (seconds). */
  moveTo(pos: number) {
    const now = performance.now();
    const dt = Math.max(0.004, (now - this.lastT) / 1000);
    const v = (pos - this.lastPos) / dt;
    this.advance(now);
    this.lastT = now; this.lastPos = pos;
    const speed = scratchRate(v);
    if (speed === 0) return;
    const dir: 1 | -1 = v > 0 ? 1 : -1;
    if (!this.voice || this.voice.dir !== dir || Math.abs(this.soundPos - pos) > DRIFT) this.place(pos, dir);
    this.setRate(speed);
    if (this.idle) clearTimeout(this.idle);
    this.idle = setTimeout(() => { this.advance(performance.now()); this.setRate(0); }, IDLE_MS);
  }

  /** Hand off the record: the voice fades out and the deck's normal player takes over. */
  stop() {
    if (this.idle) clearTimeout(this.idle);
    this.idle = null;
    this.fadeOut(this.voice);
    this.voice = null;
    this.rev = null;
  }

  private advance(now: number) {
    if (this.voice) this.soundPos += this.voice.dir * this.rate * Math.max(0, (now - this.lastT) / 1000);
  }

  private setRate(r: number) {
    this.rate = r;
    const v = this.voice;
    if (!v) return;
    const t = this.ctx.currentTime;
    // a real platter can't stop instantly: speed and level settle over ~20 ms
    v.src.playbackRate.setTargetAtTime(Math.max(0.0001, r), t, 0.012);
    v.gain.gain.setTargetAtTime(r > 0 ? 1 : 0, t, r > 0 ? 0.004 : 0.02);
  }

  private place(pos: number, dir: 1 | -1) {
    this.fadeOut(this.voice);
    const src = this.ctx.createBufferSource();
    let offset = pos;
    if (dir === 1) src.buffer = this.buffer;
    else {
      const rev = this.reversedAround(pos);
      src.buffer = rev.buf;
      offset = rev.end - pos;
    }
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    src.playbackRate.value = Math.max(0.0001, this.rate || 1);
    src.connect(gain).connect(this.out);
    src.start(this.ctx.currentTime, Math.max(0, Math.min(src.buffer.duration - 0.001, offset)));
    this.voice = { src, gain, dir };
    this.soundPos = pos;
  }

  private reversedAround(pos: number) {
    const r = this.rev;
    if (r && pos - r.start > 0.5 && pos <= r.end) return r;
    const sr = this.buffer.sampleRate;
    const start = Math.max(0, pos - WINDOW), end = Math.min(this.buffer.duration, pos + WINDOW);
    const a = Math.floor(start * sr), b = Math.max(a + 1, Math.floor(end * sr));
    const len = b - a;
    const buf = this.ctx.createBuffer(this.buffer.numberOfChannels, len, sr);
    for (let c = 0; c < this.buffer.numberOfChannels; c++) {
      const from = this.buffer.getChannelData(c), to = buf.getChannelData(c);
      for (let i = 0; i < len; i++) to[i] = from[b - 1 - i] ?? 0;
    }
    this.rev = { buf, start: a / sr, end: b / sr };
    return this.rev;
  }

  private fadeOut(v: Voice | null) {
    if (!v) return;
    const t = this.ctx.currentTime;
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setTargetAtTime(0, t, 0.004);
    try { v.src.stop(t + 0.03); } catch { /* already stopped */ }
    setTimeout(() => { try { v.src.disconnect(); v.gain.disconnect(); } catch { /* gone */ } }, 80);
  }
}
