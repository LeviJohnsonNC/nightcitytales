/**
 * The turns the eval runs, and what each one is watching for.
 *
 * A scenario is a packet the shipping renderers produce from fixture state, so
 * what the model sees here is what it sees in play — `renderGmUserPrompt` and
 * `renderLifeUserPrompt`, not a paraphrase of them. Nothing here touches the
 * database: `buildGmContext` is the identity function and `LifeContext` is a
 * plain object, so a scenario is a literal.
 *
 * Keep the set small. Each one costs a model call per repeat, and six scenarios
 * that each watch for something specific beat twenty that all watch a quiet
 * evening go by.
 */
import {
  NIGHT_AT_THE_OPERA,
  describePosition,
  getBeat,
  getDistrict,
  nearestWithTag,
  placeActions,
  reachableDestinations,
  resolvePosition,
} from "@/engine";
import {
  buildGmContext,
  renderGmUserPrompt,
  type GmCharacterSummary,
} from "@/features/gm/gmContext";
import { checkResolvedInput } from "@/features/gm/checkResult";
import { GM_SYSTEM_PROMPT } from "@/features/gm/gmSystemPrompt";
import { checkResolvedLine } from "@/features/life/checkResult";
import { carryOnLine } from "@/features/narration/narratorRules";
import { renderLifeUserPrompt, type LifeContext } from "@/features/life/lifeContext";
import { LIFE_SYSTEM_PROMPT } from "@/features/life/lifeSystemPrompt";
import { describeTravelOutcome, nearestByKindLines } from "@/features/life/lifeModel";
import type { CheckContext } from "@/features/narration/narratorChecks";
import type { PairedContext } from "@/features/narration/pairedChecks";

/** What the checks need beyond the packet, which the runner fills in. */
export type ScenarioExpectation = Omit<CheckContext, "packet">;

export type Scenario = {
  id: string;
  narrator: "gm" | "life";
  /** What this scenario exists to catch. One line, for the report header. */
  about: string;
  system: string;
  packet: string;
  expect: ScenarioExpectation;
};

const CHARACTER: GmCharacterSummary = {
  name: "Vela Ruiz",
  handle: "Ratchet",
  role: "solo",
  hp: 34,
  hpMax: 40,
  woundState: "light",
  humanity: 44,
  humanityMax: 60,
  eurobucks: 1030,
  stats: { ref: 8, body: 6, cool: 6, int: 7 },
  keySkills: [
    { skill: "Handgun", id: "handgun", base: 14 },
    { skill: "Perception", id: "perception", base: 12 },
    { skill: "Pick Lock", id: "pick_lock", base: 10 },
    { skill: "Persuasion", id: "persuasion", base: 9 },
    { skill: "Conversation", id: "conversation", base: 8 },
  ],
};

const LIFE_CHARACTER: LifeContext["character"] = {
  name: "Vela Ruiz",
  handle: "Ratchet",
  role: "Solo",
  hp: 34,
  hpMax: 40,
  woundState: "light",
  eurobucks: 1030,
  stats: { ref: 8, cool: 6 },
  skills: [
    { skill: "Trading", id: "trading", base: 6 },
    { skill: "Streetwise", id: "streetwise", base: 8 },
    { skill: "Conversation", id: "conversation", base: 8 },
  ],
};

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

const mission = NIGHT_AT_THE_OPERA;

/**
 * Huntver's office, with nothing found yet.
 *
 * The beat holds real truths the character has NOT uncovered, and the prompt
 * never sends them — `discoveredBeatTruths` is omitted, which is what "found
 * nothing yet" means. So a tell appearing in the prose is not a leak through a
 * badly worded instruction: it is the model having guessed the answer and
 * stated it as fact, which is the failure `Beat.truths` exists to prevent.
 */
const officeBeat = getBeat(mission, "empty_office_hours");

const office = buildGmContext({
  mission,
  beat: officeBeat,
  availableExits: officeBeat.exits,
  character: CHARACTER,
  objectives: [{ id: "background.0", text: "Recover Lucy Rhinemeyer", status: "active" }],
  npcsPresent: [],
  recentEvents: ["Asked the students about the missing women"],
  clock: "Day 2, 19:10",
  capabilities: ["Heavy Pistol, 8 rounds loaded", "Lockpick set", "Agent"],
});

/** The tells for this beat's truths, authored rather than inferred. */
const OFFICE_TELLS: Record<string, string[]> = {
  photo: ["barbara", "dahl"],
};

/**
 * The office after the scene has opened: the turn play actually sends when the
 * player acts, and the one that used to describe the corridor all over again.
 */
export const officeMidScene = buildGmContext({ ...office, sceneSet: true });

export const officeWithheld = (officeBeat.truths ?? [])
  .filter((t) => OFFICE_TELLS[t.id])
  .map((t) => ({ truth: t.fact, tells: OFFICE_TELLS[t.id] as string[] }));

export const SCENARIOS: Scenario[] = [
  {
    id: "job-opens-a-room",
    narrator: "gm",
    about: "opening a room holding facts the character has not found",
    system: GM_SYSTEM_PROMPT,
    packet: renderGmUserPrompt(office, "(The scene opens.)"),
    expect: {
      optionsRequested: false,
      knownNpcKeys: [],
      withheldTruths: officeWithheld,
      mustStayQuiet: false,
      riskyIntent: false,
      wordBudget: 260,
    },
  },
  {
    id: "job-risky-intent",
    narrator: "gm",
    about: "an intent that could plausibly fail must reach the dice, not the prose",
    system: GM_SYSTEM_PROMPT,
    packet: renderGmUserPrompt(
      officeMidScene,
      "I pick the lock on the filing cabinet and go through it.",
    ),
    expect: {
      optionsRequested: false,
      knownNpcKeys: [],
      withheldTruths: officeWithheld,
      mustStayQuiet: false,
      riskyIntent: true,
      wordBudget: 260,
    },
  },
  {
    id: "job-asks-for-options",
    narrator: "gm",
    about: "the one turn a suggestion list is legal, and the Role move inside it",
    system: GM_SYSTEM_PROMPT,
    packet: renderGmUserPrompt(
      buildGmContext({ ...officeMidScene, optionsRequested: true }),
      "(What are my options here?)",
    ),
    expect: {
      optionsRequested: true,
      knownNpcKeys: [],
      withheldTruths: officeWithheld,
      mustStayQuiet: false,
      riskyIntent: false,
      wordBudget: 260,
    },
  },
];

// ---------------------------------------------------------------------------
// Life
// ---------------------------------------------------------------------------

/**
 * A Tuesday with nothing on it.
 *
 * No wire block, so the engine rolled no work — and the prompt says so in as
 * many words: "Do not fill the silence with a stranger, a phone call or a noise
 * in the corridor." This is the scenario that checks whether that survives the
 * model's instinct that an empty turn is a broken one.
 */
const quietEvening: LifeContext = {
  clock: { day: 3, minute: 21 * 60 + 40 },
  character: LIFE_CHARACTER,
  situation: null,
  otherSituations: [],
  clocks: [],
  people: [],
  recentEvents: ["Paid rent", "Slept badly"],
};

const shopEvening: LifeContext = {
  ...quietEvening,
  recentEvents: ["Took a hit to the jacket on the last job"],
};

SCENARIOS.push(
  {
    id: "life-quiet-evening",
    narrator: "life",
    about: "an evening the engine rolled empty stays empty",
    system: LIFE_SYSTEM_PROMPT,
    packet: renderLifeUserPrompt(quietEvening, "I stay in and do nothing much."),
    expect: {
      optionsRequested: false,
      knownNpcKeys: [],
      withheldTruths: [],
      mustStayQuiet: true,
      riskyIntent: false,
      wordBudget: 160,
    },
  },
  {
    id: "life-prices-nothing",
    narrator: "life",
    about: "the turn that used to price a bowl of noodles",
    system: LIFE_SYSTEM_PROMPT,
    packet: renderLifeUserPrompt(shopEvening, "I go out and find somewhere to eat."),
    expect: {
      optionsRequested: false,
      knownNpcKeys: [],
      withheldTruths: [],
      mustStayQuiet: false,
      riskyIntent: false,
      wordBudget: 160,
    },
  },
);

// ---------------------------------------------------------------------------
// Follow-through
//
// One transcript, played as four turns. The character lives in The Precipice,
// a container stack in Old Japantown, which then had no bar at all (it has the
// Paper Lantern now, a house-rule venue, so the nearest bar is two blocks away).
// "Go find a bar and order a drink" was refused as "not a place on the map";
// the neighbour's directions named a cellar the map had never heard of; "go
// there" was refused too; and each refusal walked the character back up the
// stairs. None of the checks before these could see any of it, because every
// one of them was watching for the narrator doing too much.
// ---------------------------------------------------------------------------

const HOME = "h5";

/**
 * Where the character is standing, the way buildContext puts it: the same
 * engine calls, so the model sees the place play would show it.
 */
function placeAt(at: string): NonNullable<LifeContext["place"]> {
  const position = resolvePosition(at)!;
  const district = getDistrict(position.districtKey)!;
  return {
    where: describePosition(at),
    district: district.name,
    area: "Night City",
    security: district.security,
    gangs: district.gangs,
    combatZone: false,
    business: placeActions({ districtKey: district.key, placeKey: position.placeKey, places: {} })
      .filter((a) => !a.skillId)
      .map((a) => `${a.label} (${a.placeName}${a.cost !== null ? `, ${a.cost}eb` : ""})`),
    nearby: district.locations.slice(0, 8).map((l) => l.name),
    destinations: reachableDestinations(at).map((d) => d.name),
    nearestByKind: nearestByKindLines(at, []),
  };
}

const NEAREST_BARS = nearestWithTag(HOME, "bar", { limit: 3 });
const BAR = NEAREST_BARS[0]!;

const atHome: LifeContext = {
  ...quietEvening,
  place: placeAt(HOME),
  recentEvents: [
    "Six o'clock hits the corrugated iron like a dull chime. The neighbour's pirate rig hums through the floor.",
  ],
};

const REQUEST = "Go find a bar and order a drink";

/** The engine's own words for a settled trip, which always has some. */
function settled(outcome: Parameters<typeof describeTravelOutcome>[0]): string {
  const text = describeTravelOutcome(outcome);
  if (!text) throw new Error("a settled trip always has something to say");
  return text;
}

SCENARIOS.push(
  {
    id: "life-find-a-bar",
    narrator: "life",
    about: '"find a bar" goes to a real bar instead of being refused',
    system: LIFE_SYSTEM_PROMPT,
    packet: renderLifeUserPrompt(atHome, REQUEST),
    expect: {
      optionsRequested: false,
      knownNpcKeys: [],
      withheldTruths: [],
      mustStayQuiet: false,
      riskyIntent: false,
      tripToKind: "bar",
    },
  },
  {
    id: "life-arrival-finishes",
    narrator: "life",
    about: "arriving at the bar still orders the drink",
    system: LIFE_SYSTEM_PROMPT,
    packet: renderLifeUserPrompt(
      {
        ...quietEvening,
        // Just arrived: the one turn of a first visit that establishes it.
        place: {
          ...placeAt(BAR.key),
          familiarity: { visits: 1, standing: "first", since: "", known: [] },
        },
        resolved: settled({
          travelled: {
            from: describePosition(HOME),
            to: describePosition(BAR.key),
            minutes: BAR.minutes,
            mode: "on foot",
          },
        }),
        said: REQUEST,
      },
      "(open the moment)",
    ),
    expect: {
      optionsRequested: false,
      knownNpcKeys: [],
      withheldTruths: [],
      mustStayQuiet: false,
      riskyIntent: false,
      carryThrough: ["glass", "pour", "drink", "counter", "stool", "bottle", "beer"],
      wordBudget: 180,
    },
  },
  {
    id: "life-asks-directions",
    narrator: "life",
    about: "a neighbour's directions name a bar the map can take you to",
    system: LIFE_SYSTEM_PROMPT,
    packet: renderLifeUserPrompt(atHome, "Ask someone where a good bar is"),
    expect: {
      optionsRequested: false,
      knownNpcKeys: [],
      withheldTruths: [],
      mustStayQuiet: false,
      riskyIntent: false,
      realAnswers: NEAREST_BARS.map((b) => b.name),
    },
  },
  {
    id: "life-refused-trip-stays-put",
    narrator: "life",
    about: "a trip the engine could not place leaves the character where they were",
    system: LIFE_SYSTEM_PROMPT,
    packet: renderLifeUserPrompt(
      {
        ...atHome,
        resolved: settled({
          travelRefused: "Nowhere was named and no heading was given.",
        }),
      },
      "(open the moment)",
    ),
    expect: {
      optionsRequested: false,
      knownNpcKeys: [],
      withheldTruths: [],
      mustStayQuiet: false,
      riskyIntent: false,
      staysPut: true,
      wordBudget: 80,
    },
  },
);

// ---------------------------------------------------------------------------
// Momentum
//
// The same bar, four more ways the game used to stall: an ordinary request
// that needed a second prompt, a scene hijacked by the next item on the list,
// a friend left sitting in the corner after the engine said they came over,
// and a Job turn that stopped before the easy half of what was asked.
// ---------------------------------------------------------------------------

/**
 * Sitting in the bar they walked into on an earlier turn today: a first visit,
 * already established. Play marks it so (`stillHere`), and without the mark the
 * scenario asked the model to describe a room the player was already in.
 */
export const atTheBar: LifeContext = {
  ...quietEvening,
  place: {
    ...placeAt(BAR.key),
    familiarity: { visits: 1, standing: "first", since: "", known: [], stillHere: true },
  },
};

const KIRO = {
  key: "kiro",
  name: "Kiro Tanaka",
  disposition: 2,
  status: "alive",
  role: "friend",
  standing: "An old friend from the block, who still calls when it matters.",
};

SCENARIOS.push(
  {
    id: "life-sits-and-orders",
    narrator: "life",
    about: "an ordinary request is done in one turn, not two",
    system: LIFE_SYSTEM_PROMPT,
    packet: renderLifeUserPrompt(atTheBar, "I sit down at the counter and order a drink."),
    expect: {
      optionsRequested: false,
      knownNpcKeys: [],
      withheldTruths: [],
      mustStayQuiet: false,
      riskyIntent: false,
      carryThrough: ["glass", "pour", "bottle", "beer", "slides"],
      wordBudget: 160,
    },
  },
  {
    id: "life-scene-holds",
    narrator: "life",
    about: "a background worry does not take over the scene the player is in",
    system: LIFE_SYSTEM_PROMPT,
    packet: renderLifeUserPrompt(
      {
        ...atTheBar,
        inScene: true,
        situation: {
          key: "armor_chewed",
          category: "need",
          title: "The jacket is chewed",
          summary: "The armored jacket took a beating on the last job and needs patching.",
          status: "live",
          severity: 3,
        },
      },
      "I ask the bartender what's good tonight.",
    ),
    expect: {
      optionsRequested: false,
      knownNpcKeys: [],
      withheldTruths: [],
      mustStayQuiet: false,
      riskyIntent: false,
      // The player's own jacket, not any jacket: the first live run flagged a
      // table of gangers "in matching embroidered jackets".
      offScene: ["your jacket", "your armor", "your armour", "armored jacket", "patch"],
      wordBudget: 160,
    },
  },
  {
    id: "life-someone-comes-over",
    narrator: "life",
    about: "somebody the engine said comes over, comes over",
    system: LIFE_SYSTEM_PROMPT,
    packet: renderLifeUserPrompt(
      {
        ...atTheBar,
        people: [KIRO],
        place: {
          ...atTheBar.place!,
          whoIsHere: { name: KIRO.name, key: KIRO.key, comingOver: true },
        },
      },
      "I nurse my drink and watch the door.",
    ),
    expect: {
      optionsRequested: false,
      knownNpcKeys: [KIRO.key],
      withheldTruths: [],
      mustStayQuiet: false,
      riskyIntent: false,
      comesOver: KIRO.name,
      wordBudget: 180,
    },
  },
  {
    id: "job-does-the-easy-part",
    narrator: "gm",
    about: "a compound intent does the safe half and stops at the dice",
    system: GM_SYSTEM_PROMPT,
    packet: renderGmUserPrompt(
      officeMidScene,
      "I sit down in Huntver's chair and go through the desk drawers.",
    ),
    expect: {
      optionsRequested: false,
      knownNpcKeys: [],
      withheldTruths: officeWithheld,
      mustStayQuiet: false,
      riskyIntent: true,
      carryThrough: [
        "chair",
        "sit",
        "seat",
        "swivel",
        "drop into",
        "settle into",
        "lower yourself",
      ],
      wordBudget: 260,
    },
  },
);

// ---------------------------------------------------------------------------
// Quick dice
//
// A crowded bar, and the player wants the bartender. If that needs a roll at
// all, it is one that risks nothing, and it should roll itself rather than
// stop the game for a button.
// ---------------------------------------------------------------------------

SCENARIOS.push({
  id: "life-small-roll-rolls-itself",
  narrator: "life",
  about: "a roll that risks nothing is marked to roll itself, or not asked for",
  system: LIFE_SYSTEM_PROMPT,
  packet: renderLifeUserPrompt(atTheBar, "I try to catch the bartender's eye over the crowd."),
  expect: {
    optionsRequested: false,
    knownNpcKeys: [],
    withheldTruths: [],
    mustStayQuiet: false,
    riskyIntent: false,
    nothingRiding: true,
    wordBudget: 160,
  },
});

// ---------------------------------------------------------------------------
// Results, and work on the wire
//
// Every roll the player makes comes back through a result turn, which makes it
// the most frequent turn in the game, and the last tuning pass found its worst
// bug on exactly that kind of turn. The result lines are built by the same
// functions play calls (gm/checkResult.ts, life/checkResult.ts), so the eval
// asks what play asks.
// ---------------------------------------------------------------------------

const LOCK_INTENT = "Pick the lock on the filing cabinet";
const LOCK_SAID = "I pick the lock on the filing cabinet and go through it.";

SCENARIOS.push(
  {
    id: "job-check-succeeds",
    narrator: "gm",
    about: "a success is told as a success, and the rest of what they said follows",
    system: GM_SYSTEM_PROMPT,
    packet: renderGmUserPrompt(
      officeMidScene,
      checkResolvedInput({
        skillName: "Pick Lock",
        formula: "7 + DEX 7 + Pick Lock 4 = 18",
        critical: null,
        success: true,
        margin: 9,
        intent: LOCK_INTENT,
        extra: ` ${carryOnLine(LOCK_SAID)}`,
      }),
    ),
    expect: {
      optionsRequested: false,
      knownNpcKeys: [],
      withheldTruths: officeWithheld,
      mustStayQuiet: false,
      riskyIntent: false,
      resolved: {
        skillId: "pick_lock",
        contradicts: ["won't budge", "will not budge", "still locked", "refuses to turn"],
      },
      wordBudget: 260,
    },
  },
  {
    id: "job-check-fails",
    narrator: "gm",
    about: "a failure stays a failure, and is not asked for again",
    system: GM_SYSTEM_PROMPT,
    packet: renderGmUserPrompt(
      officeMidScene,
      checkResolvedInput({
        skillName: "Pick Lock",
        formula: "2 + DEX 7 + Pick Lock 4 = 13",
        critical: null,
        success: false,
        margin: -2,
        intent: LOCK_INTENT,
        extra: ` ${carryOnLine(LOCK_SAID)}`,
      }),
    ),
    expect: {
      optionsRequested: false,
      knownNpcKeys: [],
      withheldTruths: officeWithheld,
      mustStayQuiet: false,
      riskyIntent: false,
      resolved: {
        skillId: "pick_lock",
        contradicts: ["clicks open", "swings open", "pops open", "slides open", "springs open"],
      },
      wordBudget: 260,
    },
  },
  {
    id: "life-check-fails",
    narrator: "life",
    about: "a failed roll in Life leaves them somewhere worse, not at a retry",
    system: LIFE_SYSTEM_PROMPT,
    packet: renderLifeUserPrompt(
      {
        ...atTheBar,
        said: "I talk my way past the bouncer into the back room.",
        resolved: checkResolvedLine({
          skillName: "Persuasion",
          formula: "3 + COOL 6 + Persuasion 2 = 11",
          success: false,
          margin: -2,
          intent: "Talk the bouncer into letting them into the back room",
        }),
      },
      "(open the moment)",
    ),
    expect: {
      optionsRequested: false,
      knownNpcKeys: [],
      withheldTruths: [],
      mustStayQuiet: false,
      riskyIntent: false,
      resolved: {
        skillId: "persuasion",
        contradicts: ["waves you through", "lets you through", "lets you in", "steps aside"],
      },
      wordBudget: 160,
    },
  },
  {
    id: "life-work-on-the-wire",
    narrator: "life",
    about: "the job the engine rolled is offered the night it is there",
    system: LIFE_SYSTEM_PROMPT,
    packet: renderLifeUserPrompt(
      {
        ...quietEvening,
        wire: {
          title: "A courier who never arrived",
          brokerName: 'Marcus "Tally" Oyelaran',
          brokerKey: "tally",
          brokerLine: "Warm, generous, keeps a ledger of every favour.",
          district: "Kabuki",
          pitch: "A package left a clinic in Kabuki and never reached the buyer.",
          ask: "Find out where it went and bring it back.",
          payout: 1000,
        },
      },
      "I stay in and do nothing much.",
    ),
    expect: {
      optionsRequested: false,
      knownNpcKeys: ["tally"],
      withheldTruths: [],
      mustStayQuiet: false,
      riskyIntent: false,
      wireJob: true,
      wordBudget: 180,
    },
  },
);

// ---------------------------------------------------------------------------
// Pairs
//
// The same scene twice, differing in ONE input. Each side is held to the
// ordinary checks, and the two are held to each other: what must not change
// (the dice) and what must (the fiction). See `pairedChecks.ts`.
// ---------------------------------------------------------------------------

export type PairedScenario = {
  id: string;
  narrator: "gm" | "life";
  about: string;
  system: string;
  /** What the ordinary checks need, applied to both sides. */
  expect: ScenarioExpectation;
  variants: [{ label: string; packet: string }, { label: string; packet: string }];
  paired: PairedContext;
};

/** The night porter outside Huntver's office: somebody to lean on. */
const PORTER = {
  name: "Emil, the night porter",
  key: "porter",
  disposition: 0,
  status: "alive",
  standing: "Watches the corridor outside Huntver's office, and has since before the fire.",
};

const OLD_MAN = "man, elderly";
const YOUNG_WOMAN = "woman, young";

/**
 * Words that show the narrator saw who was standing there. Heuristic and
 * authored, like a withheld truth's tells: the first live run of this pair had
 * the narrator writing "seventy-odd years of mileage" and "your youth" while
 * the first list looked for "old man" and "young", so a paraphrase is the rule
 * rather than the exception. Read the transcript before believing a failure.
 * A cue is a whole word, or a stem when it ends in `*`.
 */
const OLD_MAN_CUES = [
  "old",
  "older",
  "elderly",
  "grey",
  "gray",
  "greying",
  "weathered",
  "mileage",
  "decades",
  "grandfather",
  "your age",
  "his age",
  "aged",
  "frail",
  "cane",
  "sir",
];
const YOUNG_WOMAN_CUES = ["young*", "youth*", "girl", "kid", "miss", "lady", "ma'am"];

const guardTalk = (appearsAs: string) =>
  renderGmUserPrompt(
    buildGmContext({
      ...officeMidScene,
      character: { ...CHARACTER, appearsAs },
      npcsPresent: [PORTER],
    }),
    "I tell the porter I need to see Huntver's private files and that he needs to look the other way.",
  );

const atTheCounter = (appearsAs: string) =>
  renderLifeUserPrompt(
    { ...atTheBar, character: { ...LIFE_CHARACTER, appearsAs } },
    "I walk up to the counter and ask the bartender what's good tonight.",
  );

const optionsFor = (role: string) =>
  renderGmUserPrompt(
    buildGmContext({
      ...officeMidScene,
      character: { ...CHARACTER, role },
      optionsRequested: true,
    }),
    "(What are my options here?)",
  );

export const PAIRS: PairedScenario[] = [
  {
    id: "pair-appearance-moves-no-dice",
    narrator: "gm",
    about: "who is asking must not change what the dice ask, and must change the porter's face",
    system: GM_SYSTEM_PROMPT,
    expect: {
      optionsRequested: false,
      knownNpcKeys: [PORTER.key],
      withheldTruths: officeWithheld,
      mustStayQuiet: false,
      riskyIntent: true,
      wordBudget: 260,
    },
    variants: [
      { label: "71-year-old man", packet: guardTalk(OLD_MAN) },
      { label: "22-year-old woman", packet: guardTalk(YOUNG_WOMAN) },
    ],
    paired: {
      labels: ["71-year-old man", "22-year-old woman"],
      sameDice: true,
      cues: [OLD_MAN_CUES, YOUNG_WOMAN_CUES],
    },
  },
  {
    id: "pair-appearance-first-impression",
    narrator: "life",
    about: "the bartender's first look at somebody differs with who walks up",
    system: LIFE_SYSTEM_PROMPT,
    expect: {
      optionsRequested: false,
      knownNpcKeys: [],
      withheldTruths: [],
      mustStayQuiet: false,
      riskyIntent: false,
      wordBudget: 160,
    },
    variants: [
      { label: "71-year-old man", packet: atTheCounter(OLD_MAN) },
      { label: "22-year-old woman", packet: atTheCounter(YOUNG_WOMAN) },
    ],
    paired: {
      labels: ["71-year-old man", "22-year-old woman"],
      cues: [OLD_MAN_CUES, YOUNG_WOMAN_CUES],
    },
  },
  {
    id: "pair-role-sees-the-room",
    narrator: "gm",
    about: "the same office offers a Solo and a Netrunner different first moves",
    system: GM_SYSTEM_PROMPT,
    expect: {
      optionsRequested: true,
      knownNpcKeys: [],
      withheldTruths: officeWithheld,
      mustStayQuiet: false,
      riskyIntent: false,
      wordBudget: 260,
    },
    variants: [
      { label: "Solo", packet: optionsFor("solo") },
      { label: "Netrunner", packet: optionsFor("netrunner") },
    ],
    paired: {
      labels: ["Solo", "Netrunner"],
      optionsDiffer: true,
      cues: [
        [],
        ["deck", "cyberdeck", "terminal", "network", "jack", "hack", "netrun", "ICE", "wireless"],
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// Being recognised (REPUTATION_RULE).
//
// On a job, a guard the character has never met blocks a corridor; the engine
// rolled that he has NOT heard of them, and the player squares up. In Life, the
// enemy from the character's own Lifepath is at the bar and the player stares
// him down. Both standoffs should go to the dice as a Facedown, and the guard
// should not know the name. The guard is listed as present, with a key, the
// way play lists a person in the scene: a Facedown needs somebody to be against.
// ---------------------------------------------------------------------------

const KNOWN_BUT_NOT_HERE =
  "4 — Stories are all over the local area. Anyone meeting them for the first time this turn has NOT heard of them.";

const RAZOR = {
  key: "razor",
  name: "Razor",
  disposition: -2,
  status: "alive",
  role: "enemy",
  standing: "Somebody from the old block who has wanted the character gone for years.",
};

const GUARD = {
  key: "campus_guard",
  name: "Campus security guard",
  disposition: 0,
  status: "alive",
  standing: "On shift, and has never seen the character before.",
};

SCENARIOS.push(
  {
    id: "life-stares-down-an-enemy",
    narrator: "life",
    about: "squaring up to somebody to make them leave goes to a Facedown",
    system: LIFE_SYSTEM_PROMPT,
    packet: renderLifeUserPrompt(
      {
        ...atTheBar,
        character: { ...LIFE_CHARACTER, reputation: KNOWN_BUT_NOT_HERE },
        people: [RAZOR],
        place: { ...atTheBar.place!, whoIsHere: { name: RAZOR.name, key: RAZOR.key } },
      },
      "Razor is at the end of the counter, grinning at me. I walk over, get in his face and stare him down until he leaves.",
    ),
    expect: {
      optionsRequested: false,
      knownNpcKeys: [RAZOR.key],
      withheldTruths: [],
      mustStayQuiet: false,
      riskyIntent: true,
      squaresUp: true,
      wordBudget: 180,
    },
  },
  {
    id: "job-stares-down-a-guard",
    narrator: "gm",
    about: "a standoff with a stranger goes to a Facedown, and he does not know the name",
    system: GM_SYSTEM_PROMPT,
    packet: renderGmUserPrompt(
      {
        ...officeMidScene,
        character: { ...CHARACTER, reputation: KNOWN_BUT_NOT_HERE },
        npcsPresent: [GUARD],
      },
      "The security guard steps out and blocks the corridor. I square up to him and stare him down until he gets out of my way.",
    ),
    expect: {
      optionsRequested: false,
      knownNpcKeys: [GUARD.key],
      withheldTruths: officeWithheld,
      mustStayQuiet: false,
      riskyIntent: true,
      squaresUp: true,
      strangerUnheard: true,
      wordBudget: 260,
    },
  },
);
