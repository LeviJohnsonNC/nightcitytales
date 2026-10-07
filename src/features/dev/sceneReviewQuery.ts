import type { SceneEnvironment } from "@/engine";
import {
  REFLECTION_MODE_DEFAULT,
  REFLECTION_MODES,
  type ReflectionMode,
} from "@/features/play/courtyard/groundReflection";
export const REVIEW_KINDS = [
  "intersection",
  "alley",
  "office",
  "nightclub",
  "residential",
  "warehouse",
  "garage",
] as const;
export function reviewSeed(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 && n <= 0xffffffff ? n : null;
}
/** "x,y" or "x,y,zoom": finite numbers only, or nothing. */
function numbers(value: string | null, count: number): number[] | null {
  if (!value) return null;
  const parts = value.split(",").map(Number);
  return parts.length === count && parts.every(Number.isFinite) ? parts : null;
}
function readReflect(value: string | null): ReflectionMode {
  if (value === "0") return "hidden";
  if (value === "1") return "on";
  return REFLECTION_MODES.find((m) => m === value) ?? REFLECTION_MODE_DEFAULT;
}
export function readReviewQuery(search: string) {
  const p = new URLSearchParams(search);
  return {
    kind: (REVIEW_KINDS.find((k) => k === p.get("place")) ??
      "intersection") as SceneEnvironment["recipe"],
    seed: reviewSeed(p.get("seed") ?? "1") ?? 1,
    adventure: p.get("adventure") === "1",
    actors: p.get("actors") === "1",
    entrances: p.get("access") === "1",
    structureOnly: p.get("view") === "structure",
    revealActivity: p.get("reveal") !== "0",
    lights: p.get("lights") !== "0",
    night: p.get("night") !== "0",
    /**
     * The shop corner's reflections (`ReflectionMode`): `reflect=0` hides them, `skip`
     * builds none, `pictures` and `glints` show one part; absent is the default.
     */
    reflections: readReflect(p.get("reflect")),
    /** A fixed camera (scene offset x, y and zoom), so a capture can be repeated exactly. */
    camera: ((c) => (c ? { x: c[0]!, y: c[1]!, zoom: c[2]! } : null))(numbers(p.get("cam"), 3)),
    /** Where the review character stands, in metres: a fixture choice, not a rule. */
    player: ((c) => (c ? { x: c[0]!, y: c[1]! } : null))(numbers(p.get("player"), 2)),
    /** Where the scene's first hostile stands, in metres: the same kind of fixture choice. */
    foe: ((c) => (c ? { x: c[0]!, y: c[1]! } : null))(numbers(p.get("foe"), 2)),
    framing: p.get("framing") === "overview" ? ("overview" as const) : ("play" as const),
    damage:
      ["intact", "damaged", "destroyed", "mixed"].find((d) => d === p.get("damage")) ?? "intact",
  };
}
export function reviewQuery(value: ReturnType<typeof readReviewQuery>): string {
  const query = new URLSearchParams({
    place: value.kind,
    seed: String(value.seed),
    adventure: value.adventure ? "1" : "0",
    actors: value.actors ? "1" : "0",
    access: value.entrances ? "1" : "0",
    view: value.structureOnly ? "structure" : "furnished",
    reveal: value.revealActivity ? "1" : "0",
    lights: value.lights ? "1" : "0",
    night: value.night ? "1" : "0",
    reflect: value.reflections,
    framing: value.framing,
    damage: value.damage,
  });
  if (value.camera) query.set("cam", [value.camera.x, value.camera.y, value.camera.zoom].join(","));
  if (value.player) query.set("player", [value.player.x, value.player.y].join(","));
  if (value.foe) query.set("foe", [value.foe.x, value.foe.y].join(","));
  return query.toString();
}
/** Six demonstrated combinations, grouped by topology for side-by-side review. */
export const COMPOSITION_REVIEW_SEEDS = {
  intersection: [1, 4, 2, 12, 3, 13],
  office: [1, 4, 2, 8, 3, 0],
  alley: [1, 4, 2, 11, 3, 5],
  residential: [1, 0, 2, 19, 3, 4],
  warehouse: [1, 4, 2, 5, 3, 7],
  garage: [1, 0, 2, 33, 3, 14],
  nightclub: [1, 7, 2, 8, 3, 0],
};
