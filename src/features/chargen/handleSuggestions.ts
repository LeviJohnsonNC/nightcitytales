/**
 * Handle suggestions for the Identity step.
 *
 * The handle is the name the whole game will call the character by, and a
 * blank box at the end of an hour of answers is a hard place to invent one.
 * The model is asked for five, from what the character already is: Role, how
 * they work, their best STAT, their look and their past. The player picks one
 * or ignores them; nothing is written until they choose.
 *
 * Same shape as selfDescription: the facts are built here, the instruction
 * lives server-side (background.prompts.ts, job `handle_suggestions`).
 */
import { STAT_ORDER, getLifepathTable, matchingPreset } from "@/engine";
import { generateBackgroundFn } from "@/lib/background.functions";
import { displayValue, readGeneralLifepath } from "./lifepathState";
import type { ChargenState } from "./store";

export type HandleInput = {
  role: string | null;
  roleAbility: string | null;
  worksAs: string | null;
  bestStat: string | null;
  facts: { label: string; value: string }[];
};

const HANDLE_TABLES = [
  "personality",
  "clothing_style",
  "hairstyle",
  "affectation",
  "family_crisis",
  "life_goals",
];

/** How many suggestions the screen shows. */
export const HANDLE_SUGGESTION_COUNT = 5;

export function buildHandleInput(state: ChargenState, roleName?: string): HandleInput {
  const general = readGeneralLifepath(state.lifepath.general);
  const facts: { label: string; value: string }[] = [];
  for (const id of HANDLE_TABLES) {
    const entry = general.entries[id];
    if (entry) facts.push({ label: getLifepathTable(id).label, value: displayValue(entry) });
  }
  const preset =
    state.roleId && state.method && state.method !== "streetrat" && state.skills.length
      ? matchingPreset({ method: state.method, roleId: state.roleId, entries: state.skills })
      : null;
  const ranked = STAT_ORDER.filter((s) => typeof state.stats[s] === "number").sort(
    (a, b) => (state.stats[b] as number) - (state.stats[a] as number),
  );
  return {
    role: roleName ?? null,
    roleAbility: state.roleAbility?.name ?? null,
    worksAs: preset?.name ?? null,
    bestStat: ranked[0]?.toUpperCase() ?? null,
    facts,
  };
}

/**
 * The model's reply, cleaned into handles: one per line, bullets, numbering
 * and quotation marks stripped, anything that is not a short name dropped, no
 * repeats, and never the character's own legal name.
 */
export function parseHandles(text: string, legalName = ""): string[] {
  const legal = legalName.trim().toLowerCase();
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const handle = raw
      .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
      .replace(/^["“'‘]+|["”'’]+$/g, "")
      .trim();
    if (!handle || handle.length > 24 || handle.split(/\s+/).length > 3) continue;
    if (/[:.!?]$/.test(handle)) continue;
    if (legal && handle.toLowerCase() === legal) continue;
    if (out.some((h) => h.toLowerCase() === handle.toLowerCase())) continue;
    out.push(handle);
  }
  return out.slice(0, HANDLE_SUGGESTION_COUNT);
}

export async function suggestHandles(state: ChargenState, roleName?: string): Promise<string[]> {
  const input = buildHandleInput(state, roleName);
  const { text } = await generateBackgroundFn({
    data: {
      job: "handle_suggestions",
      user: [
        JSON.stringify(input, null, 2),
        `\nSession seed (use only to vary the suggestions, never mention it): ${Math.random().toString(36).slice(2, 10)}`,
      ].join("\n"),
    },
  });
  return parseHandles(text, state.name);
}
