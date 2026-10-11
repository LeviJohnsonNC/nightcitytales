/**
 * Reading somebody costs suspicion, and a read that LANDS must keep the cost.
 *
 * Both halves write the person's `data`, which a save replaces whole. The
 * reveal used to be built from the row read before the cost was paid, so every
 * successful Persuasion or Interrogation quietly took its own suspicion back
 * off, and only failed reads ever made anybody guarded.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CampaignNpc, Json } from "@/lib/backend";

const rows = new Map<string, CampaignNpc>();
const events: { type: string }[] = [];

vi.mock("@/lib/backend", () => ({
  findCampaignNpc: vi.fn(async (_campaignId: string, key: string) => rows.get(key) ?? null),
  saveCampaignNpc: vi.fn(async (_campaignId: string, key: string, patch: { data: Json }) => {
    const row = rows.get(key)!;
    // Replaced whole, as the real save does.
    rows.set(key, { ...row, data: patch.data });
  }),
  appendCampaignEvent: vi.fn(async (event: { type: string }) => {
    events.push(event);
  }),
}));

const { applyInsight } = await import("../socialInsight");

function fixer(): CampaignNpc {
  return {
    npc_id: "fixer",
    name: "Rogue",
    disposition: 0,
    data: {
      role: "fixer",
      standing: "",
      dossier: {
        wants: "A clean name.",
        fear: "Being owed.",
        secret: "She sold the Afterlife.",
        breakingPoint: "A friend's blood.",
      },
    },
  } as unknown as CampaignNpc;
}

const dataOf = (key: string) => rows.get(key)!.data as Record<string, unknown>;

beforeEach(() => {
  rows.clear();
  events.length = 0;
  rows.set("fixer", fixer());
});

describe("a social read", () => {
  it("keeps the suspicion it cost when it lands", async () => {
    const read = await applyInsight({
      campaignId: "c1",
      npcKey: "fixer",
      skillId: "interrogation",
      success: true,
      margin: 5,
      today: 3,
    });
    expect(read?.kind).toBe("learned");
    expect(dataOf("fixer")["known"]).toHaveLength(1);
    expect(dataOf("fixer")["suspicion"]).toBeTruthy();
    expect(events.map((e) => e.type)).toEqual(["npc_read"]);
  });

  it("charges a failed read and learns nothing", async () => {
    const read = await applyInsight({
      campaignId: "c1",
      npcKey: "fixer",
      skillId: "persuasion",
      success: false,
      margin: -2,
      today: 3,
    });
    expect(read).toBeNull();
    expect(dataOf("fixer")["suspicion"]).toBeTruthy();
    expect(dataOf("fixer")["known"]).toBeUndefined();
  });

  it("does not touch anybody for a Skill that reads nobody", async () => {
    const read = await applyInsight({
      campaignId: "c1",
      npcKey: "fixer",
      skillId: "athletics",
      success: true,
      margin: 5,
      today: 3,
    });
    expect(read).toBeNull();
    expect(dataOf("fixer")["suspicion"]).toBeUndefined();
  });
});
