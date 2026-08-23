/**
 * Matching a loosely-named skill to a rules skill id. The GM model names skills
 * in prose ("Perception", "conceal/reveal object", "Handgun skill"); the engine
 * only knows the ids printed in src/data/rules/skills.json. This module maps one
 * onto the other WITHOUT inventing a skill: if nothing matches, it returns null
 * and the caller must say so out loud rather than guess.
 */
import { SKILLS } from "./rulesData";

/** Lowercase, strip punctuation and filler words, collapse to single spaces. */
function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[_/\\-]+/g, " ")
    .replace(/[^a-z0-9 +]+/g, " ")
    .replace(/\b(skill|check|test|roll|the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BY_ID = new Map(SKILLS.map((s) => [s.id, s]));
const BY_NORMALIZED = new Map<string, string>();
for (const skill of SKILLS) {
  BY_NORMALIZED.set(normalize(skill.id), skill.id);
  BY_NORMALIZED.set(normalize(skill.name), skill.id);
}

/**
 * Common ways a GM names a skill that are not the printed name. Every target is
 * a real skill id from skills.json — nothing here invents a skill or a value.
 */
const ALIASES: Record<string, string> = {
  notice: "perception",
  spot: "perception",
  awareness: "perception",
  observation: "perception",
  sneak: "stealth",
  hide: "stealth",
  lie: "persuasion",
  charm: "persuasion",
  talk: "persuasion",
  negotiate: "persuasion",
  intimidate: "interrogation",
  haggle: "trading",
  barter: "trading",
  pistol: "handgun",
  sidearm: "handgun",
  gun: "handgun",
  shooting: "handgun",
  rifle: "shoulder_arms",
  shotgun: "shoulder_arms",
  punch: "brawling",
  "unarmed combat": "brawling",
  fight: "brawling",
  knife: "melee_weapon",
  sword: "melee_weapon",
  climb: "athletics",
  jump: "athletics",
  swim: "athletics",
  run: "athletics",
  drive: "drive_land_vehicle",
  driving: "drive_land_vehicle",
  "first aid": "first_aid",
  medicine: "paramedic",
  "street knowledge": "streetwise",
  "local knowledge": "local_expert",
  research: "library_search",
  "electronics security": "electronics_security_tech",
  "lock pick": "pick_lock",
  lockpicking: "pick_lock",
  investigate: "library_search",
};

/**
 * Resolve whatever the GM called a skill into a real skill id, or null when no
 * printed skill matches. Order: exact id, exact name, alias, prefix/substring.
 */
export function resolveSkillId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (BY_ID.has(trimmed)) return trimmed;

  const key = normalize(trimmed);
  if (!key) return null;

  const direct = BY_NORMALIZED.get(key);
  if (direct) return direct;

  const alias = ALIASES[key];
  if (alias && BY_ID.has(alias)) return alias;

  // A containment match, longest printed name first so "melee weapon" beats "melee".
  const candidates = [...SKILLS]
    .map((s) => ({ id: s.id, name: normalize(s.name) }))
    .sort((a, b) => b.name.length - a.name.length);
  for (const candidate of candidates) {
    if (key === candidate.name) return candidate.id;
    if (key.includes(candidate.name) || candidate.name.includes(key)) return candidate.id;
  }
  return null;
}
