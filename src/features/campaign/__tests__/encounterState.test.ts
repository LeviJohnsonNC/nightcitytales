import { describe, expect, it, vi } from "vitest";

const saveEncounter = vi.fn(async () => undefined);
vi.mock("@/lib/backend", () => ({ saveEncounter }));

const { saveLiveEncounter } = await import("../encounterState");

describe("saveLiveEncounter", () => {
  it("persists the exchange and all durable player consequences together", async () => {
    await saveLiveEncounter(
      {
        id: "encounter-1",
        arena: null,
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
