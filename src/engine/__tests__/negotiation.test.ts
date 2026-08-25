import { describe, expect, it } from "vitest";
import {
  BROKER_DEFAULT_SKILL_LEVEL,
  BROKER_DEFAULT_STAT,
  HOOK_ASKS,
  canAsk,
  generateJob,
  getSkill,
  hookAskSpec,
  isHookAsk,
  jobIdForSeed,
  knownTerms,
  missionOffer,
  openAsks,
  raisedPayout,
  settleHookAsk,
  startingTerms,
  type HookTerms,
  type MissionOffer,
} from "@/engine";

const OFFER: MissionOffer = {
  brokerName: "Wakako Okada",
  brokerKey: "wakako_okada",
  brokerLine: "who takes her cut off the top",
  patronName: "Adele Voss",
  patronOrg: "Arasaka Subcontracts",
  district: "Watson",
  opposition: "Tyger Claws — three of them, and they are not new at this",
  pitch: "A quiet job, before the week turns.",
  ask: "Bring the case back intact",
};

describe("hook ask specs", () => {
  it("names a printed Skill for every ask", () => {
    for (const ask of HOOK_ASKS) {
      const spec = hookAskSpec(ask);
      expect(() => getSkill(spec.skillId)).not.toThrow();
      if (spec.opposedBy) expect(() => getSkill(spec.opposedBy!)).not.toThrow();
    }
  });

  it("gives every ask either a DV or an opponent, never both and never neither", () => {
    for (const ask of HOOK_ASKS) {
      const spec = hookAskSpec(ask);
      const opposed = spec.opposedBy !== null;
      const flat = spec.dv !== null;
      expect(opposed !== flat).toBe(true);
    }
  });

  it("recognises its own asks and nothing else", () => {
    expect(isHookAsk("pay")).toBe(true);
    expect(isHookAsk("bribe")).toBe(false);
    expect(isHookAsk(3)).toBe(false);
  });

  it("puts a broker in the professional band by default", () => {
    expect(BROKER_DEFAULT_STAT).toBeGreaterThanOrEqual(5);
    expect(BROKER_DEFAULT_STAT).toBeLessThanOrEqual(8);
    expect(BROKER_DEFAULT_SKILL_LEVEL).toBeGreaterThanOrEqual(2);
    expect(BROKER_DEFAULT_SKILL_LEVEL).toBeLessThanOrEqual(6);
  });
});

describe("raisedPayout", () => {
  it("raises a quarter on an ordinary success", () => {
    expect(raisedPayout(1000, 3)).toBe(1250);
  });

  it("raises half when the fixer folds", () => {
    expect(raisedPayout(1000, 12)).toBe(1500);
  });

  it("rounds to the fifty a fixer would actually say", () => {
    expect(raisedPayout(1100, 1) % 50).toBe(0);
    expect(raisedPayout(1130, 11) % 50).toBe(0);
  });

  it("leaves a job with no printed fee alone", () => {
    expect(raisedPayout(0, 20)).toBe(0);
  });
});

describe("settleHookAsk", () => {
  const terms = startingTerms(1200);

  it("spends the ask whether it lands or not", () => {
    const won = settleHookAsk(terms, OFFER, "pay", { success: true, margin: 4 });
    const lost = settleHookAsk(terms, OFFER, "pay", { success: false, margin: -3 });
    expect(canAsk(won.terms, "pay")).toBe(false);
    expect(canAsk(lost.terms, "pay")).toBe(false);
  });

  it("raises the fee off the printed base, not the current one", () => {
    const once = settleHookAsk(terms, OFFER, "pay", { success: true, margin: 4 });
    expect(once.terms.payout).toBe(1500);
    expect(once.terms.basePayout).toBe(1200);
  });

  it("costs standing with the broker when a push is refused", () => {
    const lost = settleHookAsk(terms, OFFER, "pay", { success: false, margin: -6 });
    expect(lost.dispositionDelta).toBe(-1);
    expect(lost.terms.payout).toBe(1200);
    expect(lost.summary).toContain("1200eb");
  });

  it("costs nothing with the broker when the street was asked instead", () => {
    const lost = settleHookAsk(terms, OFFER, "risk", { success: false, margin: -2 });
    expect(lost.dispositionDelta).toBe(0);
  });

  it("hands over the client only on a success", () => {
    const won = settleHookAsk(terms, OFFER, "patron", { success: true, margin: 2 });
    expect(won.revealed).toContain("Adele Voss");
    expect(won.revealed).toContain("Arasaka Subcontracts");
    const lost = settleHookAsk(terms, OFFER, "patron", { success: false, margin: -1 });
    expect(lost.revealed).toBeNull();
  });

  it("hands over what is waiting only on a success", () => {
    const won = settleHookAsk(terms, OFFER, "risk", { success: true, margin: 5 });
    expect(won.revealed).toContain("Tyger Claws");
    expect(won.terms.learned).toContain("risk");
  });

  it("never lowers the fee, even on a success that cannot beat the table", () => {
    const already: HookTerms = { basePayout: 1000, payout: 1500, asked: [], learned: [] };
    const out = settleHookAsk(already, OFFER, "pay", { success: true, margin: 1 });
    expect(out.terms.payout).toBe(1500);
  });
});

describe("openAsks", () => {
  it("drops an ask once it has been spent", () => {
    const after = settleHookAsk(startingTerms(800), OFFER, "risk", {
      success: true,
      margin: 1,
    }).terms;
    expect(openAsks(after).map((s) => s.ask)).toEqual(["pay", "patron"]);
  });
});

describe("knownTerms", () => {
  it("tells the player only what they actually bought", () => {
    const fresh = startingTerms(500);
    expect(knownTerms(fresh, OFFER)).toEqual([]);
    const learned = settleHookAsk(fresh, OFFER, "patron", { success: true, margin: 3 }).terms;
    const lines = knownTerms(learned, OFFER);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("Adele Voss");
  });
});

describe("missionOffer", () => {
  it("reads a generated job's offer straight off the mission", () => {
    const job = generateJob(0x5eed1234);
    const offer = missionOffer(job);
    expect(job.offer).toBeDefined();
    expect(offer.brokerName).not.toBe("");
    expect(offer.brokerKey).toMatch(/^[a-z0-9_]+$/);
    expect(offer.pitch.length).toBeGreaterThan(20);
    expect(offer.ask.length).toBeGreaterThan(3);
    // The secrets are present in the offer and absent from the pitch.
    expect(offer.patronName).not.toBe("");
    expect(offer.opposition).not.toBe("");
  });

  it("is as deterministic as the job it belongs to", () => {
    const seed = 0x0badc0de;
    expect(missionOffer(generateJob(seed))).toEqual(missionOffer(generateJob(seed)));
    expect(jobIdForSeed(seed)).toBe(jobIdForSeed(seed));
  });

  it("names the same broker the mission's patron line credits", () => {
    const job = generateJob(0x11223344);
    expect(job.patron).toContain(missionOffer(job).brokerName);
  });
});
