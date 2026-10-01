/**
 * What a roll sounds and feels like: synthesised dice audio, a dip in the
 * music under it, and a buzz on phones that can.
 *
 * No audio files: every sound is built from oscillators and noise, so it costs
 * nothing to download and can follow the roll — the clatter slows as the die
 * does, the settle rings higher for a higher number, a crit gets a chord and a
 * fumble a crushed glitch. On by default, quietly, and remembered off.
 *
 * Everything is inert outside a browser, when Web Audio is missing, and when
 * the player has turned dice sound off. Nothing here decides anything.
 */
import { duckMusic } from "@/features/music/musicDirector";

const STORAGE_KEY = "nct.dice.sound";
/** Under the music, not over it. */
const LEVEL = 0.32;

let enabled = readInitial();
const listeners = new Set<(on: boolean) => void>();

function readInitial(): boolean {
  try {
    if (typeof localStorage !== "undefined") return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    /* private mode or blocked storage: default on */
  }
  return true;
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

/** Subscribe to the toggle, so every control shows the same state. */
export function onDiceSoundChange(fn: (on: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ── the audio graph ──────────────────────────────────────────────────────

let audio: AudioContext | null = null;
let bus: GainNode | null = null;
let noise: AudioBuffer | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audio) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      audio = new Ctor();
      bus = audio.createGain();
      bus.gain.value = LEVEL;
      bus.connect(audio.destination);
    } catch {
      audio = null;
      return null;
    }
  }
  return audio;
}

/** A context ready to play on, or null when sound is off or unavailable. */
function live(): { c: AudioContext; out: GainNode } | null {
  if (!enabled) return null;
  const c = ctx();
  if (!c || !bus) return null;
  if (c.state !== "running") void c.resume();
  return { c, out: bus };
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise) return noise;
  const frames = Math.floor(c.sampleRate * 0.5);
  noise = c.createBuffer(1, frames, c.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
  return noise;
}

/** A short burst of filtered noise: one contact of die on table. */
function click(c: AudioContext, out: AudioNode, at: number, gain: number, freq: number): void {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = freq;
  band.Q.value = 2.2;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.045);
  src.connect(band).connect(g).connect(out);
  src.start(at, Math.random() * 0.4, 0.06);
}

/** A tone with an attack and a decay. */
function tone(
  c: AudioContext,
  out: AudioNode,
  at: number,
  freq: number,
  dur: number,
  gain: number,
  type: OscillatorType = "triangle",
  glideTo?: number,
): void {
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(out);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

// Many dice at once (a cascade) should read as a handful, not a hailstorm.
let recentTumbles: number[] = [];

// ── the sounds ───────────────────────────────────────────────────────────

/**
 * The die in the air and across the table: contacts that come further apart
 * as it slows, each a little quieter, with a thin digital tick on top.
 * `seconds` is how long the tumble lasts; `energy` 1 is a tap, more is a throw.
 */
export function playTumble(seconds: number, energy = 1): void {
  const a = live();
  if (!a) return;
  const { c, out } = a;
  const nowMs = performance.now();
  recentTumbles = recentTumbles.filter((t) => nowMs - t < 250);
  recentTumbles.push(nowMs);
  const crowd = 1 / Math.max(1, recentTumbles.length - 1);
  const now = c.currentTime;
  let t = 0.02;
  let gap = 0.035 / Math.min(2, energy);
  let level = 0.5 * crowd * Math.min(1.4, energy);
  while (t < seconds) {
    click(c, out, now + t, level, 1600 + Math.random() * 2400);
    if (Math.random() < 0.4)
      tone(c, out, now + t, 2800 + Math.random() * 900, 0.02, level * 0.12, "square");
    t += gap * (0.7 + Math.random() * 0.6);
    gap *= 1.22;
    level *= 0.9;
  }
  duckMusic(seconds * 1000 + 250);
}

/** The die comes to rest: a ring pitched to the number, higher for more. */
export function playSettle(value: number, sides: number): void {
  const a = live();
  if (!a) return;
  const { c, out } = a;
  const now = c.currentTime;
  const f = 520 * Math.pow(2, ((value - 1) / Math.max(1, sides - 1)) * 0.75);
  click(c, out, now, 0.35, 900);
  tone(c, out, now + 0.01, f, 0.32, 0.5);
  tone(c, out, now + 0.04, f * 1.5, 0.28, 0.22);
}

/** A natural 10: a rising chord and a shimmer. */
export function playCrit(): void {
  const a = live();
  if (!a) return;
  const { c, out } = a;
  const now = c.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    tone(c, out, now + i * 0.06, f, 0.7 - i * 0.08, 0.32, "sawtooth");
    tone(c, out, now + i * 0.06, f * 2, 0.4, 0.08, "sine");
  });
  for (let i = 0; i < 8; i += 1)
    tone(c, out, now + 0.25 + i * 0.03, 3000 + i * 180, 0.08, 0.05, "sine");
  duckMusic(1100);
}

/** A natural 1: a crushed, stuttering drop. */
export function playFumble(): void {
  const a = live();
  if (!a) return;
  const { c, out } = a;
  const now = c.currentTime;
  for (let i = 0; i < 6; i += 1) {
    const at = now + i * 0.055 + Math.random() * 0.02;
    tone(c, out, at, 420 - i * 55, 0.05, 0.28, "square");
  }
  tone(c, out, now + 0.3, 140, 0.45, 0.35, "sawtooth", 55);
  duckMusic(1000);
}

/** Two dice meeting in an opposed check. */
export function playClash(): void {
  const a = live();
  if (!a) return;
  const { c, out } = a;
  const now = c.currentTime;
  tone(c, out, now, 610, 0.35, 0.3, "sine");
  tone(c, out, now, 947, 0.3, 0.2, "sine");
  click(c, out, now, 0.6, 2400);
}

/** The losing die breaks apart. */
export function playShatter(): void {
  const a = live();
  if (!a) return;
  const { c, out } = a;
  const now = c.currentTime;
  for (let i = 0; i < 9; i += 1)
    click(
      c,
      out,
      now + i * 0.018 + Math.random() * 0.02,
      0.4 - i * 0.03,
      3000 + Math.random() * 4000,
    );
}

/** The verdict lands: up for a success, down for a failure, a sting for a near miss. */
export function playVerdict(success: boolean, nearMiss: boolean): void {
  const a = live();
  if (!a) return;
  const { c, out } = a;
  const now = c.currentTime;
  click(c, out, now, 0.5, 300);
  if (success) {
    tone(c, out, now, 660, 0.18, 0.3);
    tone(c, out, now + 0.08, 990, 0.3, 0.3);
  } else {
    tone(c, out, now, 196, 0.35, 0.32, "sawtooth", 150);
  }
  if (nearMiss) tone(c, out, now + 0.12, success ? 1320 : 233, 0.25, 0.18, "square");
}

/** One heartbeat: lub, dub. */
export function playHeartbeat(): void {
  const a = live();
  if (!a) return;
  const { c, out } = a;
  const now = c.currentTime;
  tone(c, out, now, 90, 0.16, 0.7, "sine", 45);
  tone(c, out, now + 0.2, 80, 0.14, 0.5, "sine", 40);
  tone(c, out, now + 0.02, 880, 0.12, 0.12, "sine");
}

/** The monitor, flat. */
export function playFlatline(): void {
  const a = live();
  if (!a) return;
  const { c, out } = a;
  tone(c, out, c.currentTime, 1000, 2.4, 0.2, "sine");
  duckMusic(2600);
}

/** Holding to charge a throw: a rattle, faster the longer it is held. */
export function playRattle(charge: number): void {
  const a = live();
  if (!a) return;
  const { c, out } = a;
  click(c, out, c.currentTime, 0.12 + charge * 0.2, 2200 + Math.random() * 1500);
}

// ── touch ────────────────────────────────────────────────────────────────

/** A buzz, on phones that have one. Short patterns only; never on desktop. */
export function buzz(pattern: number | number[]): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* some browsers throw without a gesture */
  }
}
