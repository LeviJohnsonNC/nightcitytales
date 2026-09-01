/**
 * Who is shooting at you, and how tough they are.
 *
 * This is the other half of the authorship leak that engine/battlefield.ts
 * closed. That one took away the RANGE every shot is fired at; this one takes
 * away the PEOPLE. The GM prompt used to say, in as many words: "Mooks are
 * ordinary people: REF 5-7, BODY 5-6, HP 25-35, SP 7-11, attackSkill 2-6,
 * damageDice 2-4." So the narrator picked how hard every fight was, inside a
 * range nobody could see, in the moment, already knowing how the scene was
 * going.
 *
 * The numbers now live in data/rules/threats.json. The model may name WHO — a
 * profile key from a closed list, the same shape as the observation vocabulary
 * and the arena list — and nothing else. A profile it invents falls back to the
 * plainest mook rather than becoming a real one.
 */
import threatsData from "@/data/rules/threats.json";
import type { WeaponRangeType } from "./combatTables";
import type { RNG } from "./types";

/** What a hostile is: everything the encounter engine needs, and no more. */
export type ThreatProfile = {
  key: string;
  name: string;
  /** How they read in a fight: fodder, the one giving orders, or the problem. */
  role: "mook" | "lieutenant" | "boss";
  ref: number;
  body: number;
  hp: number;
  sp: number;
  /** Level in the skill their weapon uses. ref + attackSkill is their Combat Number. */
  attackSkill: number;
  /** MOVE, in metres per Move Action. */
  move: number;
  weaponName: string;
  rangeType: WeaponRangeType;
  damageDice: number;
  note: string;
};

export const THREAT_PROFILES: ThreatProfile[] = (
  threatsData.profiles as unknown as ThreatProfile[]
).map((p) => ({ ...p }));

/** The plainest thing that can shoot at you, and the fallback for a bad key. */
export const DEFAULT_THREAT_KEY = "street_thug";

export const THREAT_KEYS: string[] = THREAT_PROFILES.map((p) => p.key);

export function isThreatKey(value: unknown): value is string {
  return typeof value === "string" && THREAT_KEYS.includes(value);
}

/**
 * The named profile, falling back rather than throwing.
 *
 * A model that invents "cyber_dragon" gets a street thug: the fight still
 * happens, at numbers the engine chose, and nothing invented reaches the dice.
 */
export function threatFor(key: string | null | undefined): ThreatProfile {
  const found = THREAT_PROFILES.find((p) => p.key === key);
  if (found) return found;
  const fallback = THREAT_PROFILES.find((p) => p.key === DEFAULT_THREAT_KEY);
  if (!fallback) throw new Error("threats: the default profile is missing.");
  return fallback;
}

/** ref + attackSkill: what the printed Backup ladder calls a Combat Number. */
export function combatNumber(profile: ThreatProfile): number {
  return profile.ref + profile.attackSkill;
}

// ---------------------------------------------------------------------------
// Forces — who turns up together.
// ---------------------------------------------------------------------------

/**
 * How many turn up.
 *
 * Budgeted for ONE Edgerunner, which is who plays this game — see the
 * forceBudget note in threats.json. "overwhelming" is deliberately outside the
 * fair range: it is what the old "heavy" used to be, kept because Night City is
 * allowed to put six people in front of one, and named so that nothing in the
 * app mistakes it for an encounter to be won by standing still and shooting.
 */
export const FORCE_SIZES = ["small", "standard", "heavy", "overwhelming"] as const;
export type ForceSize = (typeof FORCE_SIZES)[number];

type ForceEntry = { profile: string; count: number };

export type ForceTemplate = {
  key: string;
  label: string;
  sizes: Record<ForceSize, ForceEntry[]>;
};

export const FORCES: ForceTemplate[] = (threatsData.forces as unknown as ForceTemplate[]).map(
  (f) => ({ ...f }),
);

export const DEFAULT_FORCE_KEY = "street_crew";

export function forceFor(key: string | null | undefined): ForceTemplate {
  const found = FORCES.find((f) => f.key === key);
  if (found) return found;
  const fallback = FORCES.find((f) => f.key === DEFAULT_FORCE_KEY);
  if (!fallback) throw new Error("threats: the default force is missing.");
  return fallback;
}

/** One hostile, named and stat-blocked, ready to be placed on a battlefield. */
export type ThreatMember = {
  /** Stable within a force: "ganger_2". The GM reuses it to name a target. */
  key: string;
  name: string;
  profile: ThreatProfile;
};

/**
 * Everyone waiting, expanded from a force template.
 *
 * Numbered per profile rather than across the whole force, so a player hearing
 * "Ganger 2" is hearing the second ganger and not the second body.
 */
export function buildForce(force: ForceTemplate, size: ForceSize): ThreatMember[] {
  const out: ThreatMember[] = [];
  for (const entry of force.sizes[size] ?? []) {
    const profile = threatFor(entry.profile);
    const count = Math.max(0, Math.trunc(entry.count));
    for (let i = 1; i <= count; i += 1) {
      // A lone one of something is just "Enforcer", not "Enforcer 1".
      const suffix = count > 1 ? ` ${i}` : "";
      out.push({
        key: `${profile.key}_${i}`,
        name: `${profile.name}${suffix}`,
        profile,
      });
    }
  }
  return out;
}

/**
 * How big the force is, drawn from the job's own seed.
 *
 * Weighted toward standard: a run of jobs that are all either trivial or a
 * bloodbath reads as noise rather than as a city with different nights in it.
 */
export function rollForceSize(rng: RNG): ForceSize {
  const roll = rng();
  if (roll < 0.25) return "small";
  if (roll < 0.8) return "standard";
  return "heavy";
  // Never "overwhelming". A generated job may be hard; it may not be a fight
  // the character was never meant to take standing up, chosen by a die they
  // could not see. That set exists to be placed deliberately.
}

/** A one-line reading of what is waiting, for the GM to be told as fact. */
export function describeForce(members: ThreatMember[]): string {
  if (members.length === 0) return "nobody";
  const counts = new Map<string, number>();
  for (const m of members) counts.set(m.profile.name, (counts.get(m.profile.name) ?? 0) + 1);
  return [...counts.entries()].map(([name, n]) => (n > 1 ? `${n}× ${name}` : name)).join(", ");
}

// ---------------------------------------------------------------------------
// What a force costs, against what one Edgerunner can take.
// ---------------------------------------------------------------------------

type Budget = {
  mookEquivalents: Record<ThreatProfile["role"], number>;
  perEdgerunner: number;
  dangerousAt: number;
};

const BUDGET = threatsData.budget as unknown as Budget;

/** Fair, dangerous, or not really a fight at all. */
export type ForceVerdict = "fair" | "dangerous" | "situation";

export type ForceWeight = {
  mooks: number;
  lieutenants: number;
  bosses: number;
  /** The force's cost in Mook-equivalents. */
  load: number;
  /** What that cost buys, for this many Edgerunners. */
  verdict: ForceVerdict;
};

/**
 * Weigh a force against the printed encounter guidance.
 *
 * This never refuses anything, and nothing downstream may use it to. Cyberpunk
 * is entitled to put four Tyger Claws around the corner from one person; what
 * it is NOT entitled to do is present that as a fair fight and let the player
 * find out over four Rounds. The verdict exists so the game can say which of
 * the three it is — out loud, before the shooting, where a decision can still
 * be made about it.
 *
 * The ratios are the book's (roughly a Mook each, a Lieutenant per two, a
 * Mini-Boss per three); expressing them as one number is ours, so a mixed force
 * can be weighed at all.
 */
export function weighForce(members: ThreatMember[], edgerunners = 1): ForceWeight {
  let mooks = 0;
  let lieutenants = 0;
  let bosses = 0;
  let load = 0;
  for (const m of members) {
    const role = m.profile.role;
    if (role === "mook") mooks += 1;
    else if (role === "lieutenant") lieutenants += 1;
    else bosses += 1;
    load += BUDGET.mookEquivalents[role] ?? 1;
  }
  // A party of nobody is not a scale; treat it as the solo case rather than
  // dividing the city's opposition by zero.
  const heads = Math.max(1, edgerunners);
  const verdict: ForceVerdict =
    load <= BUDGET.perEdgerunner * heads
      ? "fair"
      : load <= BUDGET.dangerousAt * heads
        ? "dangerous"
        : "situation";
  return { mooks, lieutenants, bosses, load, verdict };
}

/** The verdict in the words the player should hear it in. */
export function describeVerdict(verdict: ForceVerdict): string {
  return verdict === "fair"
    ? "a real fight, and a winnable one"
    : verdict === "dangerous"
      ? "dangerous — this is more than one person's share"
      : "not a fight to take standing up; find another way";
}
