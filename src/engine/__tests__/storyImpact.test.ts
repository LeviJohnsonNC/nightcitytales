/**
 * What a published story does.
 *
 * The Media's Credibility was the most complete Role Ability in the engine and
 * the least consequential in the game: the roll worked and nothing moved. These
 * tests hold the two halves of the fix — a believed story costs the people it
 * is about, and the evidence behind it is something the character found out
 * rather than a number they typed.
 */
import { describe, expect, it } from "vitest";
import {
  STORY_IMPACT_IS_HOUSE_RULE,
  credibilityFor,
  evidenceBonus,
  storyEvidence,
  storyImpactFor,
} from "@/engine";

describe("storyImpactFor", () => {
  it("hangs on the printed Credibility bands and carries their prose", () => {
    for (const rank of [1, 3, 5, 7, 9, 10]) {
      const impact = storyImpactFor(rank);
      const band = credibilityFor(rank);
      expect(impact, String(rank)).not.toBeNull();
      expect(impact!.impact).toBe(band!.impact);
      expect(impact!.audience).toBe(band!.audience);
    }
  });

  it("hurts them more the further the story reaches", () => {
    const low = storyImpactFor(1)!;
    const high = storyImpactFor(10)!;
    expect(high.clockSegments).toBeGreaterThan(low.clockSegments);
    expect(high.standing).toBeLessThanOrEqual(low.standing);
  });

  it("never helps you and never heals them", () => {
    for (let rank = 1; rank <= 10; rank += 1) {
      const impact = storyImpactFor(rank)!;
      // Segments come OFF their clock, so the number is what is removed.
      expect(impact.clockSegments, String(rank)).toBeGreaterThan(0);
      // And standing only ever falls: nobody likes the person who wrote it.
      expect(impact.standing, String(rank)).toBeLessThan(0);
    }
  });

  it("says plainly that the numbers are ours and the bands are not", () => {
    expect(STORY_IMPACT_IS_HOUSE_RULE).toBe(true);
  });
});

describe("storyEvidence", () => {
  it("counts only what was found out since the last story on the topic", () => {
    const discoveredDays = [1, 4, 9, 12];
    expect(storyEvidence({ discoveredDays, lastStoryDay: 5 }).pieces).toBe(2);
    expect(storyEvidence({ discoveredDays, lastStoryDay: null }).pieces).toBe(4);
    expect(storyEvidence({ discoveredDays, lastStoryDay: 12 }).pieces).toBe(0);
  });

  it("refuses a second story with nothing new, which is the printed rule", () => {
    expect(storyEvidence({ discoveredDays: [1, 2], lastStoryDay: 2 }).publishable).toBe(false);
    expect(storyEvidence({ discoveredDays: [1, 2], lastStoryDay: 1 }).publishable).toBe(true);
  });

  it("refuses a first story with nothing found out at all", () => {
    expect(storyEvidence({ discoveredDays: [], lastStoryDay: null }).publishable).toBe(false);
  });

  it("ignores truths with no date rather than counting them as new", () => {
    const evidence = storyEvidence({ discoveredDays: [null, undefined, 7], lastStoryDay: 3 });
    expect(evidence.pieces).toBe(1);
  });

  it("uses the printed evidence thresholds, not one of its own", () => {
    for (const pieces of [0, 1, 4, 5, 9]) {
      const days = Array.from({ length: pieces }, (_, i) => i + 10);
      expect(storyEvidence({ discoveredDays: days, lastStoryDay: 1 }).bonus).toBe(
        evidenceBonus(pieces),
      );
    }
  });
});
