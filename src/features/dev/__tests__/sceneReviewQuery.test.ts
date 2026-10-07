import { expect, it } from "vitest";
import { composeScene } from "@/engine";
import {
  COMPOSITION_REVIEW_SEEDS,
  REVIEW_KINDS,
  readReviewQuery,
  reviewQuery,
  reviewSeed,
} from "../sceneReviewQuery";
it("reproduces seed, environment and gameplay/structure review settings through a URL", () => {
  const query =
    "?place=office&seed=4294967295&view=structure&actors=1&access=1&adventure=1&damage=destroyed&framing=overview&reveal=0&lights=0";
  const value = readReviewQuery(query);
  expect(value).toMatchObject({
    kind: "office",
    seed: 4294967295,
    actors: true,
    entrances: true,
    adventure: true,
    damage: "destroyed",
    structureOnly: true,
    revealActivity: false,
    lights: false,
    framing: "overview",
  });
  expect(readReviewQuery(reviewQuery(value))).toEqual(value);
});
it("lights are on unless the URL turns them off", () => {
  expect(readReviewQuery("?place=intersection&seed=7").lights).toBe(true);
  expect(readReviewQuery("?lights=0").lights).toBe(false);
});
it("reflections are on unless the URL turns them off, and survive a round trip", () => {
  expect(readReviewQuery("?place=intersection&seed=7").reflections).toBe(true);
  const off = readReviewQuery("?place=intersection&seed=7&reflect=0");
  expect(off.reflections).toBe(false);
  expect(readReviewQuery(reviewQuery(off)).reflections).toBe(false);
});
it("keeps malformed URL/input seeds out of generation", () => {
  for (const input of ["", "-1", "1.5", "NaN", "1e3", "4294967296"])
    expect(reviewSeed(input)).toBeNull();
  expect(reviewSeed("0")).toBe(0);
  expect(readReviewQuery("?place=unknown&seed=-1&damage=bad")).toMatchObject({
    kind: "intersection",
    seed: 1,
    damage: "intact",
  });
});

it("offers paired programs in the same family without losing seating or service capacity", () => {
  for (const kind of REVIEW_KINDS) {
    const seeds = COMPOSITION_REVIEW_SEEDS[kind];
    for (let i = 0; i < seeds.length; i += 2) {
      const reference = composeScene(kind, seeds[i]!);
      const alternative = composeScene(kind, seeds[i + 1]!);
      const a = reference.layout.arena.environment!;
      const b = alternative.layout.arena.environment!;
      expect(a.composition!.family).toBe(b.composition!.family);
      expect(a.composition!.program).not.toBe(b.composition!.program);
      const important =
        kind === "nightclub"
          ? ["seat", "seat-reverse"]
          : kind === "garage"
            ? ["sedan-engine"]
            : kind === "warehouse"
              ? ["shelf"]
              : [];
      if (important.length)
        expect(
          b.props.filter(
            (p) =>
              important.includes(p.art) &&
              (kind !== "warehouse" ||
                b.clusters.find((c) => c.id === p.clusterId)?.kind === "rack_aisle"),
          ),
        ).toHaveLength(
          a.props.filter(
            (p) =>
              important.includes(p.art) &&
              (kind !== "warehouse" ||
                a.clusters.find((c) => c.id === p.clusterId)?.kind === "rack_aisle"),
          ).length,
        );
    }
  }
});
