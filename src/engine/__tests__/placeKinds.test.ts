import { describe, expect, it } from "vitest";
import {
  KNOWN_PLACE_PULL_MINUTES,
  hasTag,
  nearestWithTag,
  tagNamed,
  tagsMentioned,
} from "@/engine";

describe("tagNamed — a kind of place, asked for in words", () => {
  it("reads a kind with an article in front of it", () => {
    expect(tagNamed("a bar")).toBe("bar");
    expect(tagNamed("The nearest clinic")).toBe("clinic");
    expect(tagNamed("some bars")).toBe("bar");
  });

  it("reads a few words that are not the tag's own name", () => {
    expect(tagNamed("a dive")).toBe("bar");
    expect(tagNamed("a doctor")).toBe("clinic");
  });

  it('reads "somewhere to ___" as the kind of place that is for', () => {
    expect(tagNamed("somewhere to drink")).toBe("bar");
    expect(tagNamed("somewhere to eat")).toBe("food");
  });

  it("does not turn a proper name into a kind", () => {
    expect(tagNamed("The Afterlife")).toBeUndefined();
    expect(tagNamed("Forlorn Hope")).toBeUndefined();
    expect(tagNamed("")).toBeUndefined();
    expect(tagNamed(null)).toBeUndefined();
  });
});

describe("tagsMentioned — the kinds a whole sentence reaches for", () => {
  it("finds the kind in the transcript that used to be refused", () => {
    expect(tagsMentioned("Go find a bar and order a drink")).toEqual(["bar"]);
  });

  it("does not read a verb in passing as a trip", () => {
    // "order a drink" once you are already somewhere is not a request to leave.
    expect(tagsMentioned("Sit at the counter and order a drink")).toEqual([]);
  });

  it("lists each kind once, in order", () => {
    expect(tagsMentioned("a clinic, then a bar, then another bar")).toEqual(["clinic", "bar"]);
  });
});

describe("nearestWithTag — which real place answers for a kind", () => {
  it("only ever returns places the atlas tags that way, nearest first", () => {
    const bars = nearestWithTag("old_japantown", "bar");
    expect(bars.length).toBeGreaterThan(3);
    for (const bar of bars) expect(hasTag(bar.key, "bar")).toBe(true);
    for (let i = 1; i < bars.length; i++) {
      expect(bars[i]!.minutes).toBeGreaterThanOrEqual(bars[i - 1]!.minutes);
    }
  });

  it("finds one in the next district over when there is none underfoot", () => {
    // The Hot Zone has no bar at all. "Find a bar" still has an answer.
    const [nearest] = nearestWithTag("the_hot_zone", "bar");
    expect(nearest).toBeDefined();
    expect(nearest!.districtKey).not.toBe("the_hot_zone");
  });

  it("finds the bar on the character's own street when there is one", () => {
    // Old Japantown used to have none, which sent "find a bar" from the
    // Precipice across a district line. It has the Paper Lantern now.
    const [nearest] = nearestWithTag("h5", "bar");
    expect(nearest!.districtKey).toBe("old_japantown");
  });

  it("goes back to a bar they know over a stranger that is barely nearer", () => {
    const bars = nearestWithTag("old_japantown", "bar");
    const nearest = bars[0]!;
    const known = bars.find(
      (b) => b !== nearest && b.minutes <= nearest.minutes + KNOWN_PLACE_PULL_MINUTES,
    );
    if (!known) return; // the atlas has no close second; nothing to prefer
    expect(nearestWithTag("old_japantown", "bar", { known: [known.key] })[0]!.key).toBe(known.key);
  });

  it("does not cross town for a bar they know", () => {
    const bars = nearestWithTag("old_japantown", "bar");
    const far = bars[bars.length - 1]!;
    expect(far.minutes).toBeGreaterThan(bars[0]!.minutes + KNOWN_PLACE_PULL_MINUTES);
    expect(nearestWithTag("old_japantown", "bar", { known: [far.key] })[0]!.key).toBe(bars[0]!.key);
  });

  it("respects a limit", () => {
    expect(nearestWithTag("little_europe", "bar", { limit: 2 })).toHaveLength(2);
  });

  it("returns nothing for a kind the city has none of", () => {
    expect(nearestWithTag("little_europe", "not_a_tag")).toEqual([]);
  });
});
