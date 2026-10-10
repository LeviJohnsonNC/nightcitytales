import { describe, expect, it } from "vitest";
import { seededRng } from "@/engine";
import type { Campaign, CampaignNpc, CampaignVitals } from "@/lib/backend";
import { prepareRipperdocInstall } from "../cyberware";

/** The ripperdoc's clinic is somewhere you stand, not something you phone. */
const ripperdoc = {
  id: "npc-1",
  npc_id: "ripper-1",
  name: "Needles",
  disposition: 1,
} as CampaignNpc;
const vitals = { eurobucks: 100000, humanity_current: 60 } as CampaignVitals;

function at(location: string): Campaign {
  return { id: "c1", day: 3, minute: 600, location_key: location } as unknown as Campaign;
}

function prepare(location: string, practice?: string[]) {
  return prepareRipperdocInstall({
    campaign: at(location),
    vitals,
    cyberware: [],
    ripperdoc,
    phase: "life",
    hookSituationKey: null,
    itemId: "cybereye",
    ...(practice ? { practice } : {}),
    rng: seededRng(7),
  });
}

describe("installing chrome at the ripperdoc's clinic", () => {
  it("goes ahead at a place the ripperdoc works out of", () => {
    expect(prepare("i3", ["i3", "j5"]).outcome.plan.itemId).toBe("cybereye");
  });

  it("refuses anywhere else, and names where to go", () => {
    expect(() => prepare("a1", ["i3", "j5"])).toThrow(/Needles works out of Savage Docs or/);
  });

  it("does not check the place when the caller gave no practice", () => {
    expect(prepare("a1").outcome.plan.itemId).toBe("cybereye");
  });
});
