/**
 * Second-person phrasing for the running biography. Presentation only —
 * no rules values live here, just the sentence each table's answer slots into.
 */
import type { LifepathEntryRecord } from "@/engine";
import { displayValue, type EnemyEntry, type GeneralLifepath } from "./lifepathState";

const SENTENCES: Record<string, (v: string) => string> = {
  cultural_origin: (v) => `You came up ${/^[AEIOU]/i.test(v) ? "in an" : "in"} ${v} world.`,
  personality: (v) => `You are ${lower(v)}.`,
  clothing_style: (v) => `You dress in ${lower(v)}.`,
  hairstyle: (v) => `Your hair is ${lower(v)}.`,
  affectation: (v) => `You are never without ${lower(v)}.`,
  value_most: (v) => `Above all else, you value ${lower(v)}.`,
  feel_about_people: (v) => `On other people: "${v}"`,
  most_valued_person: (v) => `The person who matters most to you is ${lower(v)}.`,
  most_valued_possession: (v) => `The thing you would never give up is ${lower(v)}.`,
  family_background: (v) => `Your family were ${lower(v)}.`,
  childhood_environment: (v) => `Growing up, you ${lower(v)}`,
  family_crisis: (v) => `Then it went wrong: ${lower(v)}`,
  life_goals: (v) => `What you want out of all this: ${lower(v)}`,
};

function lower(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

export function sentenceFor(entry: LifepathEntryRecord): string {
  const shape = SENTENCES[entry.tableId];
  const value = displayValue(entry);
  return shape ? shape(value) : value;
}

export function languageSentence(language: NonNullable<GeneralLifepath["language"]>): string {
  return `You speak ${language.value} at Rank ${language.rank}, free from your Cultural Origin.`;
}

export function friendSentence(entry: LifepathEntryRecord): string {
  return `One friend out there is ${lower(displayValue(entry))}`;
}

export function loveSentence(entry: LifepathEntryRecord): string {
  return `A love that ended: ${lower(displayValue(entry))}`;
}

export function enemySentences(enemy: EnemyEntry): string[] {
  const lines = [
    `You crossed ${lower(displayValue(enemy.who))}, and it started because ${lower(
      displayValue(enemy.cause),
    ).replace(/\.$/, "")}.`,
  ];
  if (enemy.injuredParty) {
    lines.push(
      enemy.injuredParty === "you"
        ? "You were the injured party."
        : "They were the injured party — this one is on you.",
    );
  }
  lines.push(`They can bring ${lower(displayValue(enemy.throwAtYou))}`);
  lines.push(`When you meet again, you will ${lower(displayValue(enemy.revenge))}`);
  return lines;
}
