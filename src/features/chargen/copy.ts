/**
 * UI copy ONLY. Nothing here is a Cyberpunk RED rules value: every number a
 * player acts on is read from /src/data/rules/. These strings are plain-English
 * orientation text for the wizard, written from the user's brief.
 */
import type { CreationMethod } from "@/engine";

export type MethodCopy = {
  id: CreationMethod;
  headline: string;
  body: string;
  choice: string;
  time: string;
};

export const METHOD_COPY: MethodCopy[] = [
  {
    id: "streetrat",
    headline: "Fastest. Roll once, get a complete character.",
    body: "You roll 1d10 and take an entire pre-built STAT row as written. Skills, weapons, armor, and cyberware are all pre-set for your Role. You still run the full Lifepath, and you still get 500eb to spend however you like.",
    choice: "Low",
    time: "~5 minutes",
  },
  {
    id: "edgerunner",
    headline: "Rolled STATs, your call on Skills.",
    body: "You roll 1d10 per STAT against your Role's table, so you get what the dice give you. But you distribute 86 Skill Points yourself across your Role's 20 Skills. Gear is pre-set, plus 500eb.",
    choice: "Medium",
    time: "~15 minutes",
  },
  {
    id: "complete_package",
    headline: "Total control. Build exactly the character you want.",
    body: "62 points to buy STATs, 86 Skill Points to spend on any Skills you like, and 2,550eb to shop the Night Market yourself: plus 800eb that can only be spent on Fashion and Fashionware.",
    choice: "Total",
    time: "~40 minutes",
  },
];

/** Plain-English playstyle line per Role. Flavor guidance, not mechanics. */
export const ROLE_PLAYS_LIKE: Record<string, string> = {
  rockerboy: "Plays like: the crowd is your weapon: talk, perform, and turn strangers into a movement.",
  solo: "Plays like: the one who wins the fight: you read the battlefield and end it first.",
  netrunner: "Plays like: a second game inside the game: you go into the NET while the crew holds the room.",
  tech: "Plays like: the fixer of broken things: you build, repair, and upgrade what nobody else can.",
  medtech: "Plays like: the reason the crew comes home: you patch bodies back together mid-job.",
  media: "Plays like: the truth as a crowbar: you dig up what people hide and make it public.",
  exec: "Plays like: playing the corporation itself: money, staff, and favors instead of a gun.",
  lawman: "Plays like: the badge in a lawless city: authority, backup, and hard calls.",
  fixer: "Plays like: the one everybody calls: deals, contacts, and getting hold of the impossible.",
  nomad: "Plays like: wheels, family, and the open road: you move the crew and the cargo.",
};
