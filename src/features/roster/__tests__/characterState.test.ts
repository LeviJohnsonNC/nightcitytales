import { describe, expect, it } from "vitest";
import { STEP_IDS } from "@/features/chargen/steps";
import type { FullCharacter } from "@/lib/backend";
import { draftStateFromCharacter, stateFromCharacter } from "../characterState";

/**
 * A saved character, read back into the shape the wizard and the sheet use.
 *
 * This is the "edit as a new draft" path AGENTS.md describes: "Editing a saved
 * character creates a new draft and does not mutate the original." That promise
 * rests entirely on this mapping, and `src/features/roster/` had no tests at
 * all — so nothing said what happens to a Skill's specialization, or to a
 * character saved before the home-address columns existed.
 *
 * It is pure — a row bundle in, a wizard state out — which is why it is worth
 * testing and the rest of the roster (which is React and queries) is not.
 */

function character(over: Partial<FullCharacter> = {}): FullCharacter {
  return {
    character: {
      id: "char-1",
      name: "V",
      handle: "Vee",
      role: "solo",
      creation_method: "complete_package",
      portrait_id: null,
    },
    stats: { int: 6, ref: 8, dex: 7, tech: 4, cool: 7, will: 6, luck: 5, move: 6, body: 7, emp: 5 },
    skills: [
      { skill_id: "handgun", level: 6, specialization: null },
      { skill_id: "local_expert", level: 4, specialization: "little_china" },
    ],
    roleAbility: {
      ability_id: "combat_awareness",
      rank: 4,
      metadata: { name: "Combat Awareness" },
    },
    gear: [],
    cyberware: [],
    lifepath: {
      general: { cultural_origin: "North American" },
      role_specific: { partner: "a fixer" },
    },
    finance: {
      housing: "Rented Cargo Container, Combat Zone",
      home_district_key: "little_china",
      home_place_key: "x12",
    },
    ...over,
  } as unknown as FullCharacter;
}

describe("a saved character becomes wizard state", () => {
  it("carries the identity, Role and method across", () => {
    const state = stateFromCharacter(character());
    expect(state.name).toBe("V");
    expect(state.handle).toBe("Vee");
    expect(state.roleId).toBe("solo");
    expect(state.method).toBe("complete_package");
  });

  it("keeps a Skill's specialization", () => {
    // Local Expert is worth nothing in the wrong neighbourhood, so a
    // specialization dropped here is a Skill that silently changes value when
    // the character is reopened. See engine/localExpert.ts.
    const state = stateFromCharacter(character());
    expect(state.skills).toContainEqual({
      skillId: "local_expert",
      level: 4,
      specialization: "little_china",
    });
    expect(state.skills).toContainEqual({ skillId: "handgun", level: 6, specialization: null });
  });

  it("reads the Role Ability's name from its own row when it has one", () => {
    expect(stateFromCharacter(character()).roleAbility).toEqual({
      id: "combat_awareness",
      rank: 4,
      name: "Combat Awareness",
    });
  });

  it("falls back to roles.json when the saved row carries no name", () => {
    const state = stateFromCharacter(
      character({
        roleAbility: { ability_id: "combat_awareness", rank: 2, metadata: {} },
      } as Partial<FullCharacter>),
    );
    expect(state.roleAbility?.rank).toBe(2);
    expect(state.roleAbility?.name).toBeTruthy();
  });

  it("supplies a Role Ability for a character saved without one", () => {
    const state = stateFromCharacter(character({ roleAbility: null }));
    expect(state.roleAbility).not.toBeNull();
    expect(state.roleAbility?.id).toBeTruthy();
  });

  it("opens every step, so a finished character is not locked out of its own sheet", () => {
    const state = stateFromCharacter(character());
    expect(state.visited).toEqual([...STEP_IDS]);
    expect(state.step).toBe("review");
  });
});

describe("the home address", () => {
  it("reads the district and building from their own columns", () => {
    const { lifestyle } = stateFromCharacter(character());
    expect(lifestyle.districtKey).toBe("little_china");
    expect(lifestyle.placeKey).toBe("x12");
  });

  it("is null for a character saved before those columns existed", () => {
    // The honest answer rather than a guessed one: the housing step asks again.
    // Inventing a district here would hand Local Expert a neighbourhood the
    // player never chose.
    const { lifestyle } = stateFromCharacter(
      character({
        finance: { housing: "Rented Cargo Container, Combat Zone" },
      } as Partial<FullCharacter>),
    );
    expect(lifestyle.districtKey).toBeNull();
    expect(lifestyle.placeKey).toBeNull();
  });

  it("still reads the neighbourhood out of the printed housing line", () => {
    // The district and building have their own columns now; the RED
    // "Overcrowded Suburbs / Combat Zone" choice is still parsed out of the
    // housing string, which is where it has always lived.
    expect(stateFromCharacter(character()).lifestyle.location).toBe("Combat Zone");
  });

  it("survives a character with no finance row at all", () => {
    const { lifestyle } = stateFromCharacter(character({ finance: null }));
    expect(lifestyle.districtKey).toBeNull();
    expect(lifestyle.placeKey).toBeNull();
    expect(lifestyle.location).toBeNull();
  });
});

describe("editing a saved character", () => {
  it("produces a NEW draft rather than a handle on the original", () => {
    // The whole of "editing does not mutate the original" rests on this being
    // null: a draft id here would make the wizard save over the character it
    // was opened from.
    expect(draftStateFromCharacter(character()).draftId).toBeNull();
  });

  it("can be renamed without touching the saved character", () => {
    const saved = character();
    const draft = draftStateFromCharacter(saved, "V (copy)");
    expect(draft.name).toBe("V (copy)");
    expect(saved.character.name).toBe("V");
  });

  it("keeps the original name when none is given", () => {
    expect(draftStateFromCharacter(character()).name).toBe("V");
  });

  it("does not share mutable state with a second read of the same character", () => {
    const saved = character();
    const a = stateFromCharacter(saved);
    const b = stateFromCharacter(saved);
    a.skills.push({ skillId: "brawling", level: 2, specialization: null });
    expect(b.skills).toHaveLength(2);
  });
});

describe("a character with nothing recorded", () => {
  it("reads back without throwing", () => {
    // Rows can be missing: a draft saved mid-creation, or a character from
    // before a table existed. The sheet has to render something either way.
    const bare = character({ stats: null, skills: [], lifepath: null, finance: null });
    const state = stateFromCharacter(bare);
    expect(state.skills).toEqual([]);
    expect(state.lifepath).toEqual({ general: {}, roleSpecific: {} });
  });
});
