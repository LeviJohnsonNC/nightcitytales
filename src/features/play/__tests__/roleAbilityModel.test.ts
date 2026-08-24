/**
 * A campaign's Role Ability as the play loop reads it. What matters: the Rank
 * comes off the sheet, a Solo's division survives in campaign state, and the
 * modifiers a Role contributes appear on the checks the fiction says they
 * should — and on no others.
 */
import { describe, expect, it } from "vitest";
import type { Campaign, FullCharacter } from "@/lib/backend";
import {
  combatAwarenessAllocation,
  combatAwarenessFor,
  liveRoleAbility,
  execTeam,
  makerSpecialtyBudget,
  medicineDoses,
  medicineSkills,
  pendingBackup,
  roleCheckModifiers,
  withAbilityState,
} from "../roleAbilityModel";

const character = (role: string, rank?: number): FullCharacter =>
  ({
    character: { name: "Vincent Kang", role },
    stats: { cool: 6 },
    skills: [],
    roleAbility: rank === undefined ? null : { rank },
  }) as unknown as FullCharacter;

const campaign = (roleState: unknown = {}): Campaign =>
  ({ id: "c1", role_state: roleState }) as Campaign;

describe("liveRoleAbility", () => {
  it("reads the ability and the Rank on the sheet", () => {
    expect(liveRoleAbility(character("solo", 7))).toMatchObject({
      rank: 7,
      info: { abilityId: "combat_awareness" },
    });
  });

  it("falls back to the Role's starting Rank when the sheet has none", () => {
    expect(liveRoleAbility(character("solo"))?.rank).toBe(4);
  });

  it("is null for a Role the rules data does not know", () => {
    expect(liveRoleAbility(character("gunslinger", 4))).toBeNull();
  });
});

describe("a Solo's division", () => {
  const solo = character("solo", 6);

  it("reads back what was stored", () => {
    const stored = campaign({ combat_awareness: { allocation: { precision_attack: 3 } } });
    expect(combatAwarenessAllocation(stored)).toEqual({ precision_attack: 3 });
  });

  it("is empty for a campaign that has never set one", () => {
    expect(combatAwarenessAllocation(campaign())).toEqual({});
  });

  it("ignores junk rather than trusting it as points", () => {
    const junk = campaign({
      combat_awareness: { allocation: { precision_attack: "lots", spot_weakness: -2 } },
    });
    expect(combatAwarenessAllocation(junk)).toEqual({});
  });

  it("resolves into the effects the engine applies", () => {
    const stored = campaign({
      combat_awareness: { allocation: { precision_attack: 3, threat_detection: 2 } },
    });
    expect(combatAwarenessFor(stored, solo)).toMatchObject({ attack: 1, perception: 2, rank: 6 });
  });

  it("is null for anyone who is not a Solo", () => {
    expect(combatAwarenessFor(campaign(), character("fixer", 4))).toBeNull();
  });

  it("writes one ability's state without disturbing another's", () => {
    const existing = campaign({ operator: { deals: 2 } });
    const next = withAbilityState(existing, "combat_awareness", {
      allocation: { spot_weakness: 1 },
    });
    expect(next).toEqual({
      operator: { deals: 2 },
      combat_awareness: { allocation: { spot_weakness: 1 } },
    });
  });
});

describe("what a Role brings to a check", () => {
  it("gives a Solo their Threat Detection on Perception", () => {
    const stored = campaign({ combat_awareness: { allocation: { threat_detection: 2 } } });
    expect(
      roleCheckModifiers({
        campaign: stored,
        character: character("solo", 6),
        skillId: "perception",
      }),
    ).toEqual([{ label: "Threat Detection", value: 2 }]);
  });

  it("gives them nothing on a check Threat Detection has no claim on", () => {
    const stored = campaign({ combat_awareness: { allocation: { threat_detection: 2 } } });
    expect(
      roleCheckModifiers({
        campaign: stored,
        character: character("solo", 6),
        skillId: "persuasion",
      }),
    ).toEqual([]);
  });

  it("puts a Fixer's Operator Rank on a Trading deal", () => {
    expect(
      roleCheckModifiers({
        campaign: campaign(),
        character: character("fixer", 5),
        skillId: "trading",
      }),
    ).toEqual([{ label: "Operator", value: 5 }]);
  });

  it("gives a Fixer nothing on someone else's kind of check", () => {
    expect(
      roleCheckModifiers({
        campaign: campaign(),
        character: character("fixer", 5),
        skillId: "perception",
      }),
    ).toEqual([]);
  });

  it("puts a Nomad's Moto Rank on anything they drive", () => {
    expect(
      roleCheckModifiers({
        campaign: campaign(),
        character: character("nomad", 4),
        skillId: "drive_land_vehicle",
      }),
    ).toEqual([{ label: "Moto", value: 4 }]);
  });

  it("gives a Medtech the Skill their Specialty points bought", () => {
    const stored = campaign({ medicine: { specialties: { surgery: 3 } } });
    expect(
      roleCheckModifiers({
        campaign: stored,
        character: character("medtech", 4),
        skillId: "surgery",
      }),
    ).toEqual([{ label: "Medicine", value: 6 }]);
  });

  it("says nothing at all for a Role that is not modelled yet", () => {
    // The Netrunner needs the NET, which this app does not have.
    expect(
      roleCheckModifiers({
        campaign: campaign(),
        character: character("netrunner", 4),
        skillId: "interface",
      }),
    ).toEqual([]);
  });
});

describe("Tech — Maker specialties", () => {
  const tech = character("tech", 4);

  it("gives two Specialty ranks per Rank of Maker", () => {
    expect(makerSpecialtyBudget(campaign(), tech)).toEqual({ pool: 8, spent: 0 });
  });

  it("counts what has been spent", () => {
    const stored = campaign({
      maker: { specialties: { field_expertise: 3, upgrade_expertise: 2 } },
    });
    expect(makerSpecialtyBudget(stored, tech)?.spent).toBe(5);
  });

  it("is null for anyone who is not a Tech", () => {
    expect(makerSpecialtyBudget(campaign(), character("solo", 4))).toBeNull();
  });

  it("puts Field Expertise on a Tech Skill and nowhere else", () => {
    const stored = campaign({ maker: { specialties: { field_expertise: 3 } } });
    expect(
      roleCheckModifiers({ campaign: stored, character: tech, skillId: "basic_tech" }),
    ).toEqual([{ label: "Field Expertise", value: 3 }]);
    expect(
      roleCheckModifiers({ campaign: stored, character: tech, skillId: "persuasion" }),
    ).toEqual([]);
  });

  it("adds nothing when the ranks went to a Specialty that is not Field Expertise", () => {
    const stored = campaign({ maker: { specialties: { fabrication_expertise: 4 } } });
    expect(
      roleCheckModifiers({ campaign: stored, character: tech, skillId: "basic_tech" }),
    ).toEqual([]);
  });
});

describe("Lawman — Backup on its way", () => {
  it("reads a call that landed", () => {
    const stored = campaign({
      backup: { pending: { tierName: "Local Beat Cops", arrivesOnRound: 5, groups: 1 } },
    });
    expect(pendingBackup(stored)).toEqual({
      tierName: "Local Beat Cops",
      arrivesOnRound: 5,
      groups: 1,
    });
  });

  it("is null when nothing is inbound, or the record is junk", () => {
    expect(pendingBackup(campaign())).toBeNull();
    expect(pendingBackup(campaign({ backup: { pending: { tierName: 12 } } }))).toBeNull();
  });
});

describe("Exec — the team", () => {
  it("reads the roster and the slots the Rank supports", () => {
    const stored = campaign({
      teamwork: {
        members: [{ id: "m1", name: "Ito", memberClass: "Bodyguard", statRoll: 4, loyalty: 5 }],
      },
    });
    expect(execTeam(stored, character("exec", 5))).toEqual({
      members: [{ id: "m1", name: "Ito", memberClass: "Bodyguard", statRoll: 4, loyalty: 5 }],
      slots: 2,
    });
  });

  it("has no team below the Rank that grants one", () => {
    expect(execTeam(campaign(), character("exec", 2))).toEqual({ members: [], slots: 0 });
  });

  it("drops a roster entry missing a name or an id", () => {
    const junk = campaign({ teamwork: { members: [{ id: "m1" }, "Ito", null] } });
    expect(execTeam(junk, character("exec", 5))?.members).toEqual([]);
  });

  it("is null for anyone who is not an Exec", () => {
    expect(execTeam(campaign(), character("solo", 4))).toBeNull();
  });
});

describe("Medtech — doses and Skills", () => {
  it("turns Specialty points into Skill Levels", () => {
    const stored = campaign({ medicine: { specialties: { pharmaceuticals: 3, cryosystem: 2 } } });
    expect(medicineSkills(stored)["medical_tech"]).toBe(5);
  });

  it("reads synthesized doses back, ignoring junk", () => {
    const stored = campaign({ medicine: { doses: { speedheal: 3, stim: "lots" } } });
    expect(medicineDoses(stored)).toEqual({ speedheal: 3 });
  });
});
