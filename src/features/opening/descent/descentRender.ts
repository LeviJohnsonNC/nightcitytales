/**
 * Drawing the descent: a field of lights over the neon map, a camera that
 * narrows and then falls, and the bokeh it falls through.
 *
 * One canvas, one `draw(ms)` that is a pure function of the time into the
 * descent and the lights, so a remount, a skip or a reduced-motion still all
 * draw the same picture for the same moment. No React in here.
 */
import { MAP_PICTURE } from "@/features/atlas/mapWarp";
import { CITY_END_MS, DIVE_END_MS, SEARCH_END_MS, ease, zoomAt } from "./descentTimeline";
import { SEARCH_STEPS, survives, type City, type Hue, type Light } from "./cityLights";

/** The sign colours: cyan, violet, hot pink, amber. */
const HUES: Record<Hue, [number, number, number]> = {
  0: [64, 224, 255],
  1: [170, 110, 255],
  2: [255, 60, 150],
  3: [255, 176, 70],
};

const SPRITE = 64;

function sprite(rgb: [number, number, number]): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SPRITE;
  const g = canvas.getContext("2d")!;
  const gradient = g.createRadialGradient(
    SPRITE / 2,
    SPRITE / 2,
    0,
    SPRITE / 2,
    SPRITE / 2,
    SPRITE / 2,
  );
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.18, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.95)`);
  gradient.addColorStop(0.55, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.28)`);
  gradient.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
  g.fillStyle = gradient;
  g.fillRect(0, 0, SPRITE, SPRITE);
  return canvas;
}

/** An out-of-focus light: a flat coloured disc with a brighter rim, never a white core. */
function bokehSprite(rgb: [number, number, number]): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SPRITE;
  const g = canvas.getContext("2d")!;
  const gradient = g.createRadialGradient(
    SPRITE / 2,
    SPRITE / 2,
    0,
    SPRITE / 2,
    SPRITE / 2,
    SPRITE / 2,
  );
  gradient.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.34)`);
  gradient.addColorStop(0.7, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.46)`);
  gradient.addColorStop(0.9, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.78)`);
  gradient.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
  g.fillStyle = gradient;
  g.fillRect(0, 0, SPRITE, SPRITE);
  return canvas;
}

function smoothstep(x: number, from: number, to: number): number {
  return ease((x - from) / (to - from));
}

/** Where the camera looks: the middle of the map, drifting toward the player's light. */
export function cameraAt(ms: number, you: { u: number; v: number }) {
  const z = zoomAt(ms);
  let k = 0;
  if (ms >= CITY_END_MS && ms < SEARCH_END_MS) {
    k = 0.4 * ease((ms - CITY_END_MS) / (SEARCH_END_MS - CITY_END_MS));
  } else if (ms >= SEARCH_END_MS) {
    k = 0.4 + 0.6 * ease((ms - SEARCH_END_MS) / (DIVE_END_MS - SEARCH_END_MS));
  }
  return { z, cx: 0.5 + (you.u - 0.5) * k, cy: 0.5 + (you.v - 0.5) * k };
}

export type Renderer = {
  setCity(city: City): void;
  resize(): void;
  draw(ms: number): void;
  dispose(): void;
};

export function createRenderer(canvas: HTMLCanvasElement, initial: City, dprCap = 2): Renderer {
  const ctx = canvas.getContext("2d")!;
  const sprites = ([0, 1, 2, 3] as Hue[]).map((h) => sprite(HUES[h]));
  const bokehs = ([0, 1, 2, 3] as Hue[]).map((h) => bokehSprite(HUES[h]));
  const map = new Image();
  let mapReady = false;
  map.onload = () => {
    mapReady = true;
  };
  map.src = MAP_PICTURE.src;

  let city = initial;
  /** For each light, the first step of the search that puts it out (0: it never goes). */
  let dropStep = new Uint8Array(0);
  let width = 0;
  let height = 0;
  let dpr = 1;

  function plan() {
    dropStep = new Uint8Array(city.lights.length);
    city.lights.forEach((light, i) => {
      for (let step = 1; step <= SEARCH_STEPS.length; step++) {
        if (!survives(light, step, city.you)) {
          dropStep[i] = step;
          break;
        }
      }
    });
  }
  plan();

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
  }

  function draw(ms: number) {
    if (width === 0) resize();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#06040f";
    ctx.fillRect(0, 0, width, height);

    const { z, cx, cy } = cameraAt(ms, city.you);
    const imgW = MAP_PICTURE.width;
    const imgH = MAP_PICTURE.height;
    const base = Math.min(width / imgW, height / imgH) * 0.96;
    const w = imgW * base * z;
    const h = imgH * base * z;
    const left = width / 2 - cx * w;
    const top = height / 2 - cy * h;

    // The map itself: dim, and gone by the time the camera is among the lights.
    const mapAlpha = 0.5 * ease((ms - 250) / 1400) * (1 - smoothstep(z, 2.5, 7));
    if (mapReady && mapAlpha > 0.01) {
      ctx.globalAlpha = mapAlpha;
      ctx.drawImage(map, left, top, w, h);
      ctx.globalAlpha = 1;
    }

    ctx.globalCompositeOperation = "lighter";
    const lit = ease((ms - 500) / 1800);
    const stepSpan = (SEARCH_END_MS - CITY_END_MS) / SEARCH_STEPS.length;
    // From close in the lights stop being points and become out-of-focus discs.
    const focus = smoothstep(z, 6, 20);
    const bokeh = 1 + 1.5 * smoothstep(z, 8, 28);
    const deepIn = smoothstep(z, 3, 9);
    const t = ms / 1000;

    for (let i = 0; i < city.lights.length; i++) {
      const light = city.lights[i]!;
      const x = left + light.u * w;
      const y = top + light.v * h;
      if (x < -80 || x > width + 80 || y < -80 || y > height + 80) continue;

      let alpha = 0.42 + 0.4 * (0.5 + 0.5 * Math.sin(t * light.speed + light.phase));
      alpha *= lit;
      if (light.deep) alpha *= deepIn;

      const step = dropStep[i]!;
      if (step > 0) {
        const goes = CITY_END_MS + (step - 1) * stepSpan + light.r * 700;
        alpha *= 1 - 0.97 * ease((ms - goes) / 600);
      } else if (ms >= CITY_END_MS && !light.you) {
        // What is left glows brighter with every step it survives.
        alpha *= 1 + 0.9 * ease((ms - CITY_END_MS) / (SEARCH_END_MS - CITY_END_MS));
      }

      let radius = (1.5 + light.size * 1.5) * Math.pow(Math.min(z, 40), 0.55) * bokeh;
      // Overlapping discs add, so the closer in, the less each one gives.
      alpha *= 1 - 0.55 * focus;
      if (light.you) {
        const arrive = ease((ms - (SEARCH_END_MS - 900)) / 700);
        alpha = ms < CITY_END_MS ? alpha : Math.max(alpha, 0.5 + 0.5 * arrive);
        radius *= (1.6 + 0.6 * Math.sin(t * 5) * arrive) * (1 - 0.4 * focus);
      }
      if (alpha < 0.012) continue;
      ctx.globalAlpha = Math.min(1, alpha);
      const art = focus > 0.5 ? bokehs : sprites;
      ctx.drawImage(art[light.hue]!, x - radius, y - radius, radius * 2, radius * 2);
    }
    ctx.globalAlpha = 1;

    // Sirens: a few rings going out from the city, red and blue, before the search.
    if (ms > 1300 && ms < CITY_END_MS + 400) {
      ctx.globalCompositeOperation = "lighter";
      ctx.lineWidth = 1.2;
      for (let k = 0; k < 6; k++) {
        const light = city.lights[(k * 977 + 131) % Math.max(1, city.lights.length - 1)]!;
        const born = 1500 + k * 330;
        const age = ms - born;
        if (age < 0 || age > 1400 || light.deep) continue;
        const x = left + light.u * w;
        const y = top + light.v * h;
        ctx.strokeStyle = k % 2 ? "rgba(255,70,90," : "rgba(70,130,255,";
        ctx.strokeStyle += `${(1 - age / 1400) * 0.7})`;
        ctx.beginPath();
        ctx.arc(x, y, 4 + age * 0.04 * Math.min(z, 3), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // The lock: rings closing on the player's light, and lines to the edges of the screen.
    const lockFrom = CITY_END_MS + 2 * stepSpan;
    if (ms > lockFrom && ms < DIVE_END_MS - 500) {
      const x = left + city.you.u * w;
      const y = top + city.you.v * h;
      const fade = ease((ms - lockFrom) / 900) * (1 - ease((ms - (DIVE_END_MS - 1400)) / 800));
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `rgba(255,70,160,${0.8 * fade})`;
      ctx.lineWidth = 1.4;
      for (let r = 0; r < 3; r++) {
        const size = 14 + r * 18 + (1 - ease((ms - lockFrom) / 1400)) * (80 - r * 20);
        ctx.strokeRect(x - size, y - size, size * 2, size * 2);
      }
      ctx.strokeStyle = `rgba(255,70,160,${0.32 * fade})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  return {
    setCity(next) {
      city = next;
      plan();
    },
    resize,
    draw,
    dispose() {
      map.onload = null;
    },
  };
}
