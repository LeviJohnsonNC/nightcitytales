import { describe, expect, it } from "vitest";
import { singleShotDV, weaponProfile, type PerformAttackResult } from "@/engine";
import type { CampaignEvent, FullCharacter } from "@/lib/backend";
import type { LiveEncounter } from "@/features/campaign/encounterState";
import { liveInventory } from "../liveInventory";
import { attackOption, findTarget, pendingAttackFrom } from "../attackPrompt";
import { armorSp, weaponChoices } from "../encounterModel";
import { describeAttack } from "../combatFlow";

const event = (over: Partial<CampaignEvent>): CampaignEvent =>
  ({
    id: "e1",
    seq: 1,
    campaign_id: "c1",
    type: "gm_narration",
    beat_id: "b1",
    summary: "",
    roll: null,
    data: {},
    created_at: new Date().toISOString(),
    ...over,
  }) as CampaignEvent;

const character = {
  character: { name: "Red", role: "Solo" },
  stats: { ref: 7 },
  skills: [{ skill_id: "handgun", level: 5 }],
  gear: [
    { item_id: "medium_pistol", slot: "weapon", equipped: true, current_sp: null },
    { item_id: "light_armorjack", slot: "body", equipped: true, current_sp: 9 },
    { item_id: "kevlar", slot: "head", equipped: true, current_sp: null },
  ],
} as unknown as FullCharacter;

const live: LiveEncounter = {
  id: "enc1",
  state: {
    round: 1,
    order: ["p", "h"],
    activeIndex: 0,
    status: "active",
    combatants: {
      p: {
        id: "p",
        name: "Red",
        side: "friendly",
        isPlayer: true,
        ref: 7,
        body: 6,
        hpMax: 40,
        hp: 40,
        seriouslyWoundedThreshold: 20,
        woundState: "none",
        deathSavePenalty: 0,
        spHead: 7,
        spBody: 9,
        defeated: false,
        initiative: 14,
      },
      h: {
        id: "h",
        name: "Scav Runner",
        side: "hostile",
        isPlayer: false,
        ref: 5,
        body: 5,
        hpMax: 30,
        hp: 30,
        seriouslyWoundedThreshold: 15,
        woundState: "none",
        deathSavePenalty: 0,
        spHead: 7,
        spBody: 7,
        defeated: false,
        initiative: 9,
      },
    },
  },
  data: {
    p: {
      key: "player",
      weaponName: "",
      damageDice: 0,
      rangeType: null,
      position: { x: 0, y: 0 },
      move: 6,
      attackSkill: 0,
    },
    h: {
      key: "scav_1",
      weaponName: "sidearm",
      damageDice: 2,
      rangeType: "pistol",
      // 12 m up the field from the player, which is where the DV now comes from.
      position: { x: 0, y: 12 },
      move: 6,
      attackSkill: 4,
    },
  },
  arena: "open_ground",
  cover: {},
  version: 0,
};

describe("attackPrompt", () => {
  it("resolves the GM's target key to a combatant", () => {
    expect(findTarget(live, "scav_1")?.id).toBe("h");
    expect(findTarget(live, "Scav Runner")?.id).toBe("h");
    expect(findTarget(live, "nobody")).toBeNull();
  });

  it("finds the attack awaiting the player's dice", () => {
    const events = [
      event({ id: "a", type: "gm_narration" }),
      event({
        id: "b",
        type: "attack_prompt",
        data: { targetId: "scav_1", intent: "two to the chest" } as never,
      }),
    ];
    const pending = pendingAttackFrom(events, character, live);
    expect(pending?.target.name).toBe("Scav Runner");
    expect(pending?.distance).toBe(12);
    expect(pending?.attacker.isPlayer).toBe(true);
  });

  it("measures the range instead of believing a number in the event", () => {
    // The whole point of positions. A distance on the prompt is ignored: it is
    // either stale (somebody moved after the GM proposed the shot) or it is the
    // model setting the DV, which is the bug this replaced.
    const events = [
      event({
        id: "b",
        type: "attack_prompt",
        data: { targetId: "scav_1", distance: 400, intent: "a long one" } as never,
      }),
    ];
    expect(pendingAttackFrom(events, character, live)?.distance).toBe(12);
  });

  it("re-measures after somebody has moved", () => {
    const closed = {
      ...live,
      data: { ...live.data, h: { ...live.data["h"]!, position: { x: 0, y: 4 } } },
    };
    const events = [
      event({ id: "b", type: "attack_prompt", data: { targetId: "scav_1" } as never }),
    ];
    expect(pendingAttackFrom(events, character, closed)?.distance).toBe(4);
  });

  it("treats a resolved attack as no longer pending", () => {
    const events = [
      event({ id: "b", type: "attack_prompt", data: { targetId: "scav_1" } as never }),
      event({ id: "c", type: "attack" }),
    ];
    expect(pendingAttackFrom(events, character, live)).toBeNull();
  });

  it("builds the option from the sheet and the printed Range DV table", () => {
    const events = [
      event({ id: "b", type: "attack_prompt", data: { targetId: "scav_1" } as never }),
    ];
    const pending = pendingAttackFrom(events, character, live)!;
    const option = attackOption(pending, weaponProfile("medium_pistol"), character);
    expect(option.statLabel).toBe("REF");
    expect(option.statValue).toBe(7);
    expect(option.skillValue).toBe(5);
    expect(option.damageDice).toBe(2);
    expect(option.dv).toBe(singleShotDV("pistol", 12));
    expect(option.gap).toBeNull();
  });

  it("moves the DV when the target does", () => {
    // Position is not decoration: closing from 12 m to 4 m with a pistol is the
    // difference between DV 15 and DV 13, and nobody had to say so.
    const events = [
      event({ id: "b", type: "attack_prompt", data: { targetId: "scav_1" } as never }),
    ];
    const far = attackOption(
      pendingAttackFrom(events, character, live)!,
      weaponProfile("medium_pistol"),
      character,
    );
    const closed = {
      ...live,
      data: { ...live.data, h: { ...live.data["h"]!, position: { x: 0, y: 4 } } },
    };
    const near = attackOption(
      pendingAttackFrom(events, character, closed)!,
      weaponProfile("medium_pistol"),
      character,
    );
    expect(near.dv!).toBeLessThan(far.dv!);
  });
});

describe("encounterModel", () => {
  // The sheet projected into inventory shape, which is what a campaign that
  // started before the kit was copied across actually reads.
  const fromSheet = () => liveInventory([], character);

  it("reads armor SP from worn gear, preferring ablated current_sp", () => {
    expect(armorSp(fromSheet())).toEqual({ head: 7, body: 9 });
  });

  it("offers only catalog weapons carried on the sheet", () => {
    expect(weaponChoices(fromSheet()).map((w) => w.itemId)).toEqual(["medium_pistol"]);
  });
});

describe("describeAttack", () => {
  it("reports exactly what the engine returned", () => {
    const miss = {
      attack: { hit: false, formula: "d10(2)+REF(7)+Handgun(5)=14 vs DV 15" },
      damage: null,
      applied: null,
      targetWoundState: "none",
      targetDefeated: false,
    } as unknown as PerformAttackResult;
    expect(describeAttack("Red", "Scav Runner", "Medium Pistol", miss)).toContain("MISS");

    const hit = {
      attack: { hit: true, formula: "d10(9)+REF(7)+Handgun(5)=21 vs DV 15" },
      damage: { total: 11 },
      applied: { damageThroughArmor: 4, hpAfter: 26, criticalInjury: false },
      targetWoundState: "none",
      targetDefeated: false,
    } as unknown as PerformAttackResult;
    const line = describeAttack("Red", "Scav Runner", "Medium Pistol", hit);
    expect(line).toContain("HIT");
    expect(line).toContain("4 through armor");
    expect(line).toContain("26 HP");
  });
});
