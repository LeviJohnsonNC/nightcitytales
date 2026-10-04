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
    "?place=office&seed=4294967295&view=structure&actors=1&access=1&adventure=1&damage=destroyed&framing=overview";
  const value = readReviewQuery(query);
  expect(value).toMatchObject({
    kind: "office",
    seed: 4294967295,
    actors: true,
    entrances: true,
    adventure: true,
    damage: "destroyed",
    structureOnly: true,
    framing: "overview",
  });
  expect(readReviewQuery(reviewQuery(value))).toEqual(value);
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
        expect(b.props.filter((p) => important.includes(p.art))).toHaveLength(
          a.props.filter((p) => important.includes(p.art)).length,
        );
    }
  }
});
