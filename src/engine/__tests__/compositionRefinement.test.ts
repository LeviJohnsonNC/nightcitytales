import { expect, it } from "vitest";
import legacy from "./fixtures/composition-v5.json";
import { composeScene, readSceneManifest, rectsOverlap } from "../index";

it("loads actual pre-refinement v5 snapshots byte-for-byte without applying new recipes", () => {
  for (const scene of legacy) {
    const saved = readSceneManifest({ version: 1, scene });
    expect(saved).toEqual(scene);
    expect(saved.layout.arena.environment!.recipeVersion).toBe(5);
  }
});

it("gives the large warehouse support room a distinct packing workflow", () => {
  const env = composeScene("warehouse", 4).layout.arena.environment!;
  expect(env.recipeVersion).toBe(6);
  expect(env.clusters.some((c) => c.kind === "repair_support")).toBe(true);
  expect(env.clusters.some((c) => c.kind === "packing_station")).toBe(true);
  expect(
    env.interior!.access.filter((a) => /Packing work|Dispatch handling/.test(a.label)),
  ).toHaveLength(2);
});

it("balances office work pods and sizes the conference group without adding workstations", () => {
  const arena = composeScene("office", 4).layout.arena;
  const desks = arena.cover!.filter((p) => p.id.startsWith("work_") && p.id.includes("desk_"));
  expect(desks).toHaveLength(4);
  expect(Math.min(...desks.map((p) => p.rect.x))).toBeGreaterThan(2);
  expect(arena.environment!.clusters.some((c) => c.kind === "conference_suite")).toBe(true);
  expect(arena.environment!.props.filter((p) => p.art === "conference-table")).toHaveLength(3);
});

it("distinguishes the opposed alley courts by usable ground, not rotation or dressing", () => {
  const single = composeScene("alley", 4).layout.arena.environment!;
  const opposed = composeScene("alley", 11).layout.arena.environment!;
  expect(single.zones.some((z) => z.id === "east-court")).toBe(false);
  const court = opposed.zones.find((z) => z.id === "east-court")!;
  expect(court.rect.width).toBe(8);
  expect(opposed.structures.some((s) => rectsOverlap(s.rect, court.rect))).toBe(false);
  expect(opposed.clusters.find((c) => c.id === "service_east")!.zoneId).toBe(court.id);
});
