import { describe, expect, it } from "vitest";
import { judgeAction, type CapabilitySnapshot, type WeaponCapability } from "../index";

const pistol: WeaponCapability = {
  itemId: "heavy_pistol",
  name: "Heavy Pistol",
  melee: false,
  rof: 2,
  magazine: 8,
  roundsLoaded: 8,
  spareRounds: 20,
  rangeType: "pistol",
  damageDice: 3,
  broken: false,
};

const base: CapabilitySnapshot = {
  hp: 30,
  hpMax: 35,
  woundState: "none",
  incapacitated: false,
  eurobucks: 100,
  luck: 3,
  move: 6,
  weapons: [pistol],
  items: [{ itemId: "airhypo", name: "Airhypo", kind: "gear", quantity: 1 }],
  cyberware: [
    { itemId: "cybereye", name: "Cybereye", requires: null, prerequisiteMet: true },
    {
      itemId: "image_enhance",
      name: "Image Enhance",
      requires: "cybereye",
      prerequisiteMet: true,
    },
  ],
  roleAbility: { abilityId: "combat_awareness", abilityName: "Combat Awareness", rank: 4 },
  targets: [
    { key: "scav_1", id: "c1", name: "Scav", distance: 12, defeated: false, perceivable: true },
  ],
  turn: {
    inCombat: true,
    actionUsed: false,
    shotsThisRound: 0,
    shotWeaponId: null,
    metresMoved: 0,
    move: 6,
  },
  failedAttempts: [],
};

const snap = (patch: Partial<CapabilitySnapshot>): CapabilitySnapshot => ({ ...base, ...patch });

describe("judgeAction", () => {
  it("allows a normal shot", () => {
    expect(judgeAction(base, { kind: "attack", targetKey: "scav_1", distance: 12 }).ok).toBe(true);
  });

  it("refuses firing an empty weapon", () => {
    const v = judgeAction(snap({ weapons: [{ ...pistol, roundsLoaded: 0 }] }), {
      kind: "attack",
      targetKey: "scav_1",
      distance: 12,
      weapon: "heavy_pistol",
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("weapon_empty");
  });

  it("refuses a broken weapon", () => {
    const v = judgeAction(snap({ weapons: [{ ...pistol, broken: true }] }), {
      kind: "attack",
      targetKey: "scav_1",
      distance: 12,
      weapon: "heavy_pistol",
    });
    if (!v.ok) expect(v.code).toBe("weapon_broken");
    expect(v.ok).toBe(false);
  });

  it("refuses more attacks than the weapon's ROF", () => {
    const v = judgeAction(
      snap({
        turn: { ...base.turn, shotsThisRound: 2, shotWeaponId: "heavy_pistol", actionUsed: true },
      }),
      { kind: "attack", targetKey: "scav_1", distance: 12, weapon: "heavy_pistol" },
    );
    if (!v.ok) expect(v.code).toBe("rof_exceeded");
    expect(v.ok).toBe(false);
  });

  it("refuses a target beyond the weapon's printed range", () => {
    const v = judgeAction(base, {
      kind: "attack",
      targetKey: "scav_1",
      distance: 2000,
      weapon: "heavy_pistol",
    });
    if (!v.ok) expect(v.code).toBe("out_of_range");
    expect(v.ok).toBe(false);
  });

  it("refuses a melee swing at a target across the room", () => {
    const bat: WeaponCapability = {
      ...pistol,
      itemId: "heavy_melee_weapon",
      name: "Heavy Melee Weapon",
      melee: true,
      magazine: null,
      roundsLoaded: null,
      rangeType: null,
    };
    const v = judgeAction(snap({ weapons: [bat] }), {
      kind: "attack",
      targetKey: "scav_1",
      distance: 12,
      weapon: "heavy_melee_weapon",
    });
    if (!v.ok) expect(v.code).toBe("out_of_reach");
    expect(v.ok).toBe(false);
  });

  it("refuses an Aimed Shot with a melee attack", () => {
    const bat: WeaponCapability = {
      ...pistol,
      itemId: "bat",
      name: "Bat",
      melee: true,
      magazine: null,
      roundsLoaded: null,
      rangeType: null,
    };
    const v = judgeAction(snap({ weapons: [bat] }), {
      kind: "attack",
      targetKey: "scav_1",
      distance: 1,
      weapon: "bat",
      aimed: true,
    });
    if (!v.ok) expect(v.code).toBe("aimed_shot_incompatible");
    expect(v.ok).toBe(false);
  });

  it("refuses a target that cannot be seen or is already down", () => {
    const hidden = judgeAction(snap({ targets: [{ ...base.targets[0]!, perceivable: false }] }), {
      kind: "attack",
      targetKey: "scav_1",
      distance: 12,
    });
    if (!hidden.ok) expect(hidden.code).toBe("target_not_perceived");
    const down = judgeAction(snap({ targets: [{ ...base.targets[0]!, defeated: true }] }), {
      kind: "attack",
      targetKey: "scav_1",
      distance: 12,
    });
    if (!down.ok) expect(down.code).toBe("target_defeated");
    expect(hidden.ok || down.ok).toBe(false);
  });

  it("refuses an item they do not have and one that is used up", () => {
    const missing = judgeAction(base, { kind: "use_item", item: "grenade" });
    if (!missing.ok) expect(missing.code).toBe("item_not_possessed");
    const gone = judgeAction(snap({ items: [{ ...base.items[0]!, quantity: 0 }] }), {
      kind: "use_item",
      item: "airhypo",
    });
    // A zero-quantity line is dropped from the snapshot in practice; either
    // refusal is correct, but it must never be allowed.
    expect(gone.ok).toBe(false);
  });

  it("refuses cyberware that is not installed and chrome missing its foundation", () => {
    const absent = judgeAction(base, { kind: "use_cyberware", cyberware: "sandevistan" });
    if (!absent.ok) expect(absent.code).toBe("cyberware_not_installed");
    const unmet = judgeAction(
      snap({
        cyberware: [
          {
            itemId: "image_enhance",
            name: "Image Enhance",
            requires: "cybereye",
            prerequisiteMet: false,
          },
        ],
      }),
      { kind: "use_cyberware", cyberware: "image_enhance" },
    );
    if (!unmet.ok) expect(unmet.code).toBe("prerequisite_unmet");
    expect(absent.ok || unmet.ok).toBe(false);
  });

  it("refuses another Role's ability and a feature above their Rank", () => {
    const other = judgeAction(base, { kind: "role_ability", abilityId: "maker" });
    if (!other.ok) expect(other.code).toBe("role_ability_absent");
    const tooHigh = judgeAction(base, {
      kind: "role_ability",
      abilityId: "combat_awareness",
      rank: 6,
    });
    if (!tooHigh.ok) expect(tooHigh.code).toBe("rank_too_low");
    expect(other.ok || tooHigh.ok).toBe(false);
  });

  it("refuses moving farther than MOVE, and moving twice in a Round", () => {
    const far = judgeAction(base, { kind: "move", metres: 20 });
    if (!far.ok) expect(far.code).toBe("move_exceeded");
    const twice = judgeAction(snap({ turn: { ...base.turn, metresMoved: 6 } }), {
      kind: "move",
      metres: 4,
    });
    if (!twice.ok) expect(twice.code).toBe("movement_spent");
    expect(far.ok || twice.ok).toBe(false);
  });

  it("refuses netrunning without plugs and a deck, and allows it with both", () => {
    expect(judgeAction(base, { kind: "netrun" }).ok).toBe(false);
    const jacked = snap({
      cyberware: [
        {
          itemId: "interface_plugs",
          name: "Interface Plugs",
          requires: null,
          prerequisiteMet: true,
        },
      ],
      items: [{ itemId: "cyberdeck", name: "Cyberdeck", kind: "gear", quantity: 1 }],
    });
    expect(judgeAction(jacked, { kind: "netrun" }).ok).toBe(true);
  });

  it("refuses spending resources they do not have", () => {
    const luck = judgeAction(base, { kind: "spend", resource: "luck", amount: 9 });
    if (!luck.ok) expect(luck.code).toBe("resource_unavailable");
    const cash = judgeAction(base, { kind: "spend", resource: "eurobucks", amount: 5000 });
    expect(cash.ok).toBe(false);
    expect(luck.ok).toBe(false);
  });

  it("refuses retrying the same failed check unchanged", () => {
    const s = snap({ failedAttempts: [{ skillId: "pick_lock", intent: "force the door" }] });
    const again = judgeAction(s, {
      kind: "skill_check",
      skillId: "pick_lock",
      intent: "Force the door",
    });
    if (!again.ok) expect(again.code).toBe("retry_unchanged");
    expect(again.ok).toBe(false);
    expect(
      judgeAction(s, { kind: "skill_check", skillId: "pick_lock", intent: "cut the hinges" }).ok,
    ).toBe(true);
  });

  it("refuses everything but a Death Save while down", () => {
    const down = snap({ incapacitated: true });
    const v = judgeAction(down, { kind: "attack", targetKey: "scav_1", distance: 12 });
    if (!v.ok) expect(v.code).toBe("physically_incapable");
    expect(v.ok).toBe(false);
  });
});
