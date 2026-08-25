import { describe, expect, it } from "vitest";
import {
  generateJob,
  jobIdForSeed,
  missionOffer,
  settleHookAsk,
  type LifeSituation,
} from "@/engine";
import type { CampaignEvent, CampaignFlag } from "@/lib/backend";
import {
  askTagFrom,
  hookFromSituation,
  hookKeyFor,
  hookUpsert,
  liveHookSituation,
  nextJobSeedFrom,
  offerTerms,
  printedPayout,
  wireOfferFor,
  NEXT_JOB_SEED_FLAG,
} from "../hookOffer";

const SEED = 0x1234abcd;

function situationFrom(upsert: ReturnType<typeof hookUpsert>): LifeSituation {
  return {
    key: upsert.situationKey,
    category: "hook",
    title: upsert.title,
    summary: upsert.summary ?? "",
    status: "live",
    severity: upsert.severity ?? 3,
    ...(upsert.npcKey ? { npcKey: upsert.npcKey } : {}),
    data: upsert.data as unknown as Record<string, unknown>,
  };
}

function flag(value: unknown): CampaignFlag {
  return {
    id: "flag-1",
    campaign_id: "campaign-1",
    flag: NEXT_JOB_SEED_FLAG,
    value: value as CampaignFlag["value"],
  };
}

function promptEvent(data: unknown): CampaignEvent {
  return { id: "event-1", data } as unknown as CampaignEvent;
}

describe("the job on the wire", () => {
  it("names a real mission that can be loaded back by id", () => {
    const { missionId, wire } = wireOfferFor(SEED);
    expect(missionId).toBe(jobIdForSeed(SEED));
    expect(wire.title).toBe(generateJob(SEED).title);
    expect(wire.payout).toBeGreaterThan(0);
  });

  it("says only what a broker would say out loud", () => {
    const { wire } = wireOfferFor(SEED);
    const offer = missionOffer(generateJob(SEED));
    const said = JSON.stringify(wire);
    // The client and the opposition are what negotiating is FOR. Leaking them
    // into the pitch would make both asks worthless.
    expect(said).not.toContain(offer.patronName);
    expect(said).not.toContain(offer.opposition);
    expect(wire.brokerName).toBe(offer.brokerName);
  });

  it("reads a stored seed back, and reports none when nothing is stored", () => {
    expect(nextJobSeedFrom([flag(SEED)])).toBe(SEED);
    expect(nextJobSeedFrom([])).toBeNull();
    expect(nextJobSeedFrom([flag("not a seed")])).toBeNull();
  });
});

describe("hook round trip", () => {
  const mission = generateJob(SEED);
  const offer = missionOffer(mission);

  it("survives being written and read back", () => {
    const terms = offerTerms(mission);
    const hook = hookFromSituation(situationFrom(hookUpsert("hook_x", mission, offer, terms)));
    expect(hook).not.toBeNull();
    expect(hook!.missionId).toBe(mission.id);
    expect(hook!.terms).toEqual(terms);
    expect(hook!.offer).toEqual(offer);
  });

  it("carries a negotiated fee across the round trip", () => {
    const raised = settleHookAsk(offerTerms(mission), offer, "pay", {
      success: true,
      margin: 12,
    }).terms;
    const hook = hookFromSituation(situationFrom(hookUpsert("hook_x", mission, offer, raised)));
    expect(hook!.terms.payout).toBe(raised.payout);
    expect(hook!.terms.payout).toBeGreaterThan(printedPayout(mission));
    expect(hook!.terms.asked).toEqual(["pay"]);
  });

  it("refuses an offer that names no job rather than inventing one", () => {
    const orphan: LifeSituation = {
      key: "hook_old",
      category: "hook",
      title: "Some job a model made up",
      summary: "1200eb, quiet work",
      status: "live",
      severity: 3,
      data: { patron: "Dex", payout: 1200 },
    };
    expect(hookFromSituation(orphan)).toBeNull();
  });

  it("refuses a job id that no longer resolves", () => {
    const broken = situationFrom(hookUpsert("hook_x", mission, offer, offerTerms(mission)));
    broken.data = { ...broken.data, missionId: "job-not-a-real-id" };
    expect(hookFromSituation(broken)).toBeNull();
  });

  it("keys an offer by broker and job, so a job turned down keeps its record", () => {
    expect(hookKeyFor(offer, mission.id)).toBe(hookKeyFor(offer, mission.id));
    expect(hookKeyFor(offer, mission.id)).not.toBe(hookKeyFor(offer, jobIdForSeed(SEED + 1)));
  });
});

describe("liveHookSituation", () => {
  const hook = (status: LifeSituation["status"]): LifeSituation => ({
    key: `hook_${status}`,
    category: "hook",
    title: "Work",
    summary: "",
    status,
    severity: 3,
  });

  it("finds only a live offer", () => {
    expect(liveHookSituation([hook("resolved"), hook("expired")])).toBeNull();
    expect(liveHookSituation([hook("expired"), hook("live")])?.status).toBe("live");
  });

  it("ignores everything that is not an offer", () => {
    const rent: LifeSituation = {
      key: "rent_due",
      category: "pressure",
      title: "Rent",
      summary: "",
      status: "live",
      severity: 5,
    };
    expect(liveHookSituation([rent])).toBeNull();
  });
});

describe("askTagFrom", () => {
  it("recognises a negotiation prompt", () => {
    const tag = askTagFrom(
      promptEvent({ skillId: "trading", negotiation: { ask: "pay", situationKey: "hook_x" } }),
    );
    expect(tag).toEqual({ ask: "pay", situationKey: "hook_x" });
  });

  it("leaves an ordinary check alone", () => {
    expect(askTagFrom(promptEvent({ skillId: "stealth", dv: 15 }))).toBeNull();
    expect(askTagFrom(undefined)).toBeNull();
  });

  it("rejects a tag naming something that is not an ask", () => {
    expect(
      askTagFrom(promptEvent({ negotiation: { ask: "bribe", situationKey: "hook_x" } })),
    ).toBeNull();
    expect(askTagFrom(promptEvent({ negotiation: { ask: "pay" } }))).toBeNull();
  });
});
