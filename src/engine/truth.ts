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

export type TruthSubject = {
  /**
   * `beat` is a scene in a job rather than a spot on the map: the concealed
   * half of what a mission beat is about. Its truths are authored or templated
   * with the beat instead of derived from tags, because a job's twist is not a
   * property of the ground it happens on.
   */
  kind: "place" | "person" | "district" | "beat";
  key: string;
};

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

/**
 * Whether this Skill finds anything in THIS pool.
 *
 * `isSearchSkill` reads the city-wide templates, which are all Perception — so
 * on its own it turned away every other Skill a beat declares, and a mission
 * truth written for Human Perception or Conversation could never be rolled for.
 * A beat brings its own Skills with it, so the pool has to be asked as well as
 * the templates.
 *
 * Asked of the whole pool rather than the undiscovered part of it: a Skill that
 * has already found the one thing it could find here still searched, and the
 * caller wants "there is nothing left" rather than "that was not a search".
 */
export function searchesFor(skillId: string, truths: readonly Truth[]): boolean {
  return isSearchSkill(skillId) || truths.some((truth) => truth.found.skillId === skillId);
}

const SEARCH_SKILLS: ReadonlySet<string> = new Set([
  ...FILE.fromTags.map((t) => t.skill),
  ...FILE.fromFlags.map((t) => t.skill),
]);

/** The ones still to be found, in the order the data declares them. */
export function unknownTruths(truths: Truth[], discovered: readonly string[]): Truth[] {
  const found = new Set(discovered ?? []);
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
  // Tolerant of a missing list rather than throwing on one. These run inside
  // prompt assembly, where an exception costs the player their turn, and a
  // campaign with no record of discoveries has simply discovered nothing.
  const found = discovered ?? [];
  return unknownTruths(truths, found)
    .filter((truth) => truth.found.skillId === skillId)
    .filter((truth) => (truth.needs ?? []).every((need) => found.includes(need)))
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

// ---------------------------------------------------------------------------
// The concealed half of a mission beat.
// ---------------------------------------------------------------------------

/**
 * A fact a beat is holding back, as the mission content declares it.
 *
 * Missions carry their secrets in `gmBrief`, which goes to the model every turn
 * of that beat. So on beat one of Night at the Opera the narrator was told the
 * whole solution — that the Edgerunner is a pawn in The Master's scheme — and
 * asked to spend four beats of investigation not letting on. `JobCard.tsx` is
 * careful never to render a gmBrief to the player; the prompt had no such care.
 *
 * These are what comes out of those briefs: the facts the player has no way of
 * knowing yet, each with the Skill and published difficulty that would find it,
 * and optionally the beat that reveals it whatever anybody rolled.
 */
export type BeatTruth = {
  /** Unique within the beat. Combined with the beat to make the truth's key. */
  id: string;
  fact: string;
  /** The printed Skill that finds it. */
  skill: string;
  /** A published Difficulty Value BY NAME, resolved through checkDV. */
  difficulty: string;
  /**
   * The beat that makes this plain regardless of any check.
   *
   * Without this a twist could simply never land: the complication beat's whole
   * job is to reveal that the floor plan was wrong, and a story that reaches it
   * should not depend on somebody having rolled well earlier. A truth with no
   * `revealedAt` is only ever found by looking.
   */
  revealedAt?: string;
  kind?: TruthKind;
  /**
   * Other truths in this mission that must already be found before this one
   * can be worked out. An entry is `id` for a truth in the same beat, or
   * `beatId:id` for one in another beat.
   *
   * This is what Deduction runs on. A conclusion is not a thing lying in a
   * drawer: it is what the pieces add up to, so it is unreachable — not merely
   * hard — until the pieces are in hand. A conclusion that also carries
   * `revealedAt` is still handed over when the story reaches that beat: the
   * prerequisites gate working it out EARLY, and never gate the plot.
   */
  needs?: string[];
};

/** The Skill that works a conclusion out of what is already known. */
export const DEDUCTION_SKILL = "deduction";

/**
 * Resolve one `needs` entry to the truth key it names.
 *
 * `id` means a truth in the same beat; `beatId:id` one in another beat of the
 * same mission. Nothing crosses missions: a conclusion is about this job.
 */
export function beatNeedKey(args: { missionId: string; beatId: string; need: string }): string {
  const colon = args.need.indexOf(":");
  const beatId = colon === -1 ? args.beatId : args.need.slice(0, colon);
  const id = colon === -1 ? args.need : args.need.slice(colon + 1);
  return truthKey({ kind: "beat", key: `${args.missionId}:${beatId}` }, id);
}

/** The truths one beat is holding, as engine truths with stable keys. */
export function truthsInBeat(args: {
  missionId: string;
  beatId: string;
  truths: readonly BeatTruth[] | undefined;
}): Truth[] {
  if (!args.truths?.length) return [];
  const subject: TruthSubject = { kind: "beat", key: `${args.missionId}:${args.beatId}` };
  return args.truths.map((truth) => ({
    key: truthKey(subject, truth.id),
    kind: truth.kind ?? "historical",
    fact: truth.fact,
    subject,
    found: { skillId: truth.skill, dv: getDV(truth.difficulty) },
    needs: (truth.needs ?? []).map((need) =>
      beatNeedKey({ missionId: args.missionId, beatId: args.beatId, need }),
    ),
  }));
}

/**
 * Every truth the whole job is holding, across all its beats.
 *
 * Deduction is the one Skill whose pool is not the room. Searching a desk finds
 * what is in the desk; working something out happens wherever the character is
 * standing when it clicks, off everything they have gathered. So a conclusion
 * declared in the office beat can be reached from the warehouse, and the beats
 * are taken as a structural list rather than a Mission import — the engine's
 * truth module has no business knowing what else a mission carries.
 */
export function truthsInMission(args: {
  missionId: string;
  beats: readonly { id: string; truths?: readonly BeatTruth[] | undefined }[];
}): Truth[] {
  return args.beats.flatMap((beat) =>
    truthsInBeat({ missionId: args.missionId, beatId: beat.id, truths: beat.truths }),
  );
}

/**
 * The conclusions this character could reach right now: a Deduction truth they
 * have not had, whose every prerequisite they have. Hardest first, as with any
 * search.
 */
export function deducibleFrom(truths: Truth[], discovered: readonly string[]): Truth[] {
  return findableBy(truths, DEDUCTION_SKILL, discovered);
}

/**
 * What the narrator may be told about a pending conclusion: that there is one,
 * and the number it is worked out against. NEVER what it is.
 *
 * This is the one place the system volunteers the existence of something
 * hidden, and it is fair: the prerequisites have been earned, so what is being
 * offered is the pay-off for legwork already done rather than a hint that
 * something exists. `dv` is the engine's, so the model never picks a difficulty
 * for a conclusion it cannot see.
 */
export type DeductionOffer = { dv: number; count: number };

export function deductionOffer(
  truths: Truth[],
  discovered: readonly string[],
): DeductionOffer | null {
  const reachable = deducibleFrom(truths, discovered);
  // Easiest of the reachable conclusions: the character is not choosing which
  // leap to make, so the DV on offer is the nearest one.
  const easiest = reachable[reachable.length - 1];
  return easiest ? { dv: easiest.found.dv, count: reachable.length } : null;
}

/**
 * The truths a beat reveals on arrival, whatever anybody rolled.
 *
 * Read against the beat the story has actually reached, so a twist lands when
 * the mission reaches the scene that exposes it. Everything else in the beat
 * stays hidden until somebody looks.
 */
export function truthsRevealedAt(args: {
  missionId: string;
  beatId: string;
  truths: readonly BeatTruth[] | undefined;
  /** The beat the story is standing on now. */
  atBeatId: string;
}): Truth[] {
  const revealed = new Set(
    (args.truths ?? []).filter((t) => t.revealedAt === args.atBeatId).map((t) => t.id),
  );
  if (!revealed.size) return [];
  return truthsInBeat(args).filter((truth) =>
    revealed.has(truth.key.slice(truth.key.lastIndexOf("::") + 2)),
  );
}
