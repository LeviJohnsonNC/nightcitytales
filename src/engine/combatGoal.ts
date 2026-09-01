/**
 * What the people shooting at you actually want.
 *
 * Cyberpunk RED: Single Player Mode tells the solo player to establish, before
 * a fight, WHY the opposition is fighting. It is a small instruction with a
 * large consequence: if NCPD want to arrest you, their victory condition is an
 * arrest, not a corpse. If gangers want your car, the fight ends when they have
 * the car. Combat can be over the moment the objective is met.
 *
 * Every encounter in this app until now had exactly one implicit goal — reduce
 * the player to zero and keep shooting — which is both the least interesting
 * option and the one that makes a one-character game terminal. A lone
 * Edgerunner has no Medtech to stabilise them and no Nomad to drag them to the
 * car, so "the enemy fights to the last man over your unconscious body" is not
 * grit, it is a dead campaign.
 *
 * This does not make the character tougher. It makes the opposition specific.
 *
 * PURE, and deliberately thin: a goal answers one question — is there still a
 * reason to shoot this person? What that means in the fiction, and what they
 * take with them when they go, is the narrator's.
 */

export const COMBAT_GOALS = ["kill", "capture", "repel", "rob", "delay", "protect"] as const;
export type CombatGoal = (typeof COMBAT_GOALS)[number];

export const DEFAULT_COMBAT_GOAL: CombatGoal = "kill";

export function isCombatGoal(value: unknown): value is CombatGoal {
  return typeof value === "string" && (COMBAT_GOALS as readonly string[]).includes(value);
}

/** The named goal, falling back rather than throwing on a key from outside. */
export function combatGoalFor(value: unknown): CombatGoal {
  return isCombatGoal(value) ? value : DEFAULT_COMBAT_GOAL;
}

/**
 * Is there still a reason to shoot at someone in this state?
 *
 * The only mechanical question a goal is allowed to answer. A downed target
 * satisfies every objective except killing them: you cannot be repelled by
 * someone who has stopped coming, you cannot be robbed further once you are on
 * the ground, and an arrest is easier unconscious.
 *
 * "Down" here is Mortally Wounded — 0 HP or less — not dead. That is precisely
 * the state RED leaves a character in when the dice go badly, and precisely the
 * moment the difference between "they walked away" and "they finished the job"
 * decides whether there is a campaign tomorrow.
 */
export function goalSatisfiedBy(
  goal: CombatGoal,
  target: { hp: number; defeated: boolean },
): boolean {
  if (goal === "kill") return target.defeated;
  return target.defeated || target.hp <= 0;
}

/** What they came for, in words the narrator can use without re-deciding it. */
export function describeGoal(goal: CombatGoal): string {
  switch (goal) {
    case "kill":
      return "they came to kill";
    case "capture":
      return "they came to take you alive";
    case "repel":
      return "they came to drive you off";
    case "rob":
      return "they came to take something";
    case "delay":
      return "they came to hold you here";
    case "protect":
      return "they came to keep you away from something";
  }
}

/** The line for a combatant whose objective is met and who is walking away. */
export function describeGoalMet(name: string, goal: CombatGoal): string {
  switch (goal) {
    case "capture":
      return `${name} has what they came for: they stop shooting and move in to take you.`;
    case "repel":
      return `${name} has what they came for: you are no longer coming, and they let it end there.`;
    case "rob":
      return `${name} has what they came for: they take it and go.`;
    case "delay":
      return `${name} has what they came for: you are not going anywhere, and neither are they.`;
    case "protect":
      return `${name} has what they came for: you are away from it, and they stand down.`;
    case "kill":
      return `${name} is finished here.`;
  }
}
