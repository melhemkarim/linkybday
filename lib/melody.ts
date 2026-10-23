let ctx: AudioContext | null = null;
let stopCurrent: (() => void) | null = null;

export function getAudioContext(): AudioContext {
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  return ctx;
}

// Call from a click/tap so browsers allow audio later (e.g. after the blackout).
export function unlockAudio() {
  const c = getAudioContext();
  if (c.state === "suspended") void c.resume();
}

// ---------------------------------------------------------------------------
// Happy Birthday
// ---------------------------------------------------------------------------

const C3 = 130.81, G2 = 98, F2 = 87.31;
const B3 = 246.94, C4 = 261.63, D4 = 293.66, E4 = 329.63, F4 = 349.23, A3 = 220;
const G4 = 392, A4 = 440, B4 = 493.88, C5 = 523.25, D5 = 587.33, E5 = 659.25, F5 = 698.46, G5 = 783.99;

// [frequency, beats]
const SONG: [number, number][] = [
  [G4, 0.75], [G4, 0.25], [A4, 1], [G4, 1], [C5, 1], [B4, 2],
  [G4, 0.75], [G4, 0.25], [A4, 1], [G4, 1], [D5, 1], [C5, 2],
  [G4, 0.75], [G4, 0.25], [G5, 1], [E5, 1], [C5, 1], [B4, 1], [A4, 1],
  [F5, 0.75], [F5, 0.25], [E5, 1], [C5, 1], [D5, 1], [C5, 2],
];

// Waltz accompaniment: [chord, beats]. Bass on the first beat, soft chord on the rest.
type Chord = { bass: number; up: number[] };
const CHORDS: Record<string, Chord> = {
  C: { bass: C3, up: [C4, E4] },
  G7: { bass: G2, up: [B3, D4, F4] },
  F: { bass: F2, up: [A3, C4] },
};
const ACCOMP: [keyof typeof CHORDS, number][] = [
  ["C", 3], ["C", 1], ["G7", 2],
  ["G7", 3], ["G7", 1], ["C", 2],
  ["C", 3], ["C", 1], ["G7", 2],
  ["F", 3], ["G7", 1], ["C", 2],
];

/** Choose which arrangement plays. Set in lib/config.ts (CONFIG.song). */
export type SongStyle = "musicbox" | "classic";

export function playBirthday(style: SongStyle = "musicbox"): () => void {
  stopCurrent?.();
  const c = getAudioContext();
  void c.resume();

  const master = c.createGain();
  master.gain.value = style === "musicbox" ? 0.32 : 0.25;
  master.connect(c.destination);

  const nodes: AudioScheduledSourceNode[] = [];
  const extra: AudioNode[] = [master];

  // ---- classic: the original plain sine melody ----
  if (style === "classic") {
    const beat = 0.62;
    let t = c.currentTime + 0.1;
    for (const [freq, beats] of SONG) {
      const o = c.createOscillator();
      const g = c.createGain();
      const d = beats * beat;
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(1, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + d * 0.8);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + d);
      nodes.push(o);
      t += d;
    }
  } else {
    // ---- music box waltz: bell-like melody + soft 3/4 accompaniment + echo ----
    const beat = 0.56;
    const start = c.currentTime + 0.15;

    // gentle echo for shimmer
    const dry = c.createGain();
    const delay = c.createDelay(1);
    const fb = c.createGain();
    const damp = c.createBiquadFilter();
    const wet = c.createGain();
    delay.delayTime.value = 0.27;
    fb.gain.value = 0.32;
    damp.type = "lowpass";
    damp.frequency.value = 3200;
    wet.gain.value = 0.35;
    dry.connect(master);
    dry.connect(delay);
    delay.connect(damp);
    damp.connect(fb);
    fb.connect(delay);
    damp.connect(wet);
    wet.connect(master);
    extra.push(dry, delay, fb, damp, wet);

    const bell = (freq: number, at: number, vol: number, ring: number) => {
      // fundamental + a bright, quickly fading upper partial = music-box "tink"
      const parts: [number, number, number][] = [
        [1, 1, ring],
        [3.01, 0.28, ring * 0.35],
        [5.4, 0.08, ring * 0.15],
      ];
      for (const [mult, amp, len] of parts) {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = "sine";
        o.frequency.value = freq * mult;
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(vol * amp, at + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0008, at + len);
        o.connect(g);
        g.connect(dry);
        o.start(at);
        o.stop(at + len + 0.05);
        nodes.push(o);
      }
    };

    let t = start;
    for (const [freq, beats] of SONG) {
      bell(freq, t, 0.55, Math.max(1.1, beats * beat * 1.3));
      t += beats * beat;
    }

    let ab = 0;
    for (const [name, beats] of ACCOMP) {
      const ch = CHORDS[name];
      for (let k = 0; k < beats; k++) {
        const at = start + (ab + k) * beat;
        if (k === 0) bell(ch.bass, at, 0.38, 1.0);
        else ch.up.forEach((f) => bell(f, at, 0.14, 0.55));
      }
      ab += beats;
    }
  }

  const stop = () => {
    nodes.forEach((o) => {
      try { o.stop(); } catch { /* already stopped */ }
    });
    extra.forEach((n) => {
      try { n.disconnect(); } catch { /* already disconnected */ }
    });
    if (stopCurrent === stop) stopCurrent = null;
  };
  stopCurrent = stop;
  return stop;
}

// ---------------------------------------------------------------------------
// Blowing out the candles
// ---------------------------------------------------------------------------

let noiseBuf: AudioBuffer | null = null;
function noise(c: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 1.5, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

/** A breathy whoosh, plus a tiny "pfft" for each candle going out. */
export function playBlow(candles = 5) {
  const c = getAudioContext();
  void c.resume();
  const now = c.currentTime;

  const out = c.createGain();
  out.gain.value = 0.9;
  out.connect(c.destination);

  const burst = (at: number, dur: number, f0: number, f1: number, q: number, peak: number) => {
    const src = c.createBufferSource();
    src.buffer = noise(c);
    src.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = q;
    bp.frequency.setValueAtTime(f0, at);
    bp.frequency.exponentialRampToValueAtTime(f1, at + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + dur * 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(out);
    src.start(at, Math.random());
    src.stop(at + dur + 0.05);
  };

  // main breath
  burst(now, 0.75, 1600, 450, 0.7, 0.9);
  // soft low body
  burst(now, 0.6, 500, 250, 0.5, 0.5);
  // little puffs as each flame snuffs out (matches the 0.1s stagger in CakeRoom)
  for (let i = 0; i < Math.min(Math.max(candles, 1), 12); i++) {
    burst(now + 0.03 + i * 0.1, 0.09, 3800 - i * 120, 1800, 2.5, 0.22);
  }

  setTimeout(() => out.disconnect(), 1500);
}
