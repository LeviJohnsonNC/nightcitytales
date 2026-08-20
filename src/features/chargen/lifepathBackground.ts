/**
 * Background generation for the Lifepath step.
 *
 * The player's structured Lifepath is the source of truth. This module turns it
 * into (a) a clean input payload, (b) the prompt we recommend sending to the
 * model, and (c) a text draft.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ SWAP POINT: `generateBackground` is currently a STUB that stitches the    │
 * │ facts into readable prose locally, with a simulated delay. Replace ONLY   │
 * │ the body of `generateBackground` with a real model call. Keep the         │
 * │ signature `(input: BackgroundInput) => Promise<string>` and the UI needs  │
 * │ no changes. Use `buildBackgroundPrompt(input)` for the system/user text.  │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
import {
  getLifepathTable,
  getRoleLifepathOrder,
  getRoleLifepathTable,
  isRoleTableRevealed,
} from "@/engine";
import { SINGLE_LIFEPATH_TABLES, displayValue, type GeneralLifepath } from "./lifepathState";
import type { RoleLifepath } from "./roleLifepathState";

export type BackgroundEnemy = {
  who: string;
  cause: string;
  injuredParty: "you" | "them" | null;
  throwAtYou: string;
  revenge: string;
};

/** Everything the model needs, already resolved to the player's own wording. */
export type BackgroundInput = {
  role: string | null;
  roleAbility: string | null;
  facts: { label: string; value: string }[];
  language: string | null;
  friends: string[];
  enemies: BackgroundEnemy[];
  tragicLoves: string[];
  lifeGoal: string | null;
  roleAnswers: { label: string; value: string }[];
};

export function buildBackgroundInput(
  general: GeneralLifepath,
  roleLifepath: RoleLifepath,
  roleName?: string,
  roleAbilityName?: string,
): BackgroundInput {
  const facts: { label: string; value: string }[] = [];
  for (const id of SINGLE_LIFEPATH_TABLES) {
    if (id === "life_goals") continue;
    const entry = general.entries[id];
    if (entry) facts.push({ label: getLifepathTable(id).label, value: displayValue(entry) });
  }

  const goalEntry = general.entries["life_goals"];
  const roleId = roleLifepath.roleId;
  const roleAnswers = roleId
    ? getRoleLifepathOrder(roleId)
        .filter((tid) => isRoleTableRevealed(getRoleLifepathTable(roleId, tid), roleLifepath.entries))
        .map((tid) => {
          const entry = roleLifepath.entries[tid];
          if (!entry) return null;
          return {
            label: getRoleLifepathTable(roleId, tid).label.replace(/\?$/, ""),
            value: displayValue(entry),
          };
        })
        .filter((x): x is { label: string; value: string } => x !== null)
    : [];

  return {
    role: roleName ?? null,
    roleAbility: roleAbilityName ?? null,
    facts,
    language: general.language ? general.language.value : null,
    friends: general.friends.map(displayValue),
    enemies: general.enemies.map((e) => ({
      who: displayValue(e.who),
      cause: displayValue(e.cause),
      injuredParty: e.injuredParty,
      throwAtYou: displayValue(e.throwAtYou),
      revenge: displayValue(e.revenge),
    })),
    tragicLoves: general.tragicLove.map(displayValue),
    lifeGoal: goalEntry ? displayValue(goalEntry) : null,
    roleAnswers,
  };
}

/** The prompt we recommend for the real model call. Shared, so behavior matches. */
export function buildBackgroundPrompt(input: BackgroundInput): { system: string; user: string } {
  const system = [
    "You are the Game Master for a Cyberpunk RED campaign set in Night City.",
    "Write a character background from the structured Lifepath facts the player provides.",
    "Voice: second person, present tense, gritty neon-noir with style and swagger, morally gray, never grimdark for its own sake.",
    "Weave ALL of the given facts in naturally. Do not invent game mechanics, STATs, cyberware, or rules; only narrative color.",
    "Length: 2 short paragraphs, about 120 to 180 words total. Cinematic but not purple.",
    "Do not use em-dashes. Use commas, colons, or periods instead.",
    "Return only the background prose, with no preamble, headings, or quotation marks around it.",
  ].join(" ");

  const user = JSON.stringify(input, null, 2);
  return { system, user };
}

/**
 * Real model call. Runs server-side: the browser only sends the prompt pair,
 * and the API key never reaches it. Throws on failure so the panel's error
 * state renders.
 */
export async function generateBackground(input: BackgroundInput): Promise<string> {
  const { system, user } = buildBackgroundPrompt(input);
  const { text } = await generateBackgroundFn({ data: { system, user } });
  return text.trim();
}
