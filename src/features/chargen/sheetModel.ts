/**
 * Maps the wizard store onto the engine's plain CharacterBuild. No arithmetic
 * happens here — the engine does all of it.
 */
import { assembleCharacter, type AssembledCharacter, type CharacterBuild } from "@/engine";
import { readLifestyle } from "@/engine";
import type { ChargenState } from "./store";

export function buildFromState(state: ChargenState): CharacterBuild {
  return {
    method: state.method,
    roleId: state.roleId,
    roleAbility: state.roleAbility,
    name: state.name,
    handle: state.handle,
    pronouns: state.pronouns,
    selfDescription: state.selfDescription,
    portraitId: state.portrait,
    stats: state.stats,
    skills: state.skills,
    loadout: state.loadout,
    lifestyleLocation: readLifestyle(state.lifestyle).location,
  };
}

export function assembledFromState(state: ChargenState): AssembledCharacter {
  return assembleCharacter(buildFromState(state));
}
