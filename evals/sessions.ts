/**
 * Scenes played over several turns.
 *
 * Every scenario in `scenarios.ts` is one turn, asked cold. What goes wrong in a
 * scene tends to show on turn four: the room described again, the bartender's
 * line quoted back, a withheld fact that finally leaks once enough has been said
 * around it. A session runs a scripted sequence of player inputs in one scene,
 * and after each reply puts what the narrator said into the next turn's RECENT
 * block through the same functions play uses (`recentLifeLines`,
 * `recentEventLines`), so the window, the trimming and the order are play's own.
 *
 * The inputs are scripted, not chosen by a model: a session measures the
 * narrator, and a second model deciding what the player does would make every
 * difference between two runs partly the player's. A check the narrator
 * proposes is not rolled either. In play a proposed check becomes a prompt the
 * player rolls, and the result comes back as its own turn; here the scene simply
 * moves on to the next input. That is a real difference from play, and the price
 * of keeping the dice out of the eval.
 */
import { buildGmContext, renderGmUserPrompt } from "@/features/gm/gmContext";
import { GM_SYSTEM_PROMPT } from "@/features/gm/gmSystemPrompt";
import { renderLifeUserPrompt } from "@/features/life/lifeContext";
import { LIFE_SYSTEM_PROMPT } from "@/features/life/lifeSystemPrompt";
import { recentLifeLines } from "@/features/life/lifeModel";
import { recentEventLines } from "@/features/play/playModel";
import type { CampaignEvent } from "@/lib/backend";
import { atTheBar, officeMidScene, officeWithheld, type ScenarioExpectation } from "./scenarios";

export type Session = {
  id: string;
  narrator: "gm" | "life";
  about: string;
  system: string;
  /** What the player says, in order. */
  inputs: string[];
  /** The one job the player deals with all scene, when there is one: names given in it belong to that job. */
  interlocutor?: string;
  /** What every turn is held to. */
  expect: ScenarioExpectation;
  /** The packet for turn `turn` (0-based), given what has been said so far. */
  packet(turn: number, said: { input: string; narration: string }[]): string;
};

/** Only `type` and `summary` are read by the recent-lines functions. */
const event = (type: string, summary: string) => ({ type, summary }) as unknown as CampaignEvent;

/** The ledger as play would hold it after `said`, oldest first. */
function ledger(
  seed: CampaignEvent[],
  said: { input: string; narration: string }[],
  narrator: "gm" | "life",
) {
  return [
    ...seed,
    ...said.flatMap((s) => [
      event("player_input", s.input),
      event(narrator === "gm" ? "gm_narration" : "life_narration", s.narration),
    ]),
  ];
}

export const SESSIONS: Session[] = [
  {
    id: "session-life-at-the-bar",
    narrator: "life",
    about: "five turns at one bar: the room is not described again and no line comes back",
    system: LIFE_SYSTEM_PROMPT,
    inputs: [
      "I sit down at the counter and order a drink.",
      "I ask the bartender how business has been.",
      "I ask if there is any work going.",
      "I finish the drink and watch the room for a while.",
      "I ask the bartender about the men in the back booth.",
    ],
    expect: {
      optionsRequested: false,
      knownNpcKeys: [],
      withheldTruths: [],
      mustStayQuiet: false,
      riskyIntent: false,
      wordBudget: 180,
    },
    packet(turn, said) {
      const seed = [event("life_narration", "You walked into the bar a little while ago.")];
      return renderLifeUserPrompt(
        {
          ...atTheBar,
          inScene: turn > 0,
          recentEvents: recentLifeLines(ledger(seed, said, "life")),
        },
        this.inputs[turn]!,
      );
    },
  },
  {
    id: "session-life-the-bartender",
    narrator: "life",
    about: "five turns with one bartender: whoever he says he is in turn one, he is in turn five",
    system: LIFE_SYSTEM_PROMPT,
    interlocutor: "bartender",
    inputs: [
      "I sit at the counter, order a drink, and ask the bartender his name.",
      "I ask him how long he has worked here.",
      "I ask him who owns the place.",
      "I ask him what he did before this.",
      "I thank him, leave a tip, and ask his name again. I did not catch it.",
    ],
    expect: {
      optionsRequested: false,
      knownNpcKeys: [],
      withheldTruths: [],
      mustStayQuiet: false,
      riskyIntent: false,
      wordBudget: 180,
    },
    packet(turn, said) {
      const seed = [event("life_narration", "You walked into the bar a little while ago.")];
      return renderLifeUserPrompt(
        {
          ...atTheBar,
          inScene: turn > 0,
          recentEvents: recentLifeLines(ledger(seed, said, "life")),
        },
        this.inputs[turn]!,
      );
    },
  },
  {
    id: "session-job-the-office",
    narrator: "gm",
    about:
      "four turns in Huntver's office: nothing repeats and no withheld fact leaks as it fills up",
    system: GM_SYSTEM_PROMPT,
    inputs: [
      "I look around the office for anything out of place.",
      "I go through the desk.",
      "I read what is on the terminal.",
      "I check the shelves and the walls.",
    ],
    expect: {
      optionsRequested: false,
      knownNpcKeys: [],
      withheldTruths: officeWithheld,
      mustStayQuiet: false,
      riskyIntent: false,
      wordBudget: 260,
    },
    packet(turn, said) {
      const seed = [event("gm_narration", "Asked the students about the missing women")];
      return renderGmUserPrompt(
        buildGmContext({
          ...officeMidScene,
          recentEvents: recentEventLines(ledger(seed, said, "gm")),
        }),
        this.inputs[turn]!,
      );
    },
  },
];
