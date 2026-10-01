import { describe, expect, it } from "vitest";
import { PARAGRAPH_PAUSE_MS, TYPE_CPS, isRevealed, revealed, typingDuration } from "../landingText";
import { KNOWN_HOURS, tintFor } from "../landingTint";
import { hourWords } from "../openingContext";

const prose = ["Hello there.", "A second, longer paragraph follows it.", "Last."];

describe("the prose, typed", () => {
  it("shows nothing at first and all of it at the end", () => {
    expect(revealed(prose, 0)).toEqual([0, 0, 0]);
    expect(isRevealed(prose, revealed(prose, 0))).toBe(false);
    const end = revealed(prose, typingDuration(prose) + 1);
    expect(end).toEqual(prose.map((p) => p.length));
    expect(isRevealed(prose, end)).toBe(true);
  });

  it("types a paragraph at the speed it is meant to, one at a time", () => {
    const half = Math.floor((prose[0]!.length / TYPE_CPS) * 500);
    const counts = revealed(prose, half);
    expect(counts[0]).toBeGreaterThan(0);
    expect(counts[0]).toBeLessThan(prose[0]!.length);
    expect(counts[1]).toBe(0);
    expect(counts[2]).toBe(0);
  });

  it("breathes between paragraphs: the next does not start the instant the last ends", () => {
    const firstDone = (prose[0]!.length / TYPE_CPS) * 1000;
    expect(revealed(prose, firstDone + PARAGRAPH_PAUSE_MS / 2)).toEqual([prose[0]!.length, 0, 0]);
    expect(revealed(prose, firstDone + PARAGRAPH_PAUSE_MS + 250)[1]).toBeGreaterThan(0);
  });

  it("only ever shows more as time goes on", () => {
    let last = 0;
    for (let ms = 0; ms <= typingDuration(prose) + 200; ms += 25) {
      const total = revealed(prose, ms).reduce((a, b) => a + b, 0);
      expect(total).toBeGreaterThanOrEqual(last);
      last = total;
    }
  });

  it("is a few seconds for an opening, not a minute", () => {
    const opening = Array.from({ length: 3 }, () => "x".repeat(420));
    expect(typingDuration(opening)).toBeLessThan(25_000);
  });

  it("shows all of it for a skip, which is just a very large time", () => {
    expect(isRevealed(prose, revealed(prose, Number.POSITIVE_INFINITY))).toBe(true);
  });
});

describe("the colour of the night", () => {
  it("has a tint for every hour the narrator can be told", () => {
    const told = new Set(
      [0, 3 * 60, 5 * 60, 9 * 60, 12 * 60, 16 * 60, 19 * 60, 22 * 60].map(hourWords),
    );
    for (const hour of told) expect(KNOWN_HOURS, hour).toContain(hour);
    for (const hour of KNOWN_HOURS) expect(tintFor(hour).gradient).toContain("gradient");
  });

  it("falls back to the late evening for an hour it does not know, or none", () => {
    expect(tintFor(undefined)).toBe(tintFor("late evening"));
    expect(tintFor("teatime")).toBe(tintFor("late evening"));
  });
});
