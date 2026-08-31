import { describe, expect, it, vi } from "vitest";

const saveEncounter = vi.fn<(payload: unknown) => Promise<undefined>>(async () => undefined);
vi.mock("@/lib/backend", () => ({ saveEncounter }));

const { EncounterChangedError, saveLiveEncounter } = await import("../encounterState");

describe("saveLiveEncounter", () => {
  it("persists the exchange and all durable player consequences together", async () => {
    await saveLiveEncounter(
      {
        id: "encounter-1",
        arena: null,
        cover: {},
        version: 3,
        state: {
          round: 2,
          activeIndex: 0,
          order: ["player"],
          status: "active",
          combatants: {
            player: {
              id: "player",
              name: "Vela Ruiz",
              side: "friendly",
              isPlayer: true,
              ref: 8,
              body: 6,
              hp: 18,
              hpMax: 40,
              seriouslyWoundedThreshold: 20,
              woundState: "serious",
              deathSavePenalty: 1,
              spHead: 7,
              spBody: 9,
              initiative: 14,
              defeated: false,
            },
          },
        },
        data: {
          player: {
            key: "player",
            weaponName: "Very Heavy Pistol",
            damageDice: 4,
            rangeType: "pistol",
            position: { x: 0, y: 0 },
            move: 6,
            attackSkill: 6,
            armor: { headInventoryId: "head-armor", bodyInventoryId: "body-armor" },
          },
        },
      },
      { inventoryId: "weapon-1", loaded: 6 },
    );

    expect(saveEncounter).toHaveBeenCalledWith(
      expect.objectContaining({
        encounter_id: "encounter-1",
        player: {
          hp_current: 18,
          wound_state: "serious",
          mortal_save_failures: 1,
          head_inventory_id: "head-armor",
          head_sp: 7,
          body_inventory_id: "body-armor",
          body_sp: 9,
        },
        ammo: { inventory_id: "weapon-1", loaded: 6 },
      }),
    );
  });
});

describe("the version token", () => {
  it("sends the version it read, and advances it once the write lands", async () => {
    saveEncounter.mockClear();
    const live = {
      id: "encounter-2",
      arena: null,
      cover: {},
      version: 7,
      state: {
        round: 1,
        activeIndex: 0,
        order: ["player"],
        status: "active" as const,
        combatants: {
          player: {
            id: "player",
            name: "Vela Ruiz",
            side: "friendly" as const,
            isPlayer: true,
            ref: 8,
            body: 6,
            hp: 30,
            hpMax: 40,
            seriouslyWoundedThreshold: 20,
            woundState: "none" as const,
            deathSavePenalty: 0,
            spHead: 7,
            spBody: 7,
            defeated: false,
            initiative: 12,
          },
        },
      },
      data: {},
    };
    const after = await saveLiveEncounter(live as never);
    expect(saveEncounter.mock.calls[0]?.[0]).toMatchObject({ version: 7 });
    // Advanced locally rather than read back: the transaction sets it to
    // exactly the version it checked plus one.
    expect(after.version).toBe(8);
  });

  it("names a refused stale write as its own kind of failure", async () => {
    saveEncounter.mockClear();
    saveEncounter.mockRejectedValueOnce(new Error("encounter changed"));
    const live = {
      id: "encounter-3",
      arena: null,
      cover: {},
      version: 1,
      state: {
        round: 1,
        activeIndex: 0,
        order: ["player"],
        status: "active" as const,
        combatants: {
          player: {
            id: "player",
            name: "Vela Ruiz",
            side: "friendly" as const,
            isPlayer: true,
            ref: 8,
            body: 6,
            hp: 30,
            hpMax: 40,
            seriouslyWoundedThreshold: 20,
            woundState: "none" as const,
            deathSavePenalty: 0,
            spHead: 7,
            spBody: 7,
            defeated: false,
            initiative: 12,
          },
        },
      },
      data: {},
    };
    // Distinguishable, because the caller's answer is specific: re-read, never
    // retry the same payload.
    await expect(saveLiveEncounter(live as never)).rejects.toBeInstanceOf(EncounterChangedError);
  });
});
