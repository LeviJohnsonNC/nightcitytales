/**
 * Reading a campaign's own filing history back.
 *
 * "You can't publish another story on the exact same topic without new
 * information" needs a date to count from, and the ledger already holds every
 * story in order — a second copy of it on the campaign would be a number that
 * can drift from the events that produced it.
 */
import { describe, expect, it } from "vitest";
import { STORY_EVENT, lastStoryDayFor } from "../publishing";

const story = (factionId: string, day: number) => ({
  type: STORY_EVENT,
  data: { factionId, day },
});

describe("lastStoryDayFor", () => {
  it("finds the most recent story about that faction and no other", () => {
    const events = [
      story("arasaka", 3),
      story("tyger_claws", 9),
      story("arasaka", 7),
      { type: "purchase", data: { factionId: "arasaka", day: 40 } },
    ];
    expect(lastStoryDayFor(events, "arasaka")).toBe(7);
    expect(lastStoryDayFor(events, "tyger_claws")).toBe(9);
  });

  it("is null for a faction never written about", () => {
    expect(lastStoryDayFor([story("arasaka", 3)], "militech")).toBeNull();
    expect(lastStoryDayFor([], "arasaka")).toBeNull();
  });

  it("ignores a story row with nothing usable on it", () => {
    const events = [
      { type: STORY_EVENT, data: null },
      { type: STORY_EVENT, data: { factionId: "arasaka" } },
      story("arasaka", 2),
    ];
    expect(lastStoryDayFor(events, "arasaka")).toBe(2);
  });
});
