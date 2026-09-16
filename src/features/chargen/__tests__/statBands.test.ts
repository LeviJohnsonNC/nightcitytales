import { describe, expect, it } from "vitest";
import { statBand } from "../statBands";

describe("STAT presentation bands", () => {
  it.each([
    [2, "Very Bad"],
    [3, "Bad"],
    [4, "Neutral / Average"],
    [5, "Neutral / Average"],
    [6, "Good"],
    [7, "Very Good"],
    [8, "Very Good"],
  ] as const)("maps %i to %s", (value, label) => {
    expect(statBand(value).label).toBe(label);
  });
});
