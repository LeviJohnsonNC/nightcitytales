import { describe, expect, it, vi } from "vitest";

// savePayload is pure, but saveCharacter.ts imports the backend (which pulls in
// the Supabase client). Mock it so this test needs no network or env, and never
// evaluates that module chain.
vi.mock("@/lib/backend", () => ({ saveCompleteCharacter: vi.fn() }));

import { addPurchase, assembleCharacter, EMPTY_LOADOUT, type CharacterBuild } from "@/engine";
import { savePayload } from "@/features/chargen/saveCharacter";
import type { ChargenState } from "@/features/chargen/store";

const STATS = {
  int: 6,
  ref: 6,
  dex: 6,
  tech: 6,
  cool: 6,
  will: 6,
  luck: 6,
  move: 6,
  body: 6,
  emp: 5,
};

function makeBuild(overrides: Partial<CharacterBuild> = {}): CharacterBuild {
  return {
    method: "complete_package",
    roleId: "solo",
    roleAbility: null,
    name: "Nyx",
    handle: "Ghost",
    pronouns: "",
    selfDescription: "",
    portraitId: null,
    stats: STATS,
    skills: [{ skillId: "athletics", level: 4, specialization: null }],
    loadout: EMPTY_LOADOUT,
    lifestyleLocation: null,
    ...overrides,
  };
}

function makeState(overrides: Partial<ChargenState> = {}): ChargenState {
  return {
    draftId: "draft-1",
    name: "  Nyx  ",
    handle: "  Ghost  ",
    skills: [{ skillId: "athletics", level: 4, specialization: null }],
    lifepath: { general: {}, roleSpecific: {} },
    background: "  A merc who owes the wrong people.  ",
    ...overrides,
  } as unknown as ChargenState;
}

describe("savePayload", () => {
  it("trims identity fields and carries role and method through", () => {
    const build = makeBuild();
    const payload = savePayload(makeState(), build, assembleCharacter(build));

    expect(payload.character.name).toBe("Nyx");
    expect(payload.character.handle).toBe("Ghost");
    expect(payload.character.role).toBe("solo");
    expect(payload.character.creation_method).toBe("complete_package");
    expect(payload.draft_id).toBe("draft-1");
  });

  it("starts current HP at the derived maximum", () => {
    const build = makeBuild();
    const payload = savePayload(makeState(), build, assembleCharacter(build));
    expect(payload.stats["hp_current"]).toBe(payload.stats["hp_max"]);
  });

  it("maps skills and the narrative background straight from state", () => {
    const build = makeBuild();
    const payload = savePayload(makeState(), build, assembleCharacter(build));

    expect(payload.skills).toEqual([{ skill_id: "athletics", level: 4, specialization: null }]);
    expect(payload.lifepath.narrative).toBe("A merc who owes the wrong people.");
  });

  it("records a purchased item's flavor variant as its note", () => {
    const loadout = addPurchase("complete_package", EMPTY_LOADOUT, {
      kind: "weapon",
      itemId: "light_melee",
      budget: "gear",
      variant: "Combat Knife",
    });
    const build = makeBuild({ loadout });
    const payload = savePayload(makeState(), build, assembleCharacter(build));

    const line = payload.gear.find((g) => g.item_id === "light_melee");
    expect(line).toBeDefined();
    expect(line!.notes).toBe("Combat Knife");
  });

  it("keeps cyberware out of the gear list", () => {
    const build = makeBuild();
    const payload = savePayload(makeState(), build, assembleCharacter(build));
    expect(Array.isArray(payload.gear)).toBe(true);
    expect(Array.isArray(payload.cyberware)).toBe(true);
    for (const line of payload.gear) {
      expect(line.slot).not.toContain("cyberware");
    }
  });
});
