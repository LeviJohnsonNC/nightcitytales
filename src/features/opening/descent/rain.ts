/**
 * Drawing the rain: streaks in three depths falling outside, and water on the
 * glass that catches the city.
 *
 * The beads are the point. A drop on a window is a lens: it shows what is
 * behind it small, bright and upside down. So each bead here draws a flipped,
 * shrunk piece of the canvas under it (the descent's own bokeh, or the
 * landing's) inside a dark-rimmed circle with a highlight on top and a caustic
 * underneath — which is why it reads as water and not as dots. Running drops
 * leave a wet line that fades. The streaks are drawn in batches, two strokes a
 * batch, so a thousand of them cost a handful of draw calls.
 *
 * It keeps its own clock (real time), because the descent's own can stall at
 * the window and the rain must not.
 */
import { seededRng } from "@/engine";
import {
  LAYERS,
  TINT_RGB,
  TRAIL_SECONDS,
  dropCount,
  mistCount,
  glassWetness,
  gust,
  leanDegrees,
  lightningAt,
  makeDrop,
  makeStreaks,
  rainIntensity,
  stepDrop,
  stepStreak,
  streakCount,
  type Drop,
  type Streak,
  type Tint,
} from "./rainModel";

/**
 * `still` draws the glass and no falling. The rest are for a screen that is not
 * the descent and keeps its own weather: how hard it falls, how lit the sky is
 * and how wet the glass is, each in place of what the descent's clock would say.
 */
export type RainDrawOptions = {
  still?: boolean;
  intensity?: number;
  lightning?: number;
  wetness?: number;
  /** A multiple of how fast it falls: 1 is the descent's pace. */
  speed?: number;
};

export type Rain = {
  resize(): void;
  /** `ms` is the time into the descent; `now` is the real clock. `still` draws the glass and no falling. */
  draw(ms: number, now: number, opts?: RainDrawOptions): void;
  dispose(): void;
};

/** How much of the sky a bead takes in, as a multiple of its own size. */
const LENS = 6;

type Grouped = Streak[][]; // by tint

export function createRain(
  canvas: HTMLCanvasElement,
  opts: {
    /** The picture the beads refract. Without one they are still water, just empty. */
    source?: HTMLCanvasElement | null;
    weak: boolean;
    seed: number;
    dprCap?: number;
  },
): Rain {
  const ctx = canvas.getContext("2d")!;
  const rand = seededRng(opts.seed);
  let width = 0;
  let height = 0;
  let dpr = 1;
  let layers: Grouped[] = [];
  let drops: Drop[] = [];
  /** The mist, drawn once to its own canvas: a thousand specks are not a thousand draws a frame. */
  let mist: HTMLCanvasElement | null = null;
  let last = 0;

  function build() {
    layers = LAYERS.map((layer) => {
      const all = makeStreaks(streakCount(layer, width, height, opts.weak), width, height, rand);
      const groups: Grouped = [[], [], []];
      for (const s of all) groups[s.tint]!.push(s);
      return groups;
    });
    drops = Array.from({ length: dropCount(width, height, opts.weak) }, () =>
      makeDrop(width, height, rand),
    );
    mist = document.createElement("canvas");
    mist.width = Math.max(1, Math.round(width * dpr));
    mist.height = Math.max(1, Math.round(height * dpr));
    const m = mist.getContext("2d")!;
    m.scale(dpr, dpr);
    for (let i = 0, n = mistCount(width, height, opts.weak); i < n; i++) {
      const x = rand() * width;
      const y = rand() * height;
      const r = 0.45 + rand() * rand() * 1.5;
      m.fillStyle = `rgba(${200 + Math.round(rand() * 55)},${225 + Math.round(rand() * 30)},255,${(0.1 + rand() * 0.22).toFixed(3)})`;
      m.beginPath();
      m.arc(x, y, r, 0, Math.PI * 2);
      m.fill();
      if (r > 1.1) {
        m.fillStyle = "rgba(255,255,255,0.5)";
        m.fillRect(x - r * 0.4, y - r * 0.5, 0.7, 0.7);
      }
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, opts.dprCap ?? 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    const changed = Math.abs(w - width) > width * 0.12 || Math.abs(h - height) > height * 0.12;
    width = w;
    height = h;
    if (changed || layers.length === 0) build();
  }

  function rgba(tint: Tint, alpha: number): string {
    const [r, g, b] = TINT_RGB[tint];
    return `rgba(${r},${g},${b},${Math.min(1, Math.max(0, alpha)).toFixed(3)})`;
  }

  function streaks(ms: number, dt: number, intensity: number, lit: number) {
    if (intensity <= 0.001) return;
    const lean = leanDegrees(ms);
    const push = gust(ms) - 0.5;
    const rad = (lean * Math.PI) / 180;
    const sin = Math.sin(rad);
    const cos = Math.cos(rad);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    LAYERS.forEach((layer, li) => {
      const len = layer.length + layer.speed * 0.012;
      const alpha = layer.alpha * (0.5 + 0.5 * intensity) * (1 + lit * 1.8);
      ctx.lineWidth = layer.width;
      for (let tint = 0 as Tint; tint < 3; tint = (tint + 1) as Tint) {
        const group = layers[li]![tint]!;
        const shown = Math.ceil(group.length * intensity);
        for (let i = 0; i < group.length; i++) {
          stepStreak(group[i]!, layer, dt, lean, width, height, rand, push);
        }
        // The tail, long and faint...
        ctx.strokeStyle = rgba(tint, alpha * 0.5);
        ctx.beginPath();
        for (let i = 0; i < shown; i++) {
          const s = group[i]!;
          ctx.moveTo(s.x + sin * len, s.y - cos * len);
          ctx.lineTo(s.x, s.y);
        }
        ctx.stroke();
        // ...and the bright head, so each one reads as falling rather than hanging.
        ctx.strokeStyle = rgba(tint, alpha);
        ctx.beginPath();
        for (let i = 0; i < shown; i++) {
          const s = group[i]!;
          ctx.moveTo(s.x + sin * len * 0.42, s.y - cos * len * 0.42);
          ctx.lineTo(s.x, s.y);
        }
        ctx.stroke();
      }
    });
    ctx.globalCompositeOperation = "source-over";
  }

  function trails(wet: number) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const d of drops) {
      const n = d.trail.length;
      if (n < 2) continue;
      // Three runs of the line by age, each at its own faintness: cheaper than a stroke a segment.
      for (let chunk = 0; chunk < 3; chunk++) {
        const from = Math.floor((n * chunk) / 3);
        const to = Math.min(n, Math.floor((n * (chunk + 1)) / 3) + 1);
        if (to - from < 2) continue;
        const mid = d.trail[Math.floor((from + to) / 2)]!;
        const fresh = 1 - mid.age / TRAIL_SECONDS;
        if (fresh <= 0) continue;
        ctx.strokeStyle = `rgba(205,228,255,${(0.28 * fresh * wet).toFixed(3)})`;
        ctx.lineWidth = Math.max(0.8, mid.r * 0.75);
        ctx.beginPath();
        ctx.moveTo(d.trail[from]!.x, d.trail[from]!.y);
        for (let i = from + 1; i < to; i++) ctx.lineTo(d.trail[i]!.x, d.trail[i]!.y);
        ctx.stroke();
      }
    }
  }

  function bead(d: Drop, wet: number, scale: number) {
    const { x, y, r } = d;
    if (r < 2.2) {
      // Too small to be a lens: a speck of water.
      ctx.fillStyle = `rgba(210,230,255,${(0.12 * wet).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${(0.65 * wet).toFixed(3)})`;
      ctx.fillRect(x - r * 0.45, y - r * 0.55, Math.max(0.7, r * 0.5), Math.max(0.7, r * 0.5));
      return;
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = wet;
    ctx.fillStyle = "rgba(8,14,34,0.62)";
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    if (opts.source) {
      // The lens: the sky behind it, upside down and small.
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(-1, -1);
      const span = r * LENS * scale;
      const sx = x * scale - span;
      const sy = y * scale - span;
      ctx.drawImage(opts.source, sx, sy, span * 2, span * 2, -r, -r, r * 2, r * 2);
      // Water gathers light: the same picture again, added, so a bead glows.
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = wet * 0.45;
      ctx.drawImage(opts.source, sx, sy, span * 2, span * 2, -r, -r, r * 2, r * 2);
      ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    // The dark edge where the water meets the glass.
    ctx.strokeStyle = `rgba(0,0,0,${(0.55 * wet).toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    // Light gathered at the bottom, and the window's own glint at the top.
    ctx.strokeStyle = `rgba(190,225,255,${(0.34 * wet).toFixed(3)})`;
    ctx.lineWidth = Math.max(0.7, r * 0.16);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.78, Math.PI * 0.18, Math.PI * 0.82);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${(0.6 * wet).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.72, Math.PI * 1.08, Math.PI * 1.45);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${(0.92 * wet).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x - r * 0.38, y - r * 0.42, Math.max(0.6, r * 0.13), 0, Math.PI * 2);
    ctx.fill();
  }

  function glass(dt: number, wet: number) {
    for (let i = 0; i < drops.length; i++) {
      if (stepDrop(drops[i]!, dt, rand, height)) drops[i] = makeDrop(width, height, rand, true);
    }
    if (wet <= 0.02) return;
    if (mist) {
      ctx.globalAlpha = wet;
      ctx.drawImage(mist, 0, 0, width, height);
      ctx.globalAlpha = 1;
    }
    trails(wet);
    const scale = opts.source ? opts.source.width / Math.max(1, width) : 1;
    // Small ones first, so a fat drop is never hidden under a speck.
    for (const d of drops) if (d.r < 2.2) bead(d, wet, scale);
    for (const d of drops) if (d.r >= 2.2) bead(d, wet, scale);
  }

  return {
    resize,
    draw(ms, now, drawOpts) {
      if (width === 0) resize();
      const still = drawOpts?.still ?? false;
      const dt = still || last === 0 ? 0 : Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const lit = still ? 0 : (drawOpts?.lightning ?? lightningAt(ms));
      streaks(
        ms,
        dt * (drawOpts?.speed ?? 1),
        still ? 0 : (drawOpts?.intensity ?? rainIntensity(ms)),
        lit,
      );
      if (lit > 0.01) {
        // The flash: the whole sky, for the length of a breath.
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = `rgba(170,150,255,${(lit * 0.3).toFixed(3)})`;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = "source-over";
      }
      glass(dt, drawOpts?.wetness ?? glassWetness(ms));
    },
    dispose() {
      layers = [];
      drops = [];
    },
  };
}
