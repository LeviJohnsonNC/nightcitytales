/**
 * Resolving a GM-proposed action against the deterministic engine. The GM only
 * ever PROPOSES; this is where a proposed skill check becomes a real, traceable
 * roll. Non-check actions (attacks, beat advances) are passed through for the
 * combat / mission layers to handle.
 */
import {
  skillCheckForCharacter,
  type RNG,
  type SkillCheckActor,
  type SkillCheckResult,
} from "@/engine";
import type { GmProposedAction } from "./gmResponse";

export type ResolvedAction =
  | { kind: "skill_check"; skillId: string; intent: string; result: SkillCheckResult }
  | { kind: "unresolved"; action: GmProposedAction };

/** Resolve a skill-check proposal into an actual roll; pass everything else through. */
export function resolveProposedAction(
  action: GmProposedAction,
  actor: SkillCheckActor,
  rng?: RNG,
): ResolvedAction {
  if (action.kind === "skill_check") {
    const result = skillCheckForCharacter(actor, action.skillId, action.dv, rng);
    return { kind: "skill_check", skillId: action.skillId, intent: action.intent, result };
  }
  return { kind: "unresolved", action };
}
