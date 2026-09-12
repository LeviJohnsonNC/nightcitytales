/**
 * Hidden truths: what is true about somewhere and not apparent from standing
 * in it.
 *
 * THE PROBLEM THIS EXISTS FOR. A model that is asked to resolve "I search the
 * room" will always find something, because inventing is cheaper than refusing.
 * So a good Perception roll produces a hidden safe that was not there a moment
 * ago, the next roll produces a different one, and nothing the player learns is
 * ever load-bearing — a discovery that could have been anything was not really
 * a discovery. `cast.ts` already refuses to work that way for people: a
 * dossier is released one rung at a time and the model is never shown a rung
 * the player has not earned, because "a model that can see a secret will
 * telegraph it". This is the same argument pointed at places.
 *
 * So the engine holds the truths and the model is told which one was found.
 * A check no longer asks the narrator what is here; it asks the engine which of
 * the facts that are ALREADY TRUE here this roll uncovers.
 *
 * NOT THE SAME THING AS `placeIntel`, and the split matters. That module pays
 * out for FAMILIARITY — what you know because you live in this district or keep
 * coming back to this building — and it is passive and automatic. This pays out
 * for LOOKING: a skill, on this visit, against a published DV. A local knows
 * who claims the ground; only somebody who searched knows there is a second way
 * in.
 *
 * DERIVED, NOT AUTHORED. Every truth hangs off a tag the whole city already
 * carries or a flag the campaign has already set, so all 156 locations answer
 * rather than the few somebody has written up. The templates live in
 * `place-truths.json`, flagged `houseRule: true`; the difficulties are
 * published Difficulty Values by name, resolved through `checkDV`, so no number
 * here was invented.
 *
 * WHAT IS DISCOVERED IS NOT STORED HERE. A truth is a fact about the world; who
 * has found it is a fact about one campaign, so it lives in `campaign_truths`
 * and arrives as a set of keys. The same truth is undiscovered in a second
 * campaign, which a `revealed` flag on the truth itself could never express.
 *
 * Pure TypeScript.
 */
import truthData from "@/data/atlas/place-truths.json";
import { getDV } from "./checkDV";
import { getPlace } from "./geography";
import { tagsOf, type PlaceTag } from "./places";
import type { PlaceState } from "./placeState";

/**
 * What kind of fact this is.
 *
 * Only `physical` is produced today. The rest are declared now because the
 * vocabulary is cheaper to fix once than to widen later — the same reason
 * `placeSignals` declares signal kinds it does not yet emit.
 */
export const TRUTH_KINDS = ["physical", "social", "historical", "motive", "deception"] as const;
export type TruthKind = (typeof TRUTH_KINDS)[number];

export type TruthSubject = { kind: "place" | "person" | "district"; key: string };

export type Truth = {
  /**
   * Stable for the life of a campaign: the subject and what the fact is about.
   * A stored discovery has to still name the same truth next week, so this is
   * never an index or a hash of the prose.
   */
  key: string;
  kind: TruthKind;
  /** What the character now knows, in one line. Safe for the prompt ONCE FOUND. */
  fact: string;
  subject: TruthSubject;
  /** The printed Skill that finds it, and the published DV it is found against. */
  found: { skillId: string; dv: number };
  /**
   * Truth keys that must already be discovered before this one can be.
   *
   * Empty for every truth today, and the field exists anyway: it is the whole
   * mechanism a Deduction skill would run on — a conclusion whose prerequisites
   * are other discoveries — and declaring it now costs a line where retrofitting
   * it would cost a migration.
   */
  needs: string[];
};

type TagTruth = {
  key: string;
  tags: string[];
  skill: string;
  difficulty: string;
  fact: string;
};

type FlagTruth = {
  key: string;
  flag: string;
  skill: string;
  difficulty: string;
  fact: string;
};

type TruthFile = {
  houseRule: boolean;
  note: string;
  fromTags: TagTruth[];
  fromFlags: FlagTruth[];
};

const FILE = truthData as unknown as TruthFile;

/** True when these are what they claim to be: tunable house rules. */
export const PLACE_TRUTHS_ARE_HOUSE_RULE: boolean = FILE.houseRule;

/** `place::what-it-is-about`. Stable across sessions and across prose edits. */
export function truthKey(subject: TruthSubject, id: string): string {
  return `${subject.kind}:${subject.key}::${id}`;
}

function fill(template: string, placeName: string): string {
  return template.replaceAll("{place}", placeName);
}

/**
 * Every hidden truth that exists at one location, discovered or not.
 *
 * The full set, because the caller needs to know what COULD be found in order
 * to say what a roll found. It is the caller's job never to put an undiscovered
 * one in a prompt; `knownTruths` is how that is done.
 */
export function truthsAt(placeKey: string, state?: PlaceState | undefined): Truth[] {
  const place = getPlace(placeKey);
  if (!place) return [];
  const subject: TruthSubject = { kind: "place", key: place.key };
  const tags = tagsOf(place.key);
  const out: Truth[] = [];

  for (const template of FILE.fromTags) {
    if (!template.tags.some((tag) => tags.includes(tag as PlaceTag))) continue;
    out.push({
      key: truthKey(subject, template.key),
      kind: "physical",
      fact: fill(template.fact, place.name),
      subject,
      found: { skillId: template.skill, dv: getDV(template.difficulty) },
      needs: [],
    });
  }

  // Flags are what the campaign has DONE to a place, so these exist only once
  // something has happened. A place nobody has touched carries only its tags.
  for (const template of FILE.fromFlags) {
    if (!state?.flags.includes(template.flag)) continue;
    out.push({
      key: truthKey(subject, template.key),
      kind: "physical",
      fact: fill(template.fact, place.name),
      subject,
      found: { skillId: template.skill, dv: getDV(template.difficulty) },
      needs: [],
    });
  }

  return out;
}

/**
 * The truths this character has actually discovered here.
 *
 * The only ones a prompt may ever contain. Everything else is absent rather
 * than hinted at, which is the whole point.
 */
export function knownTruths(truths: Truth[], discovered: readonly string[]): Truth[] {
  const found = new Set(discovered);
  return truths.filter((truth) => found.has(truth.key));
}

/**
 * Whether this Skill is one that finds anything, anywhere in the city.
 *
 * The guard that keeps a search outcome off a check that was not a search. A
 * successful Athletics roll must not come back with "you satisfy yourself there
 * is nothing here" — the character was climbing a fence.
 *
 * Read off the templates rather than a list kept beside them, so a Skill added
 * to `place-truths.json` starts searching without anybody remembering to come
 * back here.
 */
export function isSearchSkill(skillId: string): boolean {
  return SEARCH_SKILLS.has(skillId);
}

const SEARCH_SKILLS: ReadonlySet<string> = new Set([
  ...FILE.fromTags.map((t) => t.skill),
  ...FILE.fromFlags.map((t) => t.skill),
]);

/** The ones still to be found, in the order the data declares them. */
export function unknownTruths(truths: Truth[], discovered: readonly string[]): Truth[] {
  const found = new Set(discovered);
  return truths.filter((truth) => !found.has(truth.key));
}

/**
 * What a check of this Skill could find here, hardest first.
 *
 * Hardest first so that a good roll is worth more than a bare pass: the engine
 * hands over the most demanding truth the total actually beat, rather than the
 * first one in file order.
 */
export function findableBy(
  truths: Truth[],
  skillId: string,
  discovered: readonly string[],
): Truth[] {
  return unknownTruths(truths, discovered)
    .filter((truth) => truth.found.skillId === skillId)
    .filter((truth) => truth.needs.every((need) => discovered.includes(need)))
    .sort((a, b) => b.found.dv - a.found.dv);
}

export type TruthSearch =
  /** The roll beat this truth's DV and it is now discovered. */
  | { outcome: "found"; truth: Truth }
  /**
   * There was something here and the roll did not reach it. Deliberately says
   * nothing about what, or how close: "you nearly found the safe" is the safe.
   */
  | { outcome: "missed" }
  /**
   * Nothing here for this Skill to find, discovered or not.
   *
   * A real answer and not a failure. In a game about investigation, satisfying
   * yourself that a room is clean is information — and it is the honest thing
   * to say when the alternative is inventing something so the roll was not
   * wasted. It is also why a search can be offered without the offer itself
   * being a hint.
   */
  | { outcome: "nothing" };

/**
 * Resolve a search: which truth, if any, this total uncovers.
 *
 * The engine's answer to "I look around". The roll has already happened
 * elsewhere — this module rolls nothing — and all that is decided here is what
 * the number reaches.
 */
export function searchWith(args: {
  truths: Truth[];
  skillId: string;
  discovered: readonly string[];
  /** The check's final total, as the dice and the sheet produced it. */
  total: number;
}): TruthSearch {
  const candidates = findableBy(args.truths, args.skillId, args.discovered);
  if (!candidates.length) return { outcome: "nothing" };
  const reached = candidates.find((truth) => args.total >= truth.found.dv);
  return reached ? { outcome: "found", truth: reached } : { outcome: "missed" };
}
