/**
 * UI copy ONLY. Nothing here is a Cyberpunk RED rules value: every number a
 * player acts on is read from /src/data/rules/. These strings are orientation
 * text for the wizard, written in the house voice (see src/lib/prose-style.ts).
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
    headline: "Fastest way onto The Street. Roll once, you're done.",
    body: "One roll of 1d10 hands you a whole pre-built STAT row, no haggling. Skills, guns, armor, and chrome all come pre-set for your Role, straight off the rack. You still walk the full Lifepath, and you still pocket 500eb to spend however you please.",
    choice: "Low",
    time: "~5 minutes",
  },
  {
    id: "edgerunner",
    headline: "Rolled STATs, your call on the Skills.",
    body: "You roll 1d10 per STAT against your Role's table and live with what the dice give you. The Skills are yours, though: 86 points to spread across your Role's 20 Skills however you see fit. Gear's pre-set, plus 500eb in your pocket.",
    choice: "Medium",
    time: "~15 minutes",
  },
  {
    id: "complete_package",
    headline: "Total control. Build the exact edgerunner you want.",
    body: "62 points to buy your STATs, 86 Skill Points for any Skills you like, and 2,550eb to work the Night Market yourself. On top of that, 800eb that only burns on Fashion and Fashionware, because looking good is part of the job.",
    choice: "Total",
    time: "~40 minutes",
  },
];

/** Playstyle line per Role, in the house voice. Flavor guidance, not mechanics. */
export const ROLE_PLAYS_LIKE: Record<string, string> = {
  rockerboy:
    "Plays like: the crowd is your weapon. Talk, play, and turn a room full of strangers into your movement.",
  solo: "Plays like: the one who walks out. You read the fight before it starts and end it before it's fair.",
  netrunner:
    "Plays like: a second game inside the game. You jack into the NET while the crew holds the meat world.",
  tech: "Plays like: the one who makes the broken work. Build it, fix it, upgrade it past what the manual allows.",
  medtech:
    "Plays like: the reason the crew comes home. You put bodies back together mid-job, no questions asked.",
  media:
    "Plays like: the truth as a crowbar. You dig up what the Corps bury and put it on every screen in the city.",
  exec: "Plays like: running the corporation instead of robbing it. Money, staff, and favors do your fighting.",
  lawman:
    "Plays like: the badge in a city that eats badges. Authority, backup, and calls nobody else will make.",
  fixer:
    "Plays like: the number everyone has saved. Deals, contacts, and getting hold of the impossible for a cut.",
  nomad:
    "Plays like: wheels, family, and open road. You move the crew and the cargo, and you always know the way out.",
};
