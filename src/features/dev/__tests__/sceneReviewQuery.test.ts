import { expect, it } from "vitest";
import { readReviewQuery, reviewQuery, reviewSeed } from "../sceneReviewQuery";
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
