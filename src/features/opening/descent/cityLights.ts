/**
 * The city as a field of lights, and the one that is the player's.
 *
 * Every light sits on ground the atlas actually has: a cell of the traced
 * district raster (`engine/cityGrid`), moved onto the neon map picture by the
 * same warp the map modal uses. So when the lights go out it is the real
 * district that stays lit, and when the camera falls it falls onto the real
 * place the character sleeps. Seeded, so a remount draws the same city.
 *
 * Presentation only. Nothing here is a game number; the population on the
 * counter is a device (see `searchCounts`).
 */
import { DISTRICTS, GRID_HEIGHT, GRID_WIDTH, cityCells, getPlace, seededRng } from "@/engine";
import { placeOnMap } from "@/features/atlas/mapWarp";

/** 0 cyan, 1 violet, 2 pink, 3 amber: the colours of the city's signs. */
export type Hue = 0 | 1 | 2 | 3;

export type Light = {
  /** Where it is on the neon map picture, as fractions of its width and height. */
  u: number;
  v: number;
  district: string;
  area: string;
  /** Stable randoms, so what goes out first is the same every time. */
  r: number;
  q: number;
  hue: Hue;
  size: number;
  phase: number;
  speed: number;
  /** Only seen from close in: the bokeh the camera falls through. */
  deep: boolean;
  you: boolean;
};

export type City = {
  lights: Light[];
  /** The player's light, also the last element of `lights`. */
  you: Light;
};

/** The lights a descent draws, and how many on a device that cannot afford them. */
export const LIGHT_COUNT = 6000;
export const LIGHT_COUNT_LOW = 2400;
const DEEP_COUNT = 190;
/** How far from the player's light the deep bokeh scatters, as a fraction of the map. */
const DEEP_RADIUS = 0.034;

const AREA_OF = new Map(DISTRICTS.map((d) => [d.key, d.area as string]));

/** Every cell of the raster that is city. Computed once. */
let cityCache: ReturnType<typeof cityCells> | null = null;
function cells() {
  return (cityCache ??= cityCells());
}

function hueFor(rand: number): Hue {
  if (rand < 0.45) return 0;
  if (rand < 0.7) return 1;
  if (rand < 0.82) return 2;
  return 3;
}

/** Where on the map picture a place is, from the atlas coordinates it keeps. */
export function homeOnMap(
  placeKey: string | null | undefined,
  districtKey: string | null | undefined,
): { u: number; v: number } | null {
  const place = placeKey ? getPlace(placeKey) : undefined;
  const district = districtKey ? DISTRICTS.find((d) => d.key === districtKey) : undefined;
  const point = place?.map ?? district?.map;
  if (!point) return null;
  const at = placeOnMap(point.x, point.y);
  return { u: at.left / 100, v: at.top / 100 };
}

export function cityLights(input: {
  count: number;
  seed: number;
  /** The district the player lives in. Without one, the light is somewhere in the middle. */
  districtKey: string | null;
  placeKey: string | null;
}): City {
  const rng = seededRng(input.seed);
  const ground = cells();
  const lights: Light[] = [];

  const make = (u: number, v: number, district: string, extra: Partial<Light> = {}): Light => ({
    u,
    v,
    district,
    area: AREA_OF.get(district) ?? "",
    r: rng(),
    q: rng(),
    hue: hueFor(rng()),
    size: 0.6 + rng() * rng() * 1.8,
    phase: rng() * Math.PI * 2,
    speed: 0.6 + rng() * 2.2,
    deep: false,
    you: false,
    ...extra,
  });

  for (let i = 0; i < input.count && ground.length > 0; i++) {
    const cell = ground[Math.floor(rng() * ground.length)]!;
    const jx = (rng() - 0.5) * (100 / GRID_WIDTH);
    const jy = (rng() - 0.5) * (100 / GRID_HEIGHT);
    const at = placeOnMap(cell.x + jx, cell.y + jy);
    lights.push(make(at.left / 100, at.top / 100, cell.district));
  }

  const home = homeOnMap(input.placeKey, input.districtKey);
  const fallback = lights[0] ?? make(0.5, 0.5, input.districtKey ?? "");
  const youDistrict = input.districtKey ?? fallback.district;
  const at = home ?? { u: fallback.u, v: fallback.v };

  // The bokeh the camera falls through: a scatter close to the player's light.
  for (let i = 0; i < DEEP_COUNT; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = DEEP_RADIUS * Math.sqrt(rng());
    lights.push(
      make(at.u + Math.cos(angle) * radius, at.v + Math.sin(angle) * radius * 0.8, youDistrict, {
        deep: true,
        size: 1.2 + rng() * 2.4,
      }),
    );
  }

  const you = make(at.u, at.v, youDistrict, { you: true, hue: 2, size: 3, r: 0, q: 0 });
  lights.push(you);
  return { lights, you };
}

/** The steps of the search, in order. Each keeps a subset of what the one before kept. */
export type SearchStep = "area" | "district" | "role" | "who";
export const SEARCH_STEPS: SearchStep[] = ["area", "district", "role", "who"];

/** How much of what is left a step that is not about place keeps. Theatre, and said to be. */
const ROLE_KEEPS = 0.2;
const WHO_KEEPS = 0.06;

/**
 * Whether a light survives the first `step` steps of the search (0 is none).
 * The player's own light survives everything, and the deep scatter is not in
 * the search at all.
 */
export function survives(light: Light, step: number, you: Light): boolean {
  if (light.you) return true;
  if (light.deep) return step >= 1;
  if (step >= 1 && light.area !== you.area) return false;
  if (step >= 2 && light.district !== you.district) return false;
  if (step >= 3 && light.q > ROLE_KEEPS) return false;
  if (step >= 4 && light.q > WHO_KEEPS) return false;
  return true;
}

/**
 * The population the counter shows after each step of the search, ending in one.
 *
 * Counted from the lights themselves, so the first two numbers are the real
 * share of the city that lives in the player's area and district, scaled to
 * seven million; the last two are theatre. Always falling, always at least two
 * until the last.
 */
export function searchCounts(city: City, total: number): number[] {
  const real = city.lights.filter((l) => !l.deep && !l.you);
  const counts: number[] = [];
  let previous = total;
  for (let step = 1; step <= SEARCH_STEPS.length; step++) {
    const kept = real.filter((l) => survives(l, step, city.you)).length;
    const scaled = Math.round((kept / Math.max(1, real.length)) * total);
    const next = Math.max(2, Math.min(scaled, Math.floor(previous * 0.85)));
    counts.push(next);
    previous = next;
  }
  counts.push(1);
  return counts;
}
