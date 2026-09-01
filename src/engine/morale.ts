/**
 * Whether the people shooting at you want to keep doing that.
 *
 * Cyberpunk RED: Single Player Mode adds Morale, and it is the printed answer
 * to the hardest problem in a one-character game: the action economy. A lone
 * Edgerunner facing four people takes one Action to their four, and no amount
 * of good play fixes arithmetic. The book's answer is not to make the character
 * tougher — it is to stop pretending the opposition is four hit-point stacks
 * that fight to the last man. They are people. Most people, having watched a
 * friend come apart, leave.
 *
 * So nothing here touches the character. HP, armour, damage, Critical Injuries
 * and Death Saves are exactly what they were. What changes is that a fight can
 * now END without everyone in it dying.
 *
 * PURE. Rolls go through the RNG it is handed, the table comes from
 * data/rules/morale.json, and it neither reads nor writes any state: it is told
 * what the fight looks like and answers whether this one breaks.
 *
 * THE ONE LINE IT WILL NOT CROSS: it decides only that a combatant is out of
 * the fight. The table's own two outcomes — bolts, or gives up — are both "no
 * longer shooting at you", and which of the two happened is fiction. The
 * narrator says whether they ran or knelt, exactly as it says whether a miss
 * went wide or high.
 */
import moraleData from "@/data/rules/morale.json";
import type { EncounterState, Combatant, CombatSide } from "./encounter";
import type { ThreatProfile } from "./threats";
import type { RNG } from "./types";
import { defaultRng, rollDie } from "./dice";

export type Mentality = "fanatical" | "driven" | "trained" | "inexperienced" | "streetrat";

export type MentalityRow = {
  key: Mentality;
  label: string;
  /** A d10 at or under this ends the fight for them (the End Fight column). */
  endFightUpTo: number;
  examples: string;
};

export const MENTALITIES: MentalityRow[] = (
  moraleData.mentalities as unknown as MentalityRow[]
).map((m) => ({ ...m }));

const BY_ROLE = moraleData.byRole as unknown as Record<string, Mentality>;
const STRESS = moraleData.stress as unknown as {
  seriouslyWounded: boolean;
  halfTheSideDown: boolean;
  fromRound: number;
};

/** The row a mentality reads off, falling back to the plainest rather than throwing. */
export function mentalityRow(key: Mentality | string | null | undefined): MentalityRow {
  const found = MENTALITIES.find((m) => m.key === key);
  if (found) return found;
  const fallback = MENTALITIES.find((m) => m.key === "streetrat");
  if (!fallback) throw new Error("morale: the fallback mentality is missing.");
  return fallback;
}

/** How a threat profile's tier fights: our mapping onto the book's archetypes. */
export function mentalityFor(role: ThreatProfile["role"]): Mentality {
  return BY_ROLE[role] ?? "streetrat";
}

/**
 * Why a check is owed right now, or null.
 *
 * The book names three example stress points and leaves the choice to the
 * table; all three are live here. `spent` is the triggers this combatant has
 * already been checked on — "once the opposition reaches their stress point" is
 * a moment, not a standing condition, and re-rolling it every Round would turn
 * a tense beat into a slot machine that eventually empties the room.
 */
export type MoraleTrigger = "seriously_wounded" | "half_the_side_down" | "round";

export function moraleTriggerFor(
  state: EncounterState,
  combatant: Combatant,
  spent: readonly string[] = [],
): MoraleTrigger | null {
  if (combatant.defeated || combatant.isPlayer) return null;
  const owed = (t: MoraleTrigger) => !spent.includes(t);

  // Their own blood first: the most personal reason to stop, and the one the
  // player has just caused.
  if (
    STRESS.seriouslyWounded &&
    owed("seriously_wounded") &&
    (combatant.woundState === "serious" || combatant.woundState === "mortal")
  ) {
    return "seriously_wounded";
  }

  // Then the room: more than half of their own side down.
  if (STRESS.halfTheSideDown && owed("half_the_side_down")) {
    const side: CombatSide = combatant.side;
    const theirs = Object.values(state.combatants).filter((c) => c.side === side);
    const down = theirs.filter((c) => c.defeated).length;
    if (theirs.length > 0 && down * 2 > theirs.length) return "half_the_side_down";
  }

  // Then the clock. A firefight that has gone on this long has stopped being
  // worth whatever they were being paid for it.
  if (STRESS.fromRound > 0 && owed("round") && state.round >= STRESS.fromRound) {
    return "round";
  }

  return null;
}

export type MoraleCheck = {
  trigger: MoraleTrigger;
  mentality: Mentality;
  label: string;
  /** The d10, as thrown. */
  roll: number;
  /** At or under this, they are done (the table's End Fight column). */
  endFightUpTo: number;
  /** True when they are out of the fight — bolted or surrendered. */
  broke: boolean;
};

/**
 * Roll it. A d10 at or under the End Fight column and they are done.
 *
 * An ordinary Mook is an "Unsure streetrat": they end the fight on 1-9 and keep
 * going only on a 10. That is not a bug in the table, it is the whole point of
 * it — cannon fodder does not want to die, and a game where it fights to the
 * last man is a game that had to invent a reason for the hero to survive.
 */
export function rollMorale(
  mentality: Mentality,
  trigger: MoraleTrigger,
  rng: RNG = defaultRng,
): MoraleCheck {
  const row = mentalityRow(mentality);
  const roll = rollDie(10, rng);
  return {
    trigger,
    mentality: row.key,
    label: row.label,
    roll,
    endFightUpTo: row.endFightUpTo,
    broke: roll <= row.endFightUpTo,
  };
}

/** What set them off, in words a narrator can use without re-deciding it. */
export function describeTrigger(trigger: MoraleTrigger): string {
  return trigger === "seriously_wounded"
    ? "badly hurt"
    : trigger === "half_the_side_down"
      ? "watching more than half their side go down"
      : "still in it after the fight dragged on";
}

/** The whole check as one flat line for the ledger and the GM. */
export function describeMorale(name: string, check: MoraleCheck): string {
  return (
    `${name} Morale (${describeTrigger(check.trigger)}, ${check.label}): ` +
    `d10 ${check.roll} vs ${check.endFightUpTo} — ` +
    (check.broke ? "they are out of the fight." : "they keep fighting.")
  );
}
