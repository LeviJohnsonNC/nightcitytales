import { describe, expect, it } from "vitest";
import {
  DIRTY_FRACTION,
  PAYMENT,
  PAYMENT_BAD_JOB_PENALTY,
  SHORT_FRACTION,
  describePayment,
  rollPayment,
} from "../payment";
import { seededRng } from "../dice";

/** An RNG pinned to one face of the payment die. */
function face(value: number): () => number {
  return () => (value - 0.5) / PAYMENT.die;
}

describe("the payment table", () => {
  it("tiles the die with no gaps or overlaps", () => {
    const covered = new Set<number>();
    for (const entry of PAYMENT.entries) {
      for (let f = entry.from; f <= entry.to; f += 1) {
        expect(covered.has(f)).toBe(false);
        covered.add(f);
      }
    }
    expect(covered.size).toBe(PAYMENT.die);
  });

  it("pays in full far more often than not", () => {
    const paid = PAYMENT.entries.find((e) => e.key === "paid")!;
    expect((paid.to - paid.from + 1) / PAYMENT.die).toBeGreaterThan(0.6);
  });

  it("is open — the player watches the money land", () => {
    expect(PAYMENT.visibility).toBe("open");
  });
});

describe("rollPayment", () => {
  it("hands over the whole fee when the die says paid", () => {
    const out = rollPayment({ agreed: 1000, rng: face(1) });
    expect(out).toMatchObject({ key: "paid", paid: 1000, withheld: 0, brokerStanding: 0 });
  });

  it("shaves the fee when the broker shorts you, and it costs them", () => {
    const out = rollPayment({ agreed: 1000, rng: face(5) });
    expect(out.key).toBe("short");
    expect(out.paid).toBe(1000 * (1 - SHORT_FRACTION));
    expect(out.withheld).toBe(1000 * SHORT_FRACTION);
    // They chose to do this and the character knows.
    expect(out.brokerStanding).toBeLessThan(0);
  });

  it("costs you to move marked money, but nobody chose that", () => {
    const out = rollPayment({ agreed: 1000, rng: face(6) });
    expect(out.key).toBe("dirty");
    expect(out.paid).toBe(1000 * (1 - DIRTY_FRACTION));
    expect(out.brokerStanding).toBe(0);
  });

  it("makes a messy job likelier to get shaved", () => {
    // A four is paid in full normally; with the job gone badly it reads as a five.
    expect(rollPayment({ agreed: 1000, rng: face(4) }).key).toBe("paid");
    expect(rollPayment({ agreed: 1000, rng: face(4), messy: true }).key).toBe("short");
    expect(PAYMENT_BAD_JOB_PENALTY).toBe(1);
  });

  it("shows the honest face and the circumstance in the roll", () => {
    const out = rollPayment({ agreed: 1000, rng: face(4), messy: true });
    expect(out.roll.roll.rolls).toEqual([4]);
    expect(out.roll.roll.formula).toContain("Job went badly(1)");
  });

  it("never pays out more than was agreed", () => {
    const rng = seededRng(90210);
    for (let i = 0; i < 500; i += 1) {
      const out = rollPayment({ agreed: 1000, rng, messy: i % 2 === 0 });
      expect(out.paid).toBeLessThanOrEqual(out.agreed);
      expect(out.paid).toBeGreaterThanOrEqual(0);
      expect(out.withheld).toBe(out.agreed - out.paid);
    }
  });

  it("handles a job that pays nothing without inventing money", () => {
    for (const f of [1, 5, 6]) {
      const out = rollPayment({ agreed: 0, rng: face(f) });
      expect(out.paid).toBe(0);
      expect(out.withheld).toBe(0);
    }
  });

  it("rounds to whole eurobucks", () => {
    const out = rollPayment({ agreed: 333, rng: face(5) });
    expect(Number.isInteger(out.paid)).toBe(true);
    expect(Number.isInteger(out.withheld)).toBe(true);
  });

  it("refuses to be handed a negative fee", () => {
    expect(rollPayment({ agreed: -500, rng: face(1) }).paid).toBe(0);
  });

  it("gets you paid in full most of the time over a long run", () => {
    const rng = seededRng(2077);
    let full = 0;
    const jobs = 2000;
    for (let i = 0; i < jobs; i += 1) {
      if (rollPayment({ agreed: 1000, rng }).key === "paid") full += 1;
    }
    expect(full / jobs).toBeGreaterThan(0.6);
    expect(full / jobs).toBeLessThan(0.73);
  });
});

describe("describePayment", () => {
  it("says so plainly when the money is all there", () => {
    expect(describePayment(rollPayment({ agreed: 1000, rng: face(1) }))).toBe(
      "1000eb paid in full.",
    );
  });

  it("shows both numbers when it is not", () => {
    const line = describePayment(rollPayment({ agreed: 1000, rng: face(5) }));
    expect(line).toContain("600eb of 1000eb");
    expect(line).toContain("short");
  });
});
