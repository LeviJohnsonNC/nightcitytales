import { describe, expect, it } from "vitest";
import type { LifeClock } from "@/engine";
import {
  elapsedLabel,
  receiptsBetween,
  skillReceipts,
  snapshotOf,
  type TurnSnapshot,
} from "../receipts";

/**
 * "Show, do not explain."
 *
 * PRODUCT.md gives the form outright — `Kiro ^`, `-E$450 +3 days` — and every
 * one of these values was already moved by a turn and written to a row. None of
 * them was ever shown as a CHANGE, which is the whole complaint: a number that
 * silently moves teaches the player nothing.
 *
 * The rule these tests exist to protect is that a card appears only when
 * something actually moved. A strip that is always lit is wallpaper.
 */

const clock = (over: Partial<LifeClock> = {}): LifeClock => ({
  key: "heat",
  label: "NCPD Heat",
  filled: 2,
  segments: 6,
  hidden: false,
  ...over,
});

const snap = (over: Partial<TurnSnapshot> = {}): TurnSnapshot => ({
  day: 10,
  minute: 600,
  eurobucks: 1000,
  hp: 30,
  humanity: 40,
  people: { kiro: { name: "Kiro", disposition: 2 } },
  clocks: { heat: clock() },
  ...over,
});

describe("nothing moved, nothing shown", () => {
  it("returns no cards when the turn changed nothing", () => {
    expect(receiptsBetween(snap(), snap())).toEqual([]);
  });
});

describe("what a turn cost", () => {
  it("shows money going out, and coming in", () => {
    const out = receiptsBetween(snap(), snap({ eurobucks: 550 }));
    expect(out[0]).toMatchObject({ text: "−€450", tone: "bad" });
    const paid = receiptsBetween(snap(), snap({ eurobucks: 3000 }));
    expect(paid[0]).toMatchObject({ text: "+€2,000", tone: "good" });
  });

  it("shows a wound as the move, not the total", () => {
    expect(receiptsBetween(snap(), snap({ hp: 21 }))[0]).toMatchObject({
      text: "HP 30 → 21",
      tone: "bad",
    });
  });

  it("shows which way somebody's opinion went", () => {
    const up = receiptsBetween(
      snap(),
      snap({ people: { kiro: { name: "Kiro", disposition: 4 } } }),
    );
    expect(up[0]).toMatchObject({ text: "Kiro ↑", tone: "good" });
    const down = receiptsBetween(
      snap(),
      snap({ people: { kiro: { name: "Kiro", disposition: -1 } } }),
    );
    expect(down[0]).toMatchObject({ text: "Kiro ↓", tone: "bad" });
  });

  it("draws a moved clock as its dial", () => {
    const out = receiptsBetween(snap(), snap({ clocks: { heat: clock({ filled: 4 }) } }));
    expect(out[0]).toMatchObject({
      text: "NCPD Heat 4/6",
      tone: "bad",
      meter: { filled: 4, segments: 6 },
    });
  });

  it("never shows a clock the character cannot feel coming", () => {
    // A hidden clock is hidden. Showing its movement as a receipt would leak
    // exactly what hiding it was for.
    const out = receiptsBetween(
      snap({ clocks: { secret: clock({ key: "secret", hidden: true }) } }),
      snap({ clocks: { secret: clock({ key: "secret", hidden: true, filled: 5 }) } }),
    );
    expect(out).toEqual([]);
  });

  it("puts time last, because it moves on almost every turn", () => {
    const out = receiptsBetween(snap(), snap({ eurobucks: 900, minute: 645 }));
    expect(out.map((r) => r.key)).toEqual(["money", "time"]);
  });

  it("calls out a month turning over, because that is why the rent chip moved", () => {
    const out = receiptsBetween(snap({ day: 29 }), snap({ day: 31 }));
    expect(out.some((r) => r.key === "month")).toBe(true);
  });
});

describe("elapsedLabel", () => {
  it("uses the largest unit that is honest", () => {
    expect(elapsedLabel(0, 0)).toBeNull();
    expect(elapsedLabel(0, 45)).toBe("+45 min");
    expect(elapsedLabel(0, 60)).toBe("+1 hour");
    expect(elapsedLabel(0, 180)).toBe("+3 hours");
    expect(elapsedLabel(1, 0)).toBe("+1 day");
    expect(elapsedLabel(3, 30)).toBe("+3 days");
  });

  it("never counts backwards", () => {
    expect(elapsedLabel(0, -30)).toBeNull();
  });
});

describe("snapshotOf", () => {
  it("keys people by their stable npc id, falling back to the name", () => {
    const taken = snapshotOf({
      clock: { day: 1, minute: 0 },
      vitals: { eurobucks: 0, hp_current: 1, humanity_current: 1 },
      npcs: [
        { npc_id: "kiro", name: "Kiro", disposition: 3 },
        { npc_id: null, name: "A stranger", disposition: 0 },
      ],
      pressure: [{ clock: clock() }],
    });
    expect(Object.keys(taken.people)).toEqual(["kiro", "A stranger"]);
    expect(taken.clocks["heat"]?.filled).toBe(2);
  });
});

describe("skillReceipts", () => {
  const before = {
    "handgun::": { name: "Handgun", level: 6 },
    "stealth::": { name: "Stealth", level: 4 },
  };

  it("names a Level bought, in the form PRODUCT.md gives", () => {
    const after = { ...before, "handgun::": { name: "Handgun", level: 7 } };
    expect(skillReceipts(before, after)).toEqual([
      { key: "skill:handgun::", text: "Handgun 6 → 7", tone: "good" },
    ]);
  });

  it("reads a line that appears from nowhere as a Skill bought from 0", () => {
    const after = { ...before, "brawling::": { name: "Brawling", level: 1 } };
    expect(skillReceipts(before, after).map((r) => r.text)).toEqual(["Brawling 0 → 1"]);
  });

  it("says nothing when nothing was bought", () => {
    expect(skillReceipts(before, { ...before })).toEqual([]);
  });

  it("does not report a fall, which play cannot cause", () => {
    const after = { ...before, "stealth::": { name: "Stealth", level: 3 } };
    expect(skillReceipts(before, after)).toEqual([]);
  });
});

describe("pinned goals as receipts", () => {
  const base: TurnSnapshot = {
    day: 3,
    minute: 600,
    eurobucks: 100,
    hp: 30,
    humanity: 60,
    people: {},
    clocks: {},
  };
  const at = (status: "far" | "ready" | "done" | "blocked") => ({
    ...base,
    goals: { "rank:5": { label: "Combat Awareness Rank 5", status } },
  });

  it("says when a pin comes within reach", () => {
    expect(receiptsBetween(at("far"), at("ready")).map((r) => r.text)).toEqual([
      "Within reach: Combat Awareness Rank 5",
    ]);
  });

  it("says when a pin is done", () => {
    expect(receiptsBetween(at("ready"), at("done")).map((r) => r.text)).toEqual([
      "Done: Combat Awareness Rank 5",
    ]);
  });

  it("says nothing for a pin that did not move, or one just pinned", () => {
    expect(receiptsBetween(at("far"), at("far"))).toEqual([]);
    expect(receiptsBetween(base, at("ready"))).toEqual([]);
  });

  it("does not call a goal that slipped back out of reach news", () => {
    expect(receiptsBetween(at("ready"), at("far"))).toEqual([]);
  });
});

describe("being heard of, as receipts", () => {
  const base: TurnSnapshot = {
    day: 3,
    minute: 600,
    eurobucks: 100,
    hp: 30,
    humanity: 60,
    people: {},
    clocks: {},
  };
  const at = (reputation: number, tierIndex: number, tierName: string): TurnSnapshot => ({
    ...base,
    climb: { reputation, tierIndex, tierName },
  });

  it("names a new Reputation and a better tier of work", () => {
    expect(
      receiptsBetween(at(2, 0, "Street work"), at(3, 1, "Steady work")).map((r) => r.text),
    ).toEqual(["Reputation 3", "Fixers offer you steady work now"]);
  });

  it("is silent when nothing rose, or when a cold fixer drops the tier", () => {
    expect(receiptsBetween(at(3, 1, "Steady work"), at(3, 1, "Steady work"))).toEqual([]);
    expect(receiptsBetween(at(3, 1, "Steady work"), at(3, 0, "Street work"))).toEqual([]);
  });
});

describe("what the city printed, as receipts", () => {
  const item = (key: string, headline: string, tone: "good" | "bad" | "neutral" = "bad") => ({
    key,
    headline,
    tone,
  });

  it("answers a turn with the headline it set off, and only that one", () => {
    const before = snap({ sheet: [item("place:e1", "Law comes through Camden Court")] });
    const after = snap({
      sheet: [
        item("place:e2", "Inspectors at The Verge"),
        item("place:e1", "Law comes through Camden Court"),
      ],
    });
    expect(receiptsBetween(before, after)).toEqual([
      { key: "sheet:place:e2", text: "The Sheet · Inspectors at The Verge", tone: "bad" },
    ]);
  });

  it("shows nothing when the sheet did not move, and nothing for the first load", () => {
    const same = snap({ sheet: [item("place:e1", "Law comes through Camden Court")] });
    expect(receiptsBetween(same, same)).toEqual([]);
    // A screen that has no sheet yet is a baseline, not a change.
    expect(receiptsBetween(snap(), same)).toEqual([]);
  });

  it("carries a good headline as good news", () => {
    const after = snap({ sheet: [item("place:e9", "Good word out of The Verge", "good")] });
    expect(receiptsBetween(snap({ sheet: [] }), after)[0]?.tone).toBe("good");
  });

  it("is two headlines at most: the sheet itself holds the rest", () => {
    const after = snap({ sheet: [item("a", "A"), item("b", "B"), item("c", "C")] });
    expect(receiptsBetween(snap({ sheet: [] }), after)).toHaveLength(2);
  });

  it("is carried through snapshotOf, slimmed to what the diff reads", () => {
    const snapshot = snapOf({
      sheet: [{ key: "k", headline: "H", tone: "bad", extra: "dropped" } as never],
    });
    expect(snapshot.sheet).toEqual([{ key: "k", headline: "H", tone: "bad" }]);
    expect(snapOf({}).sheet).toBeUndefined();
  });
});

function snapOf(extra: {
  sheet?: { key: string; headline: string; tone: "good" | "bad" | "neutral" }[];
}) {
  return snapshotOf({
    clock: { day: 1, minute: 0 },
    vitals: { eurobucks: 0, hp_current: 1, humanity_current: 1 },
    npcs: [],
    pressure: [],
    ...extra,
  });
}
