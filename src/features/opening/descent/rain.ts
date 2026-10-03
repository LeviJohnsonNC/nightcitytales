/**
 * Drawing the rain: streaks in four depths falling outside, lit by the city
 * behind them, and water on the glass that catches it.
 *
 * The streaks are sprites, one per depth and colour, made once: tapered at both
 * ends like a drop smeared by a shutter, and soft for the near rain, which is
 * too close to the lens to be sharp. Every streak in a frame leans the same way,
 * so the context is turned once a frame and each streak is a single drawImage.
 * A streak takes its brightness and colour from the picture behind it — rain is
 * seen where something lights it, and barely at all against a black sky.
 *
 * The beads are the point of the glass. A drop on a window is a lens: it shows
 * what is behind it small, bright and upside down. So each bead draws a flipped,
 * shrunk piece of the picture under it inside a dark-rimmed circle with a
 * highlight on top and a caustic underneath. New drops strike the glass as it
 * rains, running drops take in the beads in their path, and they break up into
 * specks behind them that dry.
 *
 * It keeps its own clock (real time), because the descent's own can stall at
 * the window and the rain must not.
 */
import { seededRng } from "@/engine";
import {
  DRY_SECONDS,
  LAND_SECONDS,
  LAYERS,
  TINT_RGB,
  TRAIL_SECONDS,
  cellLight,
  dropCount,
  glassWetness,
  gust,
  impactRate,
  landDrop,
  landingDrop,
  leanDegrees,
  lightGridFrom,
  lightningAt,
  makeDrop,
  makeStreaks,
  mergeDrops,
  mistCount,
  rainIntensity,
  sheetAt,
  stepDrop,
  stepResidue,
  stepStreak,
  streakCount,
  streakLength,
  type Drop,
  type Layer,
  type LightGrid,
  type Residue,
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
  /** How much of the rain is left, 0 to 1: the scene going takes it with it. */
  fade?: number;
};

export type Rain = {
  resize(): void;
  /** `ms` is the time into the descent; `now` is the real clock. `still` draws the glass and no falling. */
  draw(ms: number, now: number, opts?: RainDrawOptions): void;
  dispose(): void;
};

/** How much of the sky a bead takes in, as a multiple of its own size. */
const LENS = 6;
/** The grid the city's light is read at, and how often it is read again. */
const GRID_COLS = 48;
const GRID_ROWS = 30;
const GRID_EVERY_MS = 200;
/** Below this a streak is not worth a draw. */
const INVISIBLE = 0.01;
/** Unlit by a picture, a streak keeps the brightness the old head-and-tail stroke had. */
const OWN_GAIN = 1.4;

type Sprite = { canvas: HTMLCanvasElement; w: number; h: number };

export function createRain(
  canvas: HTMLCanvasElement,
  opts: {
    /** The picture the beads refract and the streaks are lit by. Without one they are still water, just empty. */
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
  let streaks: Streak[][] = [];
  let drops: Drop[] = [];
  let residue: Residue[] = [];
  let cap = 0;
  /** Fractional drops owed to the glass, carried between frames. */
  let owed = 0;
  /** The mist, drawn once to its own canvas: a thousand specks are not a thousand draws a frame. */
  let mist: HTMLCanvasElement | null = null;
  let last = 0;

  const sprites = new Map<string, Sprite>();
  // Reading the city's light: a weak device keeps the streaks' own colours.
  const lights = opts.source && !opts.weak ? document.createElement("canvas") : null;
  const lightsMid = lights ? document.createElement("canvas") : null;
  let grid: LightGrid | null = null;
  let gridAt = -Infinity;
  /** Per layer, per cell: the sprite and the brightness a streak there gets. */
  let cellSprites: Sprite[][] = [];
  let cellBright: Float32Array[] = [];
  let spriteSpeed = -1;

  function build() {
    streaks = LAYERS.map((layer) =>
      makeStreaks(streakCount(layer, width, height, opts.weak), width, height, rand),
    );
    cap = dropCount(width, height, opts.weak);
    drops = Array.from({ length: Math.round(cap * 0.7) }, () => makeDrop(width, height, rand));
    residue = [];
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
    sprites.clear();
    spriteSpeed = -1;
    if (changed || streaks.length === 0) build();
  }

  /**
   * One streak, drawn white-hot down its middle and tapering to nothing at both
   * ends. A defocused one is the same streak spread wide and faint.
   */
  function sprite(li: number, layer: Layer, len: number, rgb: readonly number[]): Sprite {
    const key = `${li}|${Math.round(len)}|${rgb.join(",")}`;
    const hit = sprites.get(key);
    if (hit) return hit;
    const pad = layer.blur * 2 + 1;
    const w = layer.width + pad * 2;
    const h = len + pad * 2;
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w * dpr));
    c.height = Math.max(1, Math.ceil(h * dpr));
    const g = c.getContext("2d")!;
    g.scale(dpr, dpr);
    const [r, gr, b] = rgb;
    const along = g.createLinearGradient(0, pad, 0, pad + len);
    along.addColorStop(0, `rgba(${r},${gr},${b},0)`);
    along.addColorStop(0.55, `rgba(${r},${gr},${b},0.75)`);
    along.addColorStop(0.85, `rgba(${r},${gr},${b},1)`);
    along.addColorStop(1, `rgba(${r},${gr},${b},0)`);
    g.strokeStyle = along;
    g.lineCap = "round";
    const cx = w / 2;
    // The defocus: wider, fainter passes around the core.
    const passes = layer.blur > 0 ? 4 : 1;
    for (let p = passes; p >= 1; p--) {
      const spread = passes === 1 ? 0 : (layer.blur * 2 * (p - 1)) / (passes - 1);
      g.globalAlpha = passes === 1 ? 1 : 0.9 / (p * 1.6);
      g.lineWidth = layer.width + spread;
      g.beginPath();
      g.moveTo(cx, pad + spread * 0.5);
      g.lineTo(cx, pad + len - spread * 0.5);
      g.stroke();
    }
    const made = { canvas: c, w, h };
    sprites.set(key, made);
    return made;
  }

  /** Read the picture behind the rain again, at a few cells a side. */
  function readLights(now: number, speed: number) {
    if (!lights || !lightsMid || !opts.source || opts.source.width === 0) return;
    if (now - gridAt < GRID_EVERY_MS && speed === spriteSpeed) return;
    gridAt = now;
    // Down in two steps, so each cell is an average and not one stray pixel.
    lightsMid.width = GRID_COLS * 4;
    lightsMid.height = GRID_ROWS * 4;
    lights.width = GRID_COLS;
    lights.height = GRID_ROWS;
    const mid = lightsMid.getContext("2d")!;
    mid.imageSmoothingQuality = "high";
    mid.drawImage(opts.source, 0, 0, lightsMid.width, lightsMid.height);
    const small = lights.getContext("2d", { willReadFrequently: true })!;
    small.imageSmoothingQuality = "high";
    small.drawImage(lightsMid, 0, 0, GRID_COLS, GRID_ROWS);
    try {
      grid = lightGridFrom(
        small.getImageData(0, 0, GRID_COLS, GRID_ROWS).data,
        GRID_COLS,
        GRID_ROWS,
      );
    } catch {
      // A picture that cannot be read leaves the streaks their own colours until the next read.
      grid = null;
      spriteSpeed = speed;
      return;
    }
    spriteSpeed = speed;
    cellSprites = [];
    cellBright = [];
    const n = GRID_COLS * GRID_ROWS;
    LAYERS.forEach((layer, li) => {
      const len = streakLength(layer, speed);
      const list: Sprite[] = new Array(n);
      const bright = new Float32Array(n);
      for (let cell = 0; cell < n; cell++) {
        const lit = cellLight(grid!, cell);
        list[cell] = sprite(li, layer, len, lit.rgb);
        bright[cell] = lit.bright;
      }
      cellSprites.push(list);
      cellBright.push(bright);
    });
  }

  function fall(ms: number, dt: number, intensity: number, lit: number, speed: number) {
    if (intensity <= 0.001) return;
    const lean = leanDegrees(ms);
    const push = gust(ms) - 0.5;
    const rad = (lean * Math.PI) / 180;
    const sin = Math.sin(rad);
    const cos = Math.cos(rad);
    const flash = 1 + lit * 1.8;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    // Turned once for the whole frame: a sprite drawn straight down now leans with the rain.
    ctx.setTransform(dpr * cos, dpr * sin, -dpr * sin, dpr * cos, 0, 0);
    LAYERS.forEach((layer, li) => {
      const group = streaks[li]!;
      const len = streakLength(layer, speed);
      const shown = Math.ceil(group.length * intensity);
      const base = layer.alpha * (0.5 + 0.5 * intensity) * flash;
      const own = grid
        ? null
        : ([0, 1, 2] as Tint[]).map((t) => sprite(li, layer, len, TINT_RGB[t]));
      for (let i = 0; i < group.length; i++) {
        stepStreak(group[i]!, layer, dt, lean, width, height, rand, push);
      }
      for (let i = 0; i < shown; i++) {
        const s = group[i]!;
        // Where the streak is in the turned frame.
        const u = cos * s.x + sin * s.y;
        const v = -sin * s.x + cos * s.y;
        let alpha = base * sheetAt(u, ms);
        let spr: Sprite;
        if (grid) {
          const gx = Math.min(GRID_COLS - 1, Math.max(0, Math.floor((s.x / width) * GRID_COLS)));
          const gy = Math.min(GRID_ROWS - 1, Math.max(0, Math.floor((s.y / height) * GRID_ROWS)));
          const cell = gy * GRID_COLS + gx;
          alpha *= cellBright[li]![cell]!;
          spr = cellSprites[li]![cell]!;
        } else {
          alpha *= OWN_GAIN;
          spr = own![s.tint]!;
        }
        if (alpha < INVISIBLE) continue;
        ctx.globalAlpha = Math.min(1, alpha);
        const pad = (spr.h - len) / 2;
        ctx.drawImage(spr.canvas, u - spr.w / 2, v - len - pad, spr.w, spr.h);
      }
    });
    ctx.restore();
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
        ctx.strokeStyle = `rgba(205,228,255,${(0.08 * fresh * wet).toFixed(3)})`;
        ctx.lineWidth = Math.max(0.8, mid.r * 0.7);
        ctx.beginPath();
        ctx.moveTo(d.trail[from]!.x, d.trail[from]!.y);
        for (let i = from + 1; i < to; i++) ctx.lineTo(d.trail[i]!.x, d.trail[i]!.y);
        ctx.stroke();
      }
    }
  }

  function speck(x: number, y: number, r: number, wet: number) {
    ctx.fillStyle = `rgba(210,230,255,${(0.12 * wet).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${(0.65 * wet).toFixed(3)})`;
    ctx.fillRect(x - r * 0.45, y - r * 0.55, Math.max(0.7, r * 0.5), Math.max(0.7, r * 0.5));
  }

  function bead(x: number, y: number, r: number, wet: number, scale: number) {
    if (r < 2.2) {
      // Too small to be a lens: a speck of water.
      speck(x, y, r, wet);
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
    if (r >= 5) {
      // A fat drop splits the light at its rim: a hair of magenta one side, cyan the other.
      ctx.globalCompositeOperation = "lighter";
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = `rgba(255,90,200,${(0.2 * wet).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x - 0.7, y, r - 0.6, Math.PI * 0.55, Math.PI * 1.35);
      ctx.stroke();
      ctx.strokeStyle = `rgba(90,230,255,${(0.2 * wet).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x + 0.7, y, r - 0.6, Math.PI * 1.55, Math.PI * 2.35);
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
    }
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

  /** A bead as it is drawn this frame: swelling into place, or drying away. */
  function shown(d: Drop): { r: number; alpha: number } {
    const landing = d.age < LAND_SECONDS ? 0.4 + 0.6 * (d.age / LAND_SECONDS) : 1;
    const drying = d.dying === null ? 1 : Math.max(0, d.dying / DRY_SECONDS);
    return { r: d.r * landing * (0.6 + 0.4 * drying), alpha: drying };
  }

  function glass(dt: number, wet: number, intensity: number) {
    const leave = (s: Residue) => residue.push(s);
    for (let i = drops.length - 1; i >= 0; i--) {
      if (!stepDrop(drops[i]!, dt, rand, height, leave)) continue;
      drops[i] = drops[drops.length - 1]!;
      drops.pop();
    }
    mergeDrops(drops);
    stepResidue(residue, dt);
    // The rain striking the window: a wetter, harder storm lands more.
    owed += impactRate(width, height, intensity * wet, opts.weak) * dt;
    while (owed >= 1) {
      owed -= 1;
      landDrop(drops, landingDrop(width, height, rand), cap, rand);
    }
    if (wet <= 0.02) return;
    if (mist) {
      ctx.globalAlpha = wet;
      ctx.drawImage(mist, 0, 0, width, height);
      ctx.globalAlpha = 1;
    }
    trails(wet);
    for (const s of residue) speck(s.x, s.y, s.r, wet * (1 - s.age / s.life));
    const scale = opts.source ? opts.source.width / Math.max(1, width) : 1;
    // Small ones first, so a fat drop is never hidden under a speck.
    for (const d of drops) {
      if (d.r >= 2.2) continue;
      const v = shown(d);
      bead(d.x, d.y, v.r, wet * v.alpha, scale);
    }
    for (const d of drops) {
      if (d.r < 2.2) continue;
      const v = shown(d);
      bead(d.x, d.y, v.r, wet * v.alpha, scale);
    }
  }

  return {
    resize,
    draw(ms, now, drawOpts) {
      if (width === 0) resize();
      const still = drawOpts?.still ?? false;
      const dt = still || last === 0 ? 0 : Math.min(0.05, (now - last) / 1000);
      last = now;
      const fade = Math.max(0, Math.min(1, drawOpts?.fade ?? 1));
      const speed = drawOpts?.speed ?? 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (fade <= 0) return;
      const lit = still ? 0 : (drawOpts?.lightning ?? lightningAt(ms));
      const intensity = drawOpts?.intensity ?? rainIntensity(ms);
      if (!still) readLights(now, speed);
      fall(ms, dt * speed, still ? 0 : intensity * fade, lit * fade, speed);
      if (lit > 0.01) {
        // The flash: the whole sky, for the length of a breath.
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = `rgba(170,150,255,${(lit * fade * 0.3).toFixed(3)})`;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = "source-over";
      }
      glass(dt, (drawOpts?.wetness ?? glassWetness(ms)) * fade, still ? 0 : intensity);
    },
    dispose() {
      streaks = [];
      drops = [];
      residue = [];
      sprites.clear();
      cellSprites = [];
    },
  };
}
