/**
 * The four numbers a character's STATs make, explained.
 *
 * House voice over rules that live elsewhere: every number and every effect in
 * here is read from `deriveStats` and `creation-rules.json`, never typed. What
 * this file owns is the telling: what the number is, what it costs you at the
 * table, and which STATs to lean on to move it.
 */
import { HUMANITY_RULES, WOUND_STATES, deriveStats } from "@/engine";
import type { StatBlock } from "@/engine";

export type DerivedKey = "hp" | "seriously" | "death" | "humanity";

export type DerivedBriefing = {
  title: string;
  /** The formula, with this character's numbers worked through. */
  yours: string;
  /** Paragraphs, plainest first. */
  body: string[];
  /** Which STATs move it, and how far. */
  movedBy: string;
};

const wound = (name: string) => {
  const found = WOUND_STATES.find((w) => w.state === name);
  if (!found) throw new Error(`No wound state "${name}" in creation-rules.json`);
  return found;
};

/** The first clause of a wound state's printed effect: the penalty, without the small print. */
const penalty = (effect: string) => effect.split(";")[0]!.trim();

export const DERIVED_KEYS: DerivedKey[] = ["hp", "seriously", "death", "humanity"];

export const DERIVED_TITLES: Record<DerivedKey, string> = {
  hp: "Hit Points",
  seriously: "Seriously Wounded",
  death: "Death Save",
  humanity: "Humanity",
};

export function derivedBriefing(key: DerivedKey, stats: StatBlock): DerivedBriefing {
  const d = deriveStats(stats);
  const serious = wound("Seriously Wounded");
  const mortal = wound("Mortally Wounded");
  switch (key) {
    case "hp":
      return {
        title: DERIVED_TITLES.hp,
        yours: `10 + 5 × ⌈(${stats.body} + ${stats.will}) / 2⌉ = ${d.hpMax}`,
        body: [
          "This is how much of the city you can absorb before you stop being a problem for someone. Every bullet, blade and fall takes points off it, and armor only decides how many get through.",
          `Fall below 1 and you are ${mortal.state}: ${penalty(mortal.effect)}, and a Death Save at the start of every Turn. That is the edge. Everything before it is just getting there.`,
          "You heal it back with rest, medtech and money, in that order of how much you will have.",
        ],
        movedBy:
          "BODY and WILL, added together. Every two points between them buys five Hit Points, and an odd total rounds up, so one lone point on top of an even pair still buys the five.",
      };
    case "seriously":
      return {
        title: DERIVED_TITLES.seriously,
        yours: `⌈${d.hpMax} / 2⌉ = ${d.seriouslyWoundedThreshold}`,
        body: [
          `The line where a fight stops costing you blood and starts costing you skill. Below ${d.seriouslyWoundedThreshold} Hit Points you are ${serious.state}: ${serious.effect} until you are healed back over the line.`,
          `Stabilizing it is a check at DV ${serious.stabilizationDV}. It is the number a medic hears before they say anything else.`,
          "It is always half your Hit Points, rounded up. You do not buy it. You buy the Hit Points and it comes with them.",
        ],
        movedBy:
          "Nothing on its own. Raise Hit Points with BODY and WILL and this line moves up with them.",
      };
    case "death":
      return {
        title: DERIVED_TITLES.death,
        yours: `BODY = ${d.deathSave}`,
        body: [
          `When you are ${mortal.state}, you roll a d10 at the start of every one of your Turns. Roll under your Death Save and you hold on. Roll equal or over, and you are dead.`,
          "There is no armor for it and no Skill to lean on. It is your body deciding, and every hit you take while you are down makes the next roll harder.",
          "A high number is a second chance. A low one is a sentence with a delay on it.",
        ],
        movedBy: "BODY, one for one. It is the only number on this page that is exactly a STAT.",
      };
    case "humanity":
      return {
        title: DERIVED_TITLES.humanity,
        yours: `EMP × 10 = ${d.humanityMax}`,
        body: [
          "What is left of you that is still a person. Chrome costs it: every implant takes a slice, and so does the kind of night that a person is not supposed to walk away from.",
          `Every ten you lose takes a point off your EMP, so the people you love get harder to read before you notice. Drop below ${HUMANITY_RULES.cyberpsychosisThreshold} and you go over: cyberpsychosis.`,
          "Empty is not a warning, it is a door. The rules print no gentle stage in between.",
        ],
        movedBy: "EMP, ten for one. Chrome eats it later.",
      };
  }
}
