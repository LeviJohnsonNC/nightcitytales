/**
 * Procedural job generation.
 *
 * A generated job is a Mission like any other: the same beat graph the runtime
 * already walks, so nothing downstream knows the difference. The only new idea
 * is that it is *derived from its own id* rather than stored — `job-7f3a2b1c`
 * regenerates byte-identical every time, so a campaign can reference one in
 * mission_id (free text) and reload it forever with no migration and no rows.
 *
 * That determinism is the whole contract. Nothing here may read the clock, call
 * Math.random, or depend on anything but the seed and the content pools.
 *
 * The prose comes from src/data/missions/job-content.json, which is original
 * writing for this project — unlike the authored missions, it cites no book,
 * because there is none behind it.
 */
import content from "@/data/missions/job-content.json";
import { seededRng } from "../dice";
import { getDistrict, getPlace } from "../geography";
import { DIFFICULTY_VALUES } from "../checkDV";
import { SKILLS } from "../rulesData";
import { buildForce, forceFor, rollForceSize } from "../threats";
import { stableKey, type Beat, type BeatCheck, type Mission } from "../mission";
import type { RNG } from "../types";

/** Ids of generated jobs start with this, so they are recognisable on sight. */
export const GENERATED_JOB_PREFIX = "job-";

type Slots = Record<string, string>;

type Approach = {
  id: string;
  label: string;
  flag: string;
  brief: string;
  checks: BeatCheck[];
};

type Archetype = {
  id: string;
  title: string;
  objective: string;
  background: string;
  backgroundBrief: string;
  hookBrief: string;
  legworkBrief: string;
  approaches: Approach[];
  complicationBrief: string;
  complicationChecks: BeatCheck[];
  climaxBrief: string;
  resolutionBrief: string;
};

type JobContent = {
  fixers: { name: string; line: string }[];
  patrons: { name: string; org: string; style: string; tell: string }[];
  districts: { key: string; name: string; colour: string }[];
  targets: { name: string; the: string; why: string }[];
  /** `force` names a template in data/rules/threats.json — read, never drawn. */
  opposition: { name: string; flavour: string; force: string }[];
  archetypes: Archetype[];
  rewardBands: { eurobucksPerHead: number; upfront: number }[];
};

const CONTENT = content as unknown as JobContent;

/** Pick one entry deterministically. Throws on an empty pool rather than returning undefined. */
function pick<T>(pool: T[], rng: RNG, what: string): T {
  if (pool.length === 0) throw new Error(`Job content pool "${what}" is empty.`);
  const chosen = pool[Math.floor(rng() * pool.length)];
  if (chosen === undefined) throw new Error(`Job content pool "${what}" produced nothing.`);
  return chosen;
}

/**
 * Fill {slot} placeholders. Throws on a slot the caller did not supply — a
 * template with a typo should fail the test suite, not ship a job describing a
 * mission for "{patron}".
 */
export function fillSlots(template: string, slots: Slots): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = slots[key];
    if (value === undefined) throw new Error(`Job template references unknown slot "{${key}}".`);
    return value;
  });
}

const PUBLISHED_DVS = new Set(DIFFICULTY_VALUES.map((band) => band.dv));
const SKILL_NAMES = new Set(SKILLS.map((skill) => skill.name));

/** Copy a check through, verifying it names a printed Skill and a published DV. */
function checkFrom(check: BeatCheck, where: string): BeatCheck {
  if (!SKILL_NAMES.has(check.skill)) {
    throw new Error(`Job content ${where} names an unprinted Skill "${check.skill}".`);
  }
  if (!PUBLISHED_DVS.has(check.dv)) {
    throw new Error(`Job content ${where} uses DV ${check.dv}, which is not on the printed table.`);
  }
  return { skill: check.skill, dv: check.dv, ...(check.note ? { note: check.note } : {}) };
}

/**
 * Which building in that district the work is actually at.
 *
 * The district was always enough to place a job on the map and never enough to
 * make one land: "a warehouse in Santo Domingo" is a set piece, and "the
 * Greenbox Storage Units" is somewhere the player may already have been. Every
 * location in the atlas is a candidate, so the whole city can host work rather
 * than the few places anybody has written up.
 *
 * Returns null for a district the atlas gives no locations — the Exec Zone has
 * none, and a job there is still a job in the Exec Zone.
 */
function pickPlaceIn(districtKey: string, rng: RNG): string | null {
  const district = getDistrict(districtKey);
  if (!district?.locations.length) return null;
  const index = Math.floor(rng() * district.locations.length);
  return district.locations[Math.min(index, district.locations.length - 1)]?.key ?? null;
}

/** A stable job id for a seed. */
export function jobIdForSeed(seed: number): string {
  return `${GENERATED_JOB_PREFIX}${(seed >>> 0).toString(16).padStart(8, "0")}`;
}

/** True when an id names a generated job rather than an authored mission. */
export function isGeneratedJobId(id: string): boolean {
  return seedFromJobId(id) !== null;
}

/** The seed inside a generated job id, or null if this is not one. */
export function seedFromJobId(id: string): number | null {
  if (!id.startsWith(GENERATED_JOB_PREFIX)) return null;
  const hex = id.slice(GENERATED_JOB_PREFIX.length);
  if (!/^[0-9a-f]{8}$/.test(hex)) return null;
  return parseInt(hex, 16) >>> 0;
}

/**
 * Build the job for a seed. Deterministic: the same seed always yields the same
 * mission, which is what lets a campaign store only the id.
 */
export function generateJob(seed: number): Mission {
  const rng = seededRng(seed >>> 0);

  // Order matters: every draw advances the stream, so re-ordering these lines
  // changes every previously generated job. Append new draws at the end.
  const archetype = pick(CONTENT.archetypes, rng, "archetypes");
  const patron = pick(CONTENT.patrons, rng, "patrons");
  const district = pick(CONTENT.districts, rng, "districts");
  const target = pick(CONTENT.targets, rng, "targets");
  const opposition = pick(CONTENT.opposition, rng, "opposition");
  const fixer = pick(CONTENT.fixers, rng, "fixers");
  const reward = pick(CONTENT.rewardBands, rng, "rewardBands");
  // APPENDED LAST, deliberately. Every draw above consumes from the same
  // stream, so inserting this anywhere earlier would change the title, patron,
  // district and opposition of every job every previously stored id names.
  // Adding to the end only extends the stream: nothing before it moves.
  const forceSize = rollForceSize(rng);
  // APPENDED AFTER forceSize, for the same reason it was appended after
  // everything else: extending the stream leaves every draw above it untouched,
  // so a job id stored before this existed still names the same job — it simply
  // also names the building now.
  const placeKey = pickPlaceIn(district.key, rng);

  const slots: Slots = {
    patron: patron.name,
    org: patron.org,
    tell: patron.tell,
    district: district.name,
    colour: district.colour,
    target: target.name,
    the: target.the,
    why: target.why,
    opposition: opposition.name,
    oppositionFlavour: opposition.flavour,
    fixer: fixer.name,
    fixerLine: fixer.line,
  };
  const fill = (template: string) => fillSlots(template, slots);

  const [first, second] = archetype.approaches;
  if (!first || !second) {
    throw new Error(`Archetype "${archetype.id}" needs two approaches to branch on.`);
  }

  const approachBeat = (approach: Approach): Beat => ({
    id: approach.id,
    type: "dev",
    title: fill(approach.label),
    gmBrief: fill(approach.brief),
    checks: approach.checks.map((c) => checkFrom(c, `${archetype.id}.${approach.id}`)),
    exits: [{ to: "complication", label: "Move on what you found" }],
  });

  const beats: Beat[] = [
    {
      id: "background",
      type: "background",
      title: "The Offer",
      readAloud: fill(archetype.background),
      gmBrief: fill(archetype.backgroundBrief),
      objectives: [fill(archetype.objective)],
      exits: [{ to: "hook", label: "Take the job" }],
    },
    {
      id: "hook",
      type: "hook",
      title: "The Meeting",
      gmBrief: fill(archetype.hookBrief),
      exits: [{ to: "legwork", label: "Start the legwork" }],
    },
    {
      id: "legwork",
      type: "dev",
      title: "Legwork",
      gmBrief: fill(archetype.legworkBrief),
      exits: [
        { to: first.id, label: fill(first.label), sets: [first.flag] },
        { to: second.id, label: fill(second.label), sets: [second.flag] },
      ],
    },
    approachBeat(first),
    approachBeat(second),
    {
      id: "complication",
      type: "cliff",
      title: "It Goes Sideways",
      gmBrief: fill(archetype.complicationBrief),
      checks: archetype.complicationChecks.map((c) => checkFrom(c, `${archetype.id}.complication`)),
      opposition: [`${opposition.name} — ${opposition.flavour}`],
      exits: [{ to: "climax", label: "See it through" }],
    },
    {
      id: "climax",
      type: "climax",
      title: "The Hard Part",
      gmBrief: fill(archetype.climaxBrief),
      opposition: [`${opposition.name} — ${opposition.flavour}`],
      encounter: true,
      exits: [{ to: "resolution", label: "Finish it" }],
    },
    {
      id: "resolution",
      type: "resolution",
      title: "Payday",
      gmBrief: fill(archetype.resolutionBrief),
      exits: [],
    },
  ];

  // WHO is waiting comes from the fiction that was already drawn, and HOW MANY
  // from the seed. Both are settled here, before the offer below is written and
  // long before anybody narrates the room.
  const force = forceFor(opposition.force);
  const members = buildForce(force, forceSize);

  return {
    id: jobIdForSeed(seed),
    title: fill(archetype.title),
    subtitle: `${patron.name} — ${district.name}`,
    source: "Procedurally generated job",
    patron: `${patron.name} (${patron.org}), through ${fixer.name} — ${fixer.line}`,
    // The offer is READ off the same draws the beats are built from, so what is
    // pitched on the phone and what is waiting in the warehouse can never
    // disagree. Nothing here draws from the rng: adding a draw would change
    // every job every previously generated id names.
    offer: {
      brokerName: fixer.name,
      brokerKey: stableKey(fixer.name),
      brokerLine: fixer.line,
      patronName: patron.name,
      patronOrg: patron.org,
      district: district.name,
      districtKey: district.key,
      ...(placeKey ? { placeKey, placeName: getPlace(placeKey)?.name ?? "" } : {}),
      opposition: `${opposition.name} — ${opposition.flavour}`,
      pitch: fill(archetype.background),
      ask: fill(archetype.objective),
    },
    reward: {
      eurobucksPerHead: reward.eurobucksPerHead,
      upfront: reward.upfront,
      notes: `${reward.upfront}eb on the handshake, the rest on delivery.`,
    },
    force: { forceKey: force.key, size: forceSize, members },
    startBeatId: "background",
    beats,
  };
}

/** Regenerate the job an id names. Null when the id is not a generated one. */
export function jobFromId(id: string): Mission | null {
  const seed = seedFromJobId(id);
  return seed === null ? null : generateJob(seed);
}

/**
 * A seed for a job nobody has played yet. This is the one place randomness is
 * allowed in: the seed is drawn once, then everything downstream is derived
 * from it. Callers persist the resulting id.
 */
export function rollJobSeed(rng: RNG = Math.random): number {
  return Math.floor(rng() * 0x100000000) >>> 0;
}
