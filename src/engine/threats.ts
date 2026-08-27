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

export const FORCE_SIZES = ["small", "standard", "heavy"] as const;
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
}

/** A one-line reading of what is waiting, for the GM to be told as fact. */
export function describeForce(members: ThreatMember[]): string {
  if (members.length === 0) return "nobody";
  const counts = new Map<string, number>();
  for (const m of members) counts.set(m.profile.name, (counts.get(m.profile.name) ?? 0) + 1);
  return [...counts.entries()].map(([name, n]) => (n > 1 ? `${n}× ${name}` : name)).join(", ");
}
