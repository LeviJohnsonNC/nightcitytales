/**
 * What you know about somewhere, because you have been there — or because you
 * live round the corner.
 *
 * The feeling this exists for: a job names a building, and instead of reading
 * "Mission Map #17" the player thinks *I know that building — the elevator is
 * dead, there is a way onto the roof from the container stacks, and the
 * Alligators run the carwash across the road.*
 *
 * The tempting way to build that is a die modifier: familiar ground, +1. This
 * does not do that, deliberately. Cyberpunk RED's DVs are printed and a
 * home-field bonus is an invented rule; `PRODUCT.md` lists "a number appears in
 * prose that no engine module produced" as the worst smell in the codebase.
 * The rules-legal route to a +1 is a Complementary Skill Check, which is the
 * player's to attempt rather than the world's to hand over.
 *
 * So FAMILIARITY PAYS IN INFORMATION. Rungs unlock, one at a time and in a
 * fixed order, facts the engine already holds about the place: what is there,
 * who claims it, who comes when you are loud, and what has happened to it since
 * you first walked past. That is the same ladder the cast dossiers use, pointed
 * at a building instead of a person, and it changes decisions without touching
 * a die.
 *
 * TWO WAYS UP THE SAME LADDER. Visits are earned one building at a time. LOCAL
 * EXPERT is bought a neighbourhood at a time, and opens the same rungs for
 * every address in that district — a local walks into a building on their own
 * street they have never entered and still knows what it is, who claims it, and
 * who answers when it goes loud. That is the Skill's printed description:
 * knowing the area and the agendas of its political and criminal factions.
 *
 * Two rungs are not interchangeable, and the asymmetry is the design:
 *
 *  - `state` can only ever be VISITED for. It reports what has changed here
 *    since you started coming, which is a log of your own six weeks rather than
 *    knowledge of a neighbourhood. Being a local cannot tell you the counter
 *    you have been buying from is gone, because it is your habit that makes it
 *    news.
 *  - `neighbourhood` can only ever be LOCAL EXPERT'S, and is the one rung
 *    measured across the district instead of at one address: what noise really
 *    costs on these streets, and which doors the people who live here use. No
 *    number of visits to a single building can teach either.
 *
 * Every rung is READ, never written: each one comes from the atlas, from the
 * gameplay tags, or from the campaign's own row for the place. Nothing here can
 * state something that is not already true somewhere else. The numbers are a
 * house rule and live in `place-intel.json`, flagged as one.
 *
 * Pure TypeScript.
 */
import intelData from "@/data/atlas/place-intel.json";
import { districtOfPlace, getPlace } from "./geography";
import { districtProfile, placesWithTag, tagMeaning, tagsOf, type PlaceTag } from "./places";
import { flagMeaning, startingState, type PlaceState } from "./placeState";

/**
 * The rungs, as a closed vocabulary.
 *
 * Declared here and the data file is held to it, the same way `places.ts`
 * holds its response tiers: a rung name nobody wrote a builder for would
 * otherwise unlock silently and produce nothing.
 */
export const INTEL_RUNGS = ["what", "who", "law", "state", "neighbourhood"] as const;
export type IntelRung = (typeof INTEL_RUNGS)[number];

function isIntelRung(value: unknown): value is IntelRung {
  return typeof value === "string" && (INTEL_RUNGS as readonly string[]).includes(value);
}

type IntelFile = {
  houseRule: boolean;
  note: string;
  visitLadder: { rung: string; visits: number }[];
  localExpertLadder: { rung: string; level: number }[];
  localKnowledge: { tag: string; purpose: string }[];
  localKnowledgeShown: number;
};

const FILE = intelData as unknown as IntelFile;

function checkedRung(rung: string, where: string): IntelRung {
  if (!isIntelRung(rung)) {
    throw new Error(`place-intel: "${rung}" in ${where} is not an intel rung.`);
  }
  return rung;
}

/** True when the ladders are what they say they are: a tunable house rule. */
export const PLACE_INTEL_IS_HOUSE_RULE: boolean = FILE.houseRule;

/**
 * How many visits each rung costs.
 *
 * Walking past tells you what the place is. Coming back tells you who runs the
 * street. Knowing it properly takes more than an errand.
 */
export const INTEL_LADDER: readonly { visits: number; rung: IntelRung }[] = FILE.visitLadder.map(
  (step) => ({
    visits: step.visits,
    rung: checkedRung(step.rung, "visitLadder"),
  }),
);

/**
 * What Local Expert Level opens which rung, for every address in its district.
 *
 * Several rungs may share a Level — knowing who claims the ground and knowing
 * who answers when it goes loud are the same piece of local knowledge — so this
 * is a list of pairs rather than a rung-per-step ladder.
 */
export const LOCAL_EXPERT_LADDER: readonly { level: number; rung: IntelRung }[] =
  FILE.localExpertLadder.map((step) => ({
    level: step.level,
    rung: checkedRung(step.rung, "localExpertLadder"),
  }));

export type PlaceIntel = {
  placeKey: string;
  placeName: string;
  /** How many rungs this character has actually earned. */
  visits: number;
  /** One line per rung, in ladder order. Empty for somewhere never visited. */
  known: string[];
  /**
   * The subset of `known` that being a local accounts for and visiting does
   * not. The narrator needs the difference: one is "you already know this
   * because you live here" and the other is "you have seen this yourself".
   */
  asALocal: string[];
};

/** Which rungs this many visits has opened. */
export function rungsFor(visits: number): IntelRung[] {
  return INTEL_LADDER.filter((step) => visits >= step.visits).map((step) => step.rung);
}

/** Which rungs being this much of a local in the district has opened. */
export function rungsFromLocalExpert(level: number): IntelRung[] {
  const open = new Set<IntelRung>();
  for (const step of LOCAL_EXPERT_LADDER) {
    if (level >= step.level) open.add(step.rung);
  }
  return [...open];
}

/**
 * Every rung this character has, however they came by it, in ladder order.
 *
 * Ordered by `INTEL_RUNGS` rather than by which ladder opened it, so the
 * briefing reads the same way whether the character learned the place by
 * walking it or by growing up beside it.
 */
export function effectiveRungs(visits: number, localExpertLevel = 0): IntelRung[] {
  const open = new Set<IntelRung>([...rungsFor(visits), ...rungsFromLocalExpert(localExpertLevel)]);
  return INTEL_RUNGS.filter((rung) => open.has(rung));
}

function whatItIs(placeKey: string): string | null {
  const tags = tagsOf(placeKey);
  const meanings = tags.map((tag) => tagMeaning(tag)).filter((m): m is string => !!m);
  if (!meanings.length) return null;
  return `What it is: ${meanings.slice(0, 3).join("; ")}.`;
}

function whoClaimsIt(placeKey: string): string | null {
  const district = districtOfPlace(placeKey);
  if (!district?.gangs.length) return null;
  return `Who claims this ground: ${district.gangs.join(", ")}.`;
}

function whoComes(placeKey: string): string | null {
  const district = districtOfPlace(placeKey);
  const profile = district ? districtProfile(district.key) : undefined;
  if (!profile) return null;
  return `If it goes loud: ${profile.response.who}, ${profile.response.label}.`;
}

/**
 * What has CHANGED here, which is not the same as what is true here.
 *
 * The rung says "since you have been coming here", so it has to be measured
 * against how the place started rather than read off the flags it happens to
 * carry. A market is flagged `market_open` from the moment the city is built;
 * reporting that as news told a player who had earned this rung that trade runs
 * here as usual, which they could see, and which had not happened.
 *
 * Both directions count, and the second one is the point. When a raid clears
 * `market_open` the flag simply vanishes from the list, so the one moment this
 * whole system exists for — the market you have been shopping at for six weeks
 * is gone — produced no line at all.
 */
function whatHasHappened(placeKey: string, state: PlaceState | undefined): string | null {
  if (!state) return null;
  const started = new Set(startingState(placeKey).flags);
  const now = new Set(state.flags);
  const said: string[] = [];
  for (const flag of state.flags) {
    if (!started.has(flag)) said.push(flagMeaning(flag) ?? flag);
  }
  for (const flag of started) {
    if (!now.has(flag)) said.push(flagGone(flag));
  }
  if (!said.length) return null;
  return `Since you have been coming here: ${said.join(" ")}`;
}

/**
 * What it means that a flag the place started with is no longer set.
 *
 * A closed vocabulary like the flags themselves. Anything not named here is
 * reported as the plain fact that it has stopped being true, which is honest
 * and readable rather than a gap.
 */
const FLAG_GONE: Record<string, string> = {
  market_open: "The trade that ran here has stopped.",
  gang_extortion: "Whoever was taking a cut of everything is no longer taking it.",
  power_out: "The power has come back.",
  raided: "The law has stopped coming through.",
  locked_down: "Access is no longer being checked the way it was.",
  under_audit: "Whoever was going through the records has finished.",
};

function flagGone(flag: string): string {
  return FLAG_GONE[flag] ?? `That is no longer true: ${flagMeaning(flag) ?? flag}`;
}

/**
 * What noise actually costs on these streets, and which doors the locals use.
 *
 * The one rung visits cannot buy, and the only one measured across the whole
 * district rather than at one address — which is exactly Local Expert's scope.
 *
 * Both halves are things a stranger cannot work out by standing somewhere. The
 * first is the response the pressure engine already applies: everybody can read
 * "NCPD (in theory)" off the atlas, and only a local knows that in practice
 * nobody comes, or that on this street a raised voice brings Militech before
 * you have finished. The second is `placesWithTag` asked for the kinds of door
 * nobody advertises — the unlicensed surgery, the fence, the empty building
 * that is not empty — each answered with the venue's real name.
 */
function theNeighbourhood(placeKey: string): string[] {
  const district = districtOfPlace(placeKey);
  if (!district) return [];
  const profile = districtProfile(district.key);
  const said: string[] = [];

  // Deliberately says nothing about WHO answers: the `law` rung above already
  // names them, and reaching this rung should not mean being told the same
  // fact twice in different words. What is new here is what noise actually
  // COSTS — the multiplier the pressure engine applies, which everybody else
  // only ever experiences second-hand — and how long an answer takes.
  if (profile) {
    const { heat, minutes } = profile.response;
    if (heat === 0) {
      said.push(
        "What noise costs here: nothing. Nobody is keeping score on these streets, and nobody " +
          "comes however loud it gets.",
      );
    } else {
      const weight =
        heat > 1
          ? "more than it does elsewhere — it is remembered, and by people who act on it"
          : "about what it costs anywhere else in the city";
      said.push(
        minutes > 0
          ? `What noise costs here: ${weight}, and an answer takes about ${minutes} minutes to arrive.`
          : `What noise costs here: ${weight}, though nobody actually comes.`,
      );
    }
  }

  const doors: string[] = [];
  for (const entry of FILE.localKnowledge) {
    if (doors.length >= FILE.localKnowledgeShown) break;
    const venues = placesWithTag(entry.tag as PlaceTag, district.key);
    if (!venues.length) continue;
    doors.push(
      `${entry.purpose} — ${venues
        .map((v) => v.name)
        .slice(0, 2)
        .join(" or ")}`,
    );
  }
  if (doors.length) said.push(`What the locals know is around here: ${doors.join("; ")}.`);

  return said;
}

/**
 * What this character knows about this place.
 *
 * A place they have never been AND are not a local in returns no lines at all —
 * not a blank readout, a genuinely empty one, because the briefing should say
 * nothing rather than say that nothing is known.
 *
 * `localExpertLevel` is this character's Level for the district this place is
 * in, which the caller resolves through `localExpert.ts`. Zero, or omitted, and
 * this behaves exactly as it did when visits were the only way to know
 * anywhere.
 */
export function placeIntel(
  placeKey: string,
  state?: PlaceState | undefined,
  localExpertLevel = 0,
): PlaceIntel | null {
  const place = getPlace(placeKey);
  if (!place) return null;
  const visits = state?.visits ?? 0;
  const visited = new Set(rungsFor(visits));
  const lines: string[] = [];
  const asALocal: string[] = [];

  for (const rung of effectiveRungs(visits, localExpertLevel)) {
    // Most rungs are one line. `neighbourhood` is two separate pieces of local
    // knowledge — what noise costs, and which doors are around — and handing
    // the narrator one long sentence carrying both meant it used neither well.
    const opened =
      rung === "what"
        ? [whatItIs(placeKey)]
        : rung === "who"
          ? [whoClaimsIt(placeKey)]
          : rung === "law"
            ? [whoComes(placeKey)]
            : rung === "state"
              ? [whatHasHappened(placeKey, state)]
              : theNeighbourhood(placeKey);
    for (const line of opened) {
      if (!line) continue;
      lines.push(line);
      // Credited to being a local only when visiting had not already earned it:
      // a local who also comes here every day knows this the ordinary way too.
      if (!visited.has(rung)) asALocal.push(line);
    }
  }

  return { placeKey, placeName: place.name, visits, known: lines, asALocal };
}

/** "You have been to the Greenbox Storage Units four times." */
export function describeFamiliarity(intel: PlaceIntel): string | null {
  if (!intel.visits) return null;
  return intel.visits === 1
    ? `You have been to ${intel.placeName} once.`
    : `You have been to ${intel.placeName} ${intel.visits} times.`;
}

// ---------------------------------------------------------------------------
// How well they know it, for the narrator.
// ---------------------------------------------------------------------------

/**
 * How a place should be described, given how often the character has been.
 *
 * Not a number for the model to restate. The bands exist because the SAME place
 * needs writing three different ways: somewhere new has to be established,
 * somewhere familiar should not be established again, and somewhere they
 * practically live is furniture they would not look at twice.
 *
 * Before this existed the narrator was told nothing at all, so every arrival
 * read as a first arrival — the character who lives at Eagle Rock Stadium had
 * their own front door introduced to them every night. Handing the narrator the
 * written canon made that worse rather than better: with a fixed body of facts
 * to reach for, it would recite the same ones every visit.
 */
export type PlaceStanding = "first" | "returning" | "known";

export type PlaceFamiliarity = {
  placeKey: string;
  visits: number;
  standing: PlaceStanding;
  /** Days since they were last here. Null on a first visit. */
  daysSince: number | null;
  /** Everything they know about it, however they came by it. Same as placeIntel. */
  known: string[];
  /**
   * The part of `known` that being a local accounts for and visiting does not.
   *
   * The narrator needs the difference. "You have seen this yourself" and "you
   * know this because you grew up on this street" are written differently, and
   * the second is the only one that can be true on a first visit — which is
   * exactly the case the whole Skill exists for.
   */
  asALocal: string[];
  /** How much of a local they are in this district, when they are one at all. */
  localExpert: { level: number; districtName: string } | null;
};

/**
 * The bands, read off the intel ladder rather than invented beside it.
 *
 * `known` is the ladder's own deepest visit rung — the point at which the
 * engine already considers somebody to know a place properly, and the number
 * newCampaign uses to say a character knows the building they live in. Taken as
 * the maximum rather than the last entry, because the ladder is data now and
 * data can be reordered.
 */
const KNOWS_IT_WELL: number = Math.max(...INTEL_LADDER.map((step) => step.visits));

export function standingFor(visits: number): PlaceStanding {
  if (visits >= KNOWS_IT_WELL) return "known";
  return visits <= 1 ? "first" : "returning";
}

/**
 * What the narrator should know about how familiar this place is.
 *
 * Null for somewhere the atlas does not have. A place with no stored state is
 * somewhere they have never been, which is a real answer rather than a gap.
 */
export function placeFamiliarity(
  placeKey: string,
  state: PlaceState | undefined,
  today: number,
  localExpertLevel = 0,
): PlaceFamiliarity | null {
  const place = getPlace(placeKey);
  if (!place) return null;
  const visits = state?.visits ?? 0;
  const last = state?.lastVisitDay ?? null;
  const intel = placeIntel(placeKey, state, localExpertLevel);
  const district = districtOfPlace(placeKey);
  return {
    placeKey,
    visits,
    standing: standingFor(visits),
    // The visit being made now is already recorded by the time a turn renders,
    // so "today" is the common case and reads as no gap at all.
    daysSince: last === null ? null : Math.max(0, today - last),
    known: intel?.known ?? [],
    asALocal: intel?.asALocal ?? [],
    localExpert:
      localExpertLevel > 0 && district
        ? { level: localExpertLevel, districtName: district.name }
        : null,
  };
}
