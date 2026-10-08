import { battlefieldProjection } from "../battlefieldProjection";
import type { Point, Arena } from "@/engine";
import { CHARACTER_FRAME, SCENE_PERSON_HEIGHT } from "./sceneArtMetrics";

/** Shared scenic framing: focus on playable space, with an explicit overview. */
export function battlefieldCameraPreset(arena: Arena, view: "play" | "overview" = "play") {
  if (view === "overview" && arena.environment) {
    const { project, pixelsPerMetre } = battlefieldProjection(
      arena.extent.width,
      arena.extent.height,
    );
    const bounds = [
      { rect: { x: 0, y: 0, ...arena.extent }, height: 0 },
      ...arena.environment.structures,
    ];
    const points = bounds.flatMap(({ rect: r, height }) =>
      [r.x, r.x + r.width].flatMap((x) =>
        [r.y, r.y + r.height].flatMap((y) => {
          const p = project({ x, y });
          return [p, { x: p.x, y: p.y - height * pixelsPerMetre }];
        }),
      ),
    );
    const left = Math.min(...points.map((p) => p.x)),
      right = Math.max(...points.map((p) => p.x));
    const top = Math.min(...points.map((p) => p.y)),
      bottom = Math.max(...points.map((p) => p.y));
    return {
      x: (left + right) / 2 - 550,
      y: (top + bottom) / 2 - 340,
      zoom: Math.min(1100 / (right - left + 100), 680 / (bottom - top + 100)),
    };
  }
  return {
    x: 0,
    y: 0,
    zoom: arena.environment
      ? arena.environment.interior
        ? 1.15
        : 1.35
      : view === "overview"
        ? 0.8
        : 1,
  };
}

/** Keep character art and its hit/occlusion height proportional to the metre grid. */
export function composedUnitMetrics(arena: Arena) {
  const ppm = battlefieldProjection(arena.extent.width, arena.extent.height).pixelsPerMetre;
  return {
    scale: (SCENE_PERSON_HEIGHT * ppm) / CHARACTER_FRAME.height,
    top: SCENE_PERSON_HEIGHT * ppm,
  };
}

/** Match SVG's xMidYMid meet exactly, including letterboxing and camera offsets. */
export function courtyardCamera(
  width: number,
  height: number,
  camera: { x: number; y: number; zoom: number },
) {
  return {
    zoom: Math.min(width / 1100, height / 680) * camera.zoom,
    x: 550 + camera.x,
    y: 340 + camera.y,
  };
}

/** Constant speed along the saved route; interpolation never supplies a command position. */
export function routePosition(path: Point[], progress: number): Point | null {
  if (!path.length) return null;
  const lengths = path.slice(1).map((p, i) => Math.hypot(p.x - path[i]!.x, p.y - path[i]!.y));
  let remaining = lengths.reduce((sum, n) => sum + n, 0) * Math.min(1, Math.max(0, progress));
  for (let i = 0; i < lengths.length; i++) {
    const length = lengths[i]!;
    if (length > 0 && remaining <= length) {
      const a = path[i]!,
        b = path[i + 1]!;
      return {
        x: a.x + ((b.x - a.x) * remaining) / length,
        y: a.y + ((b.y - a.y) * remaining) / length,
      };
    }
    remaining -= length;
  }
  return path[path.length - 1]!;
}

/** A street composition fitted to a snapshot of the participants, not a tracking camera. */
export function intersectionActionCamera(
  arena: Arena,
  positions: readonly Point[],
  viewport: { width: number; height: number },
) {
  const fallback = battlefieldCameraPreset(arena);
  if (
    arena.environment?.recipe !== "intersection" ||
    arena.environment.interior ||
    !positions.length
  )
    return fallback;
  const { width, height } = viewport;
  if (width <= 48 || height <= 0) return fallback;
  const { project, pixelsPerMetre: ppm } = battlefieldProjection(
    arena.extent.width,
    arena.extent.height,
  );
  const projected = positions
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .map(project);
  if (!projected.length) return fallback;
  // Include nearby pavement as well as the complete standing figures. The upper
  // reserve keeps heads below the camera toolbar; the lower reserve clears hints.
  const apron = 2.5 * ppm;
  const left = Math.min(...projected.map((p) => p.x)) - apron;
  const right = Math.max(...projected.map((p) => p.x)) + apron;
  const top = Math.min(...projected.map((p) => p.y)) - SCENE_PERSON_HEIGHT * ppm - apron;
  const bottom = Math.max(...projected.map((p) => p.y)) + apron;
  const baseScale = Math.min(width / 1100, height / 680);
  const topInset = Math.min(88, height * 0.22),
    bottomInset = Math.min(48, height * 0.13);
  const fit = Math.min(
    (width - 48) / (right - left),
    (height - topInset - bottomInset) / (bottom - top),
  );
  const zoom = Math.min(2.15, fit / baseScale);
  return {
    x: (left + right) / 2 - 550,
    y: (top + bottom) / 2 - 340 - (topInset - bottomInset) / (2 * baseScale * zoom),
    zoom,
  };
}
