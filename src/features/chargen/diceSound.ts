/**
 * Optional, generated dice audio. No asset files: a short filtered-noise
 * tumble and a bright two-tone settle "ting" are synthesized with WebAudio.
 * Off by default; the preference persists in localStorage. Everything is
 * guarded so it is inert during SSR or when WebAudio is unavailable.
 */

const STORAGE_KEY = "nct.dice.sound";

let enabled = readInitial();
const listeners = new Set<(on: boolean) => void>();

function readInitial(): boolean {
  try {
    if (typeof localStorage !== "undefined") return localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    /* private mode / blocked storage */
  }
  return false;
}

export function isDiceSoundEnabled(): boolean {
  return enabled;
}

export function setDiceSoundEnabled(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn(on));
  if (on) void ctx()?.resume();
}

/** Subscribe to toggle changes so multiple controls stay in sync. */
export function onDiceSoundChange(fn: (on: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let audio: AudioContext | null = null;
function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audio) {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      audio = new Ctor();
    } catch {
      return null;
    }
  }
  return audio;
}

/** Short filtered-noise burst: the die tumbling across the table. */
export function playRollSound(): void {
  if (!enabled) return;
  const c = ctx();
  if (!c) return;
  void c.resume();
  const now = c.currentTime;
  const dur = 0.5;

  const frames = Math.floor(c.sampleRate * dur);
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    // Decaying noise with a few amplitude "clacks" to suggest bouncing.
    const t = i / frames;
    const clack = 0.6 + 0.4 * Math.sign(Math.sin(t * 46));
    data[i] = (Math.random() * 2 - 1) * (1 - t) * clack;
  }
  const src = c.createBufferSource();
  src.buffer = buffer;

  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.setValueAtTime(1500, now);
  band.frequency.exponentialRampToValueAtTime(700, now + dur);
  band.Q.value = 0.9;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  src.connect(band).connect(gain).connect(c.destination);
  src.start(now);
  src.stop(now + dur);
}

/** Bright two-tone chime when the die settles on its result. */
export function playSettleSound(): void {
  if (!enabled) return;
  const c = ctx();
  if (!c) return;
  void c.resume();
  const now = c.currentTime;

  const master = c.createGain();
  master.gain.value = 0.18;
  master.connect(c.destination);

  for (const [freq, delay] of [
    [660, 0],
    [990, 0.04],
  ] as const) {
    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now + delay);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.02, now + delay + 0.18);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now + delay);
    g.gain.exponentialRampToValueAtTime(0.9, now + delay + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.34);
    osc.connect(g).connect(master);
    osc.start(now + delay);
    osc.stop(now + delay + 0.36);
  }
}
