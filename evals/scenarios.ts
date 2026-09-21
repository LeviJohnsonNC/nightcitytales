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
import { NIGHT_AT_THE_OPERA, getBeat } from "@/engine";
import {
  buildGmContext,
  renderGmUserPrompt,
  type GmCharacterSummary,
} from "@/features/gm/gmContext";
import { GM_SYSTEM_PROMPT } from "@/features/gm/gmSystemPrompt";
import { renderLifeUserPrompt, type LifeContext } from "@/features/life/lifeContext";
import { LIFE_SYSTEM_PROMPT } from "@/features/life/lifeSystemPrompt";
import type { CheckContext } from "@/features/narration/narratorChecks";

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

const officeWithheld = (officeBeat.truths ?? [])
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
    packet: renderGmUserPrompt(office, "I pick the lock on the filing cabinet and go through it."),
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
      buildGmContext({ ...office, optionsRequested: true }),
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
