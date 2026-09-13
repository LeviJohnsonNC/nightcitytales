import { describe, expect, it } from "vitest";
import type { LifeClock } from "@/engine";
import { elapsedLabel, receiptsBetween, snapshotOf, type TurnSnapshot } from "../receipts";

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
    expect(out[0]).toMatchObject({ text: "−€$450", tone: "bad" });
    const paid = receiptsBetween(snap(), snap({ eurobucks: 3000 }));
    expect(paid[0]).toMatchObject({ text: "+€$2,000", tone: "good" });
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
