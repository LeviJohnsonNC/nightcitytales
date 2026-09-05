import type { CombatSound } from "./combatFeedback";

/** Original synthesized effects: no remote audio, samples, or paid runtime generation. */
export function soundSamples(sound: CombatSound, rate: number): Float32Array {
  const seconds = sound === "shotgun" || sound === "launcher" ? 0.42 : 0.28;
  const samples = new Float32Array(Math.ceil(rate * seconds));
  let seed = 731;
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 2147483648 - 1;
  };
  const gun = ["pistol", "rifle", "shotgun", "smg", "launcher"].includes(sound);
  const bass =
    sound === "launcher"
      ? 52
      : sound === "shotgun"
        ? 68
        : sound === "rifle"
          ? 95
          : sound === "smg"
            ? 180
            : 130;
  let low = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / rate,
      n = noise();
    low = low * 0.82 + n * 0.18;
    const attack = Math.min(1, t / 0.0015);
    let value: number;
    if (gun)
      value =
        n * 0.65 * Math.exp(-t * 65) +
        low * 1.6 * Math.exp(-t * 14) +
        Math.sin(2 * Math.PI * bass * t) * 0.45 * Math.exp(-t * 24);
    else if (sound === "metal")
      value =
        (Math.sin(t * 2 * Math.PI * 1740) + 0.4 * Math.sin(t * 2 * Math.PI * 2670)) *
          0.22 *
          Math.exp(-t * 24) +
        n * 0.18 * Math.exp(-t * 100);
    else if (sound === "turn")
      value = Math.sin(t * 2 * Math.PI * (t < 0.08 ? 420 : 560)) * 0.1 * Math.exp(-t * 16);
    else if (sound === "bow")
      value =
        Math.sin(t * 2 * Math.PI * 320) * 0.24 * Math.exp(-t * 32) + n * 0.08 * Math.exp(-t * 65);
    else if (sound === "reload")
      value =
        n * 0.32 * Math.exp(-t * 110) + Math.sin(t * 2 * Math.PI * 900) * 0.12 * Math.exp(-t * 70);
    else if (sound === "melee")
      value = low * 1.1 * Math.sin(Math.min(1, t / 0.18) * Math.PI) * Math.exp(-t * 18);
    else if (sound === "miss")
      value = (n - low) * 0.15 * Math.sin(Math.min(1, t / 0.12) * Math.PI) * Math.exp(-t * 28);
    else
      value =
        (low * (sound === "concrete" ? 1.4 : 0.9) +
          Math.sin(t * 2 * Math.PI * (sound === "wood" ? 210 : 85)) * 0.25) *
        Math.exp(-t * (sound === "step" ? 48 : 28));
    samples[i] = Math.tanh(value * attack) * (sound === "step" ? 0.3 : 0.65);
  }
  return samples;
}

export function createCombatAudio() {
  let context: AudioContext | null = null;
  const buffers = new Map<CombatSound, AudioBuffer>();
  const sources = new Set<AudioBufferSourceNode>();
  let disposed = false;
  return {
    unlock() {
      if (disposed) return;
      try {
        context ??= new AudioContext();
        void context.resume().catch(() => {});
      } catch {
        /* Audio is optional. */
      }
    },
    play(sound: CombatSound, volume: number) {
      if (disposed || !context || context.state !== "running" || volume <= 0) return;
      let buffer = buffers.get(sound);
      if (!buffer) {
        const samples = soundSamples(sound, context.sampleRate);
        buffer = context.createBuffer(1, samples.length, context.sampleRate);
        buffer.getChannelData(0).set(samples);
        buffers.set(sound, buffer);
      }
      const source = context.createBufferSource(),
        gain = context.createGain();
      source.buffer = buffer;
      gain.gain.value = Math.max(0, Math.min(1, volume));
      source.connect(gain);
      gain.connect(context.destination);
      sources.add(source);
      source.onended = () => {
        sources.delete(source);
        source.disconnect();
        gain.disconnect();
      };
      source.start();
    },
    stop() {
      for (const source of sources) {
        try {
          source.stop();
        } catch {
          /* Already ended. */
        }
      }
      sources.clear();
    },
    dispose() {
      disposed = true;
      this.stop();
      if (context) void context.close().catch(() => {});
      buffers.clear();
    },
  };
}
