import { describe, expect, it } from "vitest";
import { CYBERWARE, getCyberware } from "../catalog";

/**
 * Guards the cyberware catalog extracted from the core rulebook (pg. 110-116).
 * These are canaries: if an edit drops a category, breaks a foundation's slot
 * count, or leaves a dangling `requires`, they fail loudly.
 */
describe("cyberware catalog", () => {
  it("covers all 8 official RED categories", () => {
    const categories = new Set(CYBERWARE.map((c) => c.category));
    expect([...categories].sort()).toEqual(
      [
        "borgware",
        "cyberaudio",
        "cyberlimbs",
        "cyberoptics",
        "external",
        "fashionware",
        "internal",
        "neuralware",
      ].sort(),
    );
  });

  it("has the full extracted item set", () => {
    // Canary on the extraction size; update deliberately when the catalog grows.
    expect(CYBERWARE.length).toBe(96);
  });

  it("gives each foundation its printed Option Slot count", () => {
    const provides = (id: string) => getCyberware(id).providesSlots;
    expect(provides("neural_link")).toBe(5);
    expect(provides("cybereye")).toBe(3);
    expect(provides("cyberaudio_suite")).toBe(3);
    expect(provides("cyberarm")).toBe(4);
    expect(provides("cyberleg")).toBe(3);
  });

  it("marks exactly the five foundational pieces", () => {
    const foundations = CYBERWARE.filter((c) => c.foundational)
      .map((c) => c.id)
      .sort();
    expect(foundations).toEqual(
      ["cyberarm", "cyberaudio_suite", "cybereye", "cyberleg", "neural_link"].sort(),
    );
  });

  it("reads cost and Humanity Loss straight from the book", () => {
    const pain = getCyberware("pain_editor");
    expect(pain.cost).toBe(1000);
    expect(pain.humanityLoss).toBe(14);
    expect(pain.humanityLossDice).toBe("4d6");

    const subdermal = getCyberware("subdermal_armor");
    expect(subdermal.cost).toBe(1000);
    expect(subdermal.humanityLoss).toBe(14);

    const scratchers = getCyberware("scratchers");
    expect(scratchers.humanityLoss).toBe(2);
    expect(scratchers.humanityLossDice).toBe("1d6/2");
  });

  it("never leaves a dangling requires", () => {
    const ids = new Set(CYBERWARE.map((c) => c.id));
    for (const c of CYBERWARE) {
      if (c.requires) expect(ids.has(c.requires)).toBe(true);
    }
  });

  it("keeps cosmetic coverings and foundations slotless", () => {
    expect(getCyberware("plastic_covering").slotsUsed).toBe(0);
    expect(getCyberware("superchrome_covering").slotsUsed).toBe(0);
    expect(getCyberware("cyberarm").slotsUsed).toBe(0);
  });
});
