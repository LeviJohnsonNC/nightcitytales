import { describe, expect, it } from "vitest";
import {
  DISTRICTS,
  MAX_SIGNALS,
  MAX_SIGNALS_PER_DISTRICT,
  SIGNAL_ICONS,
  SIGNAL_KINDS,
  cityBeats,
  derivePlaceBeats,
  isSignalKind,
  placeSignals,
  signalForDistrict,
  signalForPlace,
  type LifeSituation,
} from "@/engine";

const SEED = "campaign-1";

/** A live situation anchored at a place, as the beats produce them. */
function at(
  placeKey: string,
  overrides: Partial<LifeSituation> & { signal?: string } = {},
): LifeSituation {
  const { signal, ...rest } = overrides;
  return {
    key: `place_${placeKey}_test`,
    category: "opportunity",
    title: "Something is on",
    summary: "…",
    status: "live",
    severity: 2,
    ...rest,
    data: { placeKey, ...(signal ? { signal } : {}), ...(rest.data ?? {}) },
  };
}

describe("what a pin may say", () => {
  it("keeps its icons and its vocabulary in step", () => {
    for (const kind of SIGNAL_KINDS) {
      expect(isSignalKind(kind)).toBe(true);
      expect(SIGNAL_ICONS[kind], kind).toBeTruthy();
    }
    expect(isSignalKind("interesting")).toBe(false);
  });

  it("lights a pin only for a situation that is live and somewhere real", () => {
    // No row, no signal. That is the whole rule.
    expect(placeSignals({ situations: [] })).toEqual([]);
    expect(placeSignals({ situations: [at("x5", { status: "resolved" })] })).toEqual([]);
    expect(placeSignals({ situations: [at("zz9")] })).toEqual([]);
    expect(
      placeSignals({ situations: [{ ...at("x5"), data: {} }] }),
      "a situation with no place is not about anywhere",
    ).toEqual([]);
  });

  it("names the place, the district and what produced it", () => {
    const [signal] = placeSignals({ situations: [at("x5", { title: "Night market tonight" })] });
    expect(signal?.placeName).toBe("Minimallism");
    expect(signal?.districtKey).toBe("rancho_coronado");
    expect(signal?.label).toBe("Night market tonight");
    // Traceable back to its row, always.
    expect(signal?.source).toMatch(/^situation:/);
  });

  it("wears the mark the beat asked for, and a warning when it asked for nothing", () => {
    expect(placeSignals({ situations: [at("x5", { signal: "market" })] })[0]?.kind).toBe("market");
    expect(placeSignals({ situations: [at("x5")] })[0]?.kind).toBe("event");
    expect(placeSignals({ situations: [at("x5", { category: "people" })] })[0]?.kind).toBe(
      "person",
    );
    // A kind nobody defined is not a way in.
    expect(placeSignals({ situations: [at("x5", { signal: "explosion" })] })[0]?.kind).toBe(
      "event",
    );
  });
});

describe("the budget", () => {
  it("never lights more than three pins in the whole city", () => {
    const busy = ["a1", "b1", "c1", "e1", "g1", "h1", "i1", "j1"].map((k) => at(k));
    const signals = placeSignals({ situations: busy });
    expect(signals.length).toBe(MAX_SIGNALS);
  });

  it("never lights two in the same district", () => {
    // Rancho Coronado can have five live situations at once; the map shows one.
    const local = ["x1", "x2", "x3", "x4", "x5"].map((k) => at(k));
    const signals = placeSignals({ situations: local });
    expect(signals.length).toBe(MAX_SIGNALS_PER_DISTRICT);
    expect(signals[0]?.districtKey).toBe("rancho_coronado");
  });

  it("keeps the loudest when it cannot keep them all", () => {
    // A thing coming for you outranks a market four districts away.
    const signals = placeSignals({
      situations: [
        at("a1", { severity: 1, title: "quiet" }),
        at("b1", { severity: 1, title: "also quiet" }),
        at("c1", { severity: 1, title: "still quiet" }),
        at("e1", { severity: 5, title: "somebody is at the door" }),
      ],
    });
    expect(signals.map((s) => s.label)).toContain("somebody is at the door");
    expect(signals.length).toBe(MAX_SIGNALS);
  });

  it("gives the same answer for the same rows, every time", () => {
    const rows = ["x1", "b1", "c1", "e1"].map((k) => at(k));
    expect(placeSignals({ situations: rows })).toEqual(placeSignals({ situations: rows }));
  });
});

describe("people light pins too, once anybody has been placed", () => {
  it("says nothing while nobody has been placed anywhere", () => {
    // Which is the truth today: the cast have no haunts yet.
    expect(placeSignals({ situations: [], peopleAt: [] })).toEqual([]);
  });

  it("names whoever is there", () => {
    const [signal] = placeSignals({
      situations: [],
      peopleAt: [{ name: "Alan Lam", placeKey: "o2" }],
    });
    expect(signal?.label).toBe("Alan Lam is here");
    expect(signal?.kind).toBe("person");
    expect(signal?.placeName).toBe("Yum Seng");
  });

  it("ignores a face standing somewhere the atlas does not have", () => {
    expect(
      placeSignals({ situations: [], peopleAt: [{ name: "Nobody", placeKey: "zz9" }] }),
    ).toEqual([]);
  });
});

describe("looking a signal up", () => {
  it("finds one by district and by place", () => {
    const signals = placeSignals({ situations: [at("x5")] });
    expect(signalForDistrict(signals, "rancho_coronado")?.placeKey).toBe("x5");
    expect(signalForPlace(signals, "x5")?.districtKey).toBe("rancho_coronado");
    expect(signalForDistrict(signals, "the_glen")).toBeUndefined();
    expect(signalForPlace(signals, "x1")).toBeUndefined();
  });
});

describe("the map stays quiet on an ordinary night", () => {
  it("lights nothing at all most evenings, from the real beats", () => {
    // The end-to-end version of the budget: run the actual derivation over four
    // months in the slice district and count how often the map has anything on
    // it. If this ever approaches every night, the city has become a quest log.
    let lit = 0;
    for (let day = 0; day < 120; day += 1) {
      const beats = derivePlaceBeats({
        districtKey: "rancho_coronado",
        day,
        minute: 21 * 60,
        seed: "campaign-1",
      });
      if (placeSignals({ situations: beats }).length) lit += 1;
    }
    expect(lit).toBeGreaterThan(0);
    expect(lit).toBeLessThan(60);
  });
});

describe("what is on elsewhere", () => {
  it("only reports districts it was asked about", () => {
    // The caller's rule is districts the character knows. Somewhere they have
    // never been does not send them word of its night market.
    const one = cityBeats({
      districtKeys: ["rancho_coronado"],
      day: 2,
      minute: 21 * 60,
      seed: SEED,
    });
    for (const beat of one) {
      expect(beat.data?.["districtKey"]).toBe("rancho_coronado");
    }
    expect(cityBeats({ districtKeys: [], day: 2, minute: 21 * 60, seed: SEED })).toEqual([]);
  });

  it("counts a beat once when it is both underfoot and on the map", () => {
    // The district the character is standing in arrives twice: persisted, and
    // again in the preview. One row, one pin.
    const here = derivePlaceBeats({
      districtKey: "rancho_coronado",
      day: 2,
      minute: 21 * 60,
      seed: SEED,
    });
    const city = cityBeats({
      districtKeys: ["rancho_coronado"],
      day: 2,
      minute: 21 * 60,
      seed: SEED,
    });
    expect(here.length).toBeGreaterThan(0);
    expect(placeSignals({ situations: [...here, ...city] }).length).toBe(
      placeSignals({ situations: here }).length,
    );
  });

  it("still respects the budget across a city the player knows well", () => {
    const everywhere = cityBeats({
      districtKeys: DISTRICTS.map((d) => d.key),
      day: 3,
      minute: 21 * 60,
      seed: SEED,
    });
    const signals = placeSignals({ situations: everywhere });
    expect(signals.length).toBeLessThanOrEqual(MAX_SIGNALS);
    expect(new Set(signals.map((s) => s.districtKey)).size).toBe(signals.length);
  });
});
