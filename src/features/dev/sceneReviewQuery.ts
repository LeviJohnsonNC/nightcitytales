import type { SceneEnvironment } from "@/engine";
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
    framing: p.get("framing") === "overview" ? ("overview" as const) : ("play" as const),
    damage: ["intact", "damaged", "destroyed"].find((d) => d === p.get("damage")) ?? "intact",
  };
}
export function reviewQuery(value: ReturnType<typeof readReviewQuery>): string {
  return new URLSearchParams({
    place: value.kind,
    seed: String(value.seed),
    adventure: value.adventure ? "1" : "0",
    actors: value.actors ? "1" : "0",
    access: value.entrances ? "1" : "0",
    view: value.structureOnly ? "structure" : "furnished",
    framing: value.framing,
    damage: value.damage,
  }).toString();
}
/** Six demonstrated combinations, grouped by topology for side-by-side review. */
export const COMPOSITION_REVIEW_SEEDS = {
  intersection: [1, 4, 2, 12, 3, 13],
  office: [1, 4, 2, 8, 3, 0],
};
