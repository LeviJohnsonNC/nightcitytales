/**
 * The descent's sound, synthesised: rain, a drone, a heart, the counter's
 * ticks, a lock, a fall, thunder, a window. No recordings and no files.
 *
 * What and when is `descentSoundPlan.ts`; this is only how it is made. It plays
 * only for a player who has the music on (the same preference NCAmp keeps), only
 * after a touch has let the page make sound — "Enter Night City" is one — and
 * never throws: a browser that will not make a context gets a silent descent.
 *
 * The audio outlives the screen on purpose. `landed()` leaves a little rain
 * under the prose for a while, and a later screen can still reach it.
 */
import { duckMusic, isMusicEnabled, releaseDuck } from "@/features/music/musicDirector";
import {
  HEARTBEATS,
  cuesBetween,
  dronePitch,
  droneLevel,
  glassAmount,
  rainLevel,
  type OneShot,
} from "./descentSoundPlan";
import { ease } from "./descentTimeline";

export type DescentAudio = {
  /** Advance to `ms` into the descent, having last been at `prev`. */
  update(ms: number, prev: number): void;
  /** The cut to the prose begins: the world drops away. */
  hinge(): void;
  /** The prose has landed: one low note, and rain left under it. */
  landed(): void;
  /** A key struck: the prose being typed. */
  type(): void;
  /** A neon sign catching: a door coming on. */
  sign(): void;
  /** A door taken: the rain swells and the scene falls away. */
  door(): void;
  dispose(fadeMs?: number): void;
};

/** Everything sits under the reading and under the music; this is the top of it. */
const MASTER = 0.7;
/** How long the rain stays under the prose before the context is let go. */
const AMBIENT_MS = 40_000;

let current: DescentAudio | null = null;

/** The descent's audio if one is still alive, for a later screen to add to. */
export function liveDescentAudio(): DescentAudio | null {
  return current;
}

type AudioCtor = typeof AudioContext;

export function createDescentAudio(): DescentAudio | null {
  if (typeof window === "undefined" || !isMusicEnabled()) return null;
  const Ctor: AudioCtor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  if (!Ctor) return null;
  let ctx: AudioContext;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);

  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  master.gain.linearRampToValueAtTime(MASTER, ctx.currentTime + 1.2);

  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const samples = noiseBuffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  const noise = (loop = false) => {
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = loop;
    return source;
  };

  // Rain: noise with the low end taken off, and the high end taken off as the glass closes.
  const rain = noise(true);
  const rainHigh = ctx.createBiquadFilter();
  rainHigh.type = "highpass";
  rainHigh.frequency.value = 700;
  const rainLow = ctx.createBiquadFilter();
  rainLow.type = "lowpass";
  rainLow.frequency.value = 9000;
  const rainGain = ctx.createGain();
  rainGain.gain.value = 0;
  rain.connect(rainHigh).connect(rainLow).connect(rainGain).connect(master);
  rain.start();

  // The drone: two voices a hair apart, so it beats slowly against itself.
  const droneGain = ctx.createGain();
  droneGain.gain.value = 0;
  const droneFilter = ctx.createBiquadFilter();
  droneFilter.type = "lowpass";
  droneFilter.frequency.value = 180;
  droneFilter.connect(droneGain).connect(master);
  const voiceA = ctx.createOscillator();
  voiceA.type = "triangle";
  voiceA.frequency.value = 55;
  const voiceB = ctx.createOscillator();
  voiceB.type = "sawtooth";
  voiceB.frequency.value = 55.4;
  voiceA.connect(droneFilter);
  voiceB.connect(droneFilter);
  voiceA.start();
  voiceB.start();

  // The room: a hum you only notice when it is gone.
  const room = ctx.createOscillator();
  room.type = "sine";
  room.frequency.value = 120;
  const roomGain = ctx.createGain();
  roomGain.gain.value = 0;
  room.connect(roomGain).connect(master);
  room.start();

  /** A burst of noise through one filter: clicks, whooshes, thunder, relays. */
  const burst = (opts: {
    type: BiquadFilterType;
    from: number;
    to?: number;
    q?: number;
    peak: number;
    attack: number;
    decay: number;
    delay?: number;
  }) => {
    const at = ctx.currentTime + (opts.delay ?? 0);
    const source = noise();
    const filter = ctx.createBiquadFilter();
    filter.type = opts.type;
    filter.Q.value = opts.q ?? 1;
    filter.frequency.setValueAtTime(opts.from, at);
    if (opts.to)
      filter.frequency.exponentialRampToValueAtTime(opts.to, at + opts.attack + opts.decay);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(opts.peak, at + opts.attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + opts.attack + opts.decay);
    source.connect(filter).connect(gain).connect(master);
    source.start(at);
    source.stop(at + opts.attack + opts.decay + 0.1);
  };

  /** A pitched note that falls or holds and fades. */
  const note = (opts: {
    type: OscillatorType;
    from: number;
    to?: number;
    peak: number;
    decay: number;
    delay?: number;
  }) => {
    const at = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.from, at);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, at + opts.decay * 0.5);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(opts.peak, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + opts.decay);
    osc.connect(gain).connect(master);
    osc.start(at);
    osc.stop(at + opts.decay + 0.1);
  };

  const shimmer = (base: number, peak: number, decay: number) => {
    [1, 1.5, 2, 2.67].forEach((ratio, i) =>
      note({
        type: "triangle",
        from: base * ratio,
        peak: peak / (1 + i * 0.4),
        decay,
        delay: i * 0.05,
      }),
    );
  };

  const oneShot: Record<OneShot, () => void> = {
    city: () => {
      [1318, 1760, 2349].forEach((hz, i) =>
        note({ type: "sine", from: hz, peak: 0.025, decay: 1.4, delay: i * 0.16 }),
      );
    },
    lock: () => {
      note({ type: "sine", from: 120, to: 38, peak: 0.45, decay: 1.4 });
      shimmer(1245, 0.05, 1.9);
      burst({ type: "highpass", from: 3000, peak: 0.12, attack: 0.005, decay: 0.2 });
    },
    whoosh: () => {
      burst({ type: "bandpass", from: 250, to: 5200, q: 1.4, peak: 0.2, attack: 1.0, decay: 1.3 });
    },
    thunder: () => {
      burst({ type: "lowpass", from: 170, to: 60, peak: 0.5, attack: 0.12, decay: 2.4 });
    },
    window: () => {
      note({ type: "sine", from: 82, to: 70, peak: 0.16, decay: 1.2 });
    },
  };

  let lastSet = -Infinity;
  let landedAt: number | null = null;
  let disposed = false;
  let ambientTimer: number | null = null;

  const audio: DescentAudio = {
    update(ms, prev) {
      if (disposed || landedAt !== null) return;
      const now = ctx.currentTime;
      if (ms - lastSet >= 80 || ms < lastSet) {
        lastSet = ms;
        rainGain.gain.setTargetAtTime(0.05 + 0.09 * rainLevel(ms), now, 0.25);
        rainLow.frequency.setTargetAtTime(9000 - 7400 * glassAmount(ms), now, 0.4);
        droneGain.gain.setTargetAtTime(0.17 * droneLevel(ms), now, 0.35);
        voiceA.frequency.setTargetAtTime(dronePitch(ms), now, 0.3);
        voiceB.frequency.setTargetAtTime(dronePitch(ms) * 1.008, now, 0.3);
        droneFilter.frequency.setTargetAtTime(150 + 330 * ease((ms - 3500) / 4000), now, 0.4);
        roomGain.gain.setTargetAtTime(0.014 * glassAmount(ms), now, 0.5);
      }
      const due = cuesBetween(prev, ms);
      for (const kind of due.oneShots) oneShot[kind]();
      for (const beat of due.heartbeats) {
        const along = HEARTBEATS.indexOf(beat) / Math.max(1, HEARTBEATS.length - 1);
        const peak = 0.16 + 0.26 * along;
        note({ type: "sine", from: 62, to: 44, peak, decay: 0.2 });
        note({ type: "sine", from: 70, to: 48, peak: peak * 0.7, decay: 0.18, delay: 0.17 });
      }
      for (const tick of due.ticks) {
        burst({
          type: "bandpass",
          from: 1700 + 2800 * tick.along,
          q: 6,
          peak: 0.06,
          attack: 0.002,
          decay: 0.03,
        });
      }
    },

    hinge() {
      if (disposed) return;
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(0.04, now, 0.12);
      burst({ type: "highpass", from: 4000, peak: 0.2, attack: 0.002, decay: 0.05 });
    },

    landed() {
      if (disposed || landedAt !== null) return;
      landedAt = performance.now();
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(MASTER, now, 0.05);
      note({ type: "sine", from: 98, to: 36, peak: 0.42, decay: 2.2 });
      shimmer(880, 0.04, 2.6);
      // Leave the rain, and take the rest away.
      droneGain.gain.setTargetAtTime(0, now, 0.6);
      roomGain.gain.setTargetAtTime(0, now, 0.6);
      rainGain.gain.setTargetAtTime(0.05, now, 0.8);
      rainLow.frequency.setTargetAtTime(2400, now, 0.8);
      current = audio;
      ambientTimer = window.setTimeout(() => audio.dispose(2500), AMBIENT_MS);
    },

    type() {
      if (disposed) return;
      burst({
        type: "bandpass",
        from: 2300 + Math.random() * 900,
        q: 5,
        peak: 0.022,
        attack: 0.001,
        decay: 0.022,
      });
    },

    sign() {
      if (disposed) return;
      burst({ type: "highpass", from: 5200, peak: 0.05, attack: 0.002, decay: 0.07 });
      note({ type: "sawtooth", from: 118, peak: 0.012, decay: 0.5 });
    },

    door() {
      if (disposed) return;
      const now = ctx.currentTime;
      rainGain.gain.cancelScheduledValues(now);
      rainGain.gain.setTargetAtTime(0.15, now, 0.2);
      rainLow.frequency.setTargetAtTime(7000, now, 0.3);
      burst({
        type: "bandpass",
        from: 5000,
        to: 300,
        q: 1.2,
        peak: 0.16,
        attack: 0.05,
        decay: 0.7,
      });
      note({ type: "sine", from: 90, to: 40, peak: 0.3, decay: 0.9 });
    },

    dispose(fadeMs = 600) {
      if (disposed) return;
      disposed = true;
      if (ambientTimer !== null) window.clearTimeout(ambientTimer);
      if (current === audio) current = null;
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(0, now, Math.max(0.05, fadeMs / 4000));
      window.setTimeout(() => {
        for (const node of [rain, voiceA, voiceB, room]) {
          try {
            node.stop();
          } catch {
            // already stopped
          }
        }
        void ctx.close().catch(() => undefined);
      }, fadeMs + 200);
    },
  };
  return audio;
}

/**
 * The sound of the descent is one thing across the screens that draw it: the
 * route while the campaign loads hands over to the opening itself, and a sound
 * that restarted at each handover would drop out for a second at the seam. So a
 * screen acquires it rather than makes it, and letting go waits a moment in case
 * the next screen takes it up.
 */
const HANDOVER_GRACE_MS = 900;
let shared: DescentAudio | null = null;
let sharedLanded = false;
let releaseTimer: number | null = null;

/** The descent's sound, ducking the music under it. Null for a player with the music off. */
export function acquireDescentAudio(): DescentAudio | null {
  if (typeof window === "undefined") return null;
  if (releaseTimer !== null) {
    window.clearTimeout(releaseTimer);
    releaseTimer = null;
  }
  if (!shared || sharedLanded) {
    shared = createDescentAudio();
    sharedLanded = false;
  }
  if (shared) duckMusic(60_000, 0.3);
  return shared;
}

/** The prose has landed: the sound stays for its tail; nobody is to take it down. */
export function landDescentAudio(): void {
  shared?.landed();
  sharedLanded = true;
}

/** A screen is done with the sound. It goes unless the next screen takes it up first. */
export function releaseDescentAudio(): void {
  if (sharedLanded || typeof window === "undefined") return;
  if (releaseTimer !== null) window.clearTimeout(releaseTimer);
  releaseTimer = window.setTimeout(() => {
    releaseTimer = null;
    shared?.dispose();
    shared = null;
    releaseDuck();
  }, HANDOVER_GRACE_MS);
}
