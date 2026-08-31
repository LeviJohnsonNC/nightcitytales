/**
 * What the ledger owes once the NPCs have finished acting.
 *
 * This pair — close the fight if it ended, prompt the Death Save if one is due
 * — used to live only in the play loop's handover, which meant the OPENING
 * wrote neither. The opening is a stretch of NPC Turns like any other: everyone
 * who beat the player on Initiative acts before the player does, and by the
 * time it hands over, a Mortally Wounded character is standing on their own
 * Turn owing a save.
 *
 * Nothing wrote the prompt row, and the Death Save card is rendered from that
 * row. So the fight arrived with a board that said it was the player's Turn,
 * no card, and every action refused behind the scenes. Seeding a mortal
 * character from /combat reached it on the first click.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const ledger: { type: string; summary: string }[] = [];

vi.mock("@/lib/backend", () => ({
  appendCampaignEvent: vi.fn(async (row: Record<string, unknown>) => {
    ledger.push({ type: row["type"] as string, summary: (row["summary"] ?? "") as string });
    return row;
  }),
}));
vi.mock("@/features/campaign/encounterState", () => ({
  createLiveEncounter: vi.fn(),
  saveLiveEncounter: vi.fn(),
}));
vi.mock("@/features/campaign/combatLog", () => ({
  logAttack: vi.fn(),
  logCoverDamage: vi.fn(),
  logDeathSave: vi.fn(),
}));

const { settleNpcTurns } = await import("../combatFlow");
const { arenaFor } = await import("@/engine");
import type { EncounterStatus, WoundStateCode } from "@/engine";
import type { LiveEncounter } from "@/features/campaign/encounterState";

/** A fight parked on whichever combatant the test says, in whatever shape. */
function fight(over: {
  wound?: WoundStateCode;
  status?: EncounterStatus;
  /** 0 is the player, 1 the hostile. */
  activeIndex?: number;
  playerDefeated?: boolean;
}): LiveEncounter {
  const body = (id: string, isPlayer: boolean) => ({
    id,
    name: isPlayer ? "Vela" : "Scav",
    side: isPlayer ? "friendly" : "hostile",
    isPlayer,
    ref: 6,
    body: 6,
    hpMax: 35,
    hp: isPlayer && over.wound === "mortal" ? 0 : 35,
    seriouslyWoundedThreshold: 18,
    woundState: isPlayer ? (over.wound ?? "none") : "none",
    deathSavePenalty: 0,
    spHead: 7,
    spBody: 7,
    defeated: isPlayer ? Boolean(over.playerDefeated) : false,
    initiative: isPlayer ? 9 : 14,
  });
  return {
    id: "e",
    arena: arenaFor("street").key,
    cover: {},
    version: 0,
    state: {
      round: 1,
      order: ["p", "h"],
      activeIndex: over.activeIndex ?? 0,
      status: over.status ?? "active",
      combatants: { p: body("p", true), h: body("h", false) },
    },
    data: {},
  } as unknown as LiveEncounter;
}

const types = () => ledger.map((e) => e.type);

beforeEach(() => {
  ledger.length = 0;
});

describe("settleNpcTurns", () => {
  it("prompts the Death Save a Mortally Wounded player's Turn owes", async () => {
    const result = await settleNpcTurns("c", null, fight({ wound: "mortal" }));
    expect(types()).toEqual(["death_save_prompt"]);
    expect(result.owed?.name).toBe("Vela");
    // The card reads the name off the row, so it has to be in it.
    expect(ledger[0]!.summary).toContain("Vela");
  });

  it("says nothing when the fight is still on and nobody owes a save", async () => {
    const result = await settleNpcTurns("c", null, fight({}));
    expect(types()).toEqual([]);
    expect(result).toEqual({ status: "", owed: null });
  });

  it("does not prompt when the Turn belongs to somebody else", async () => {
    // A save is owed at the START of the Mortally Wounded combatant's own Turn.
    // The hostile is on the clock here, so the player owes nothing yet.
    await settleNpcTurns("c", null, fight({ wound: "mortal", activeIndex: 1 }));
    expect(types()).toEqual([]);
  });

  it("closes a finished fight, and asks a corpse for no dice", async () => {
    const result = await settleNpcTurns(
      "c",
      null,
      fight({ wound: "mortal", playerDefeated: true, status: "friendlies_lost" }),
    );
    expect(types()).toEqual(["encounter_ended"]);
    expect(result.owed).toBeNull();
    // The GM is handed the closing line to narrate rather than left to guess.
    expect(result.status).toContain("the fight is over");
  });

  it("closes a won fight too", async () => {
    const result = await settleNpcTurns("c", null, fight({ status: "friendlies_won" }));
    expect(types()).toEqual(["encounter_ended"]);
    expect(result.status).toContain("hostiles are all down");
  });
});
