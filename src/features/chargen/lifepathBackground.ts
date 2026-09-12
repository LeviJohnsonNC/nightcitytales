/**
 * Background generation for the Lifepath step.
 *
 * The player's structured Lifepath is the source of truth. This module turns it
 * into (a) a clean input payload, (b) the prompt, and (c) the model call.
 *
 * The model call runs server-side via `generateBackgroundFn`, so LOVABLE_API_KEY
 * never reaches the browser. House voice comes from `@/lib/prose-style`.
 */
import {
  getLifepathTable,
  getRoleLifepathOrder,
  getRoleLifepathTable,
  isRoleTableRevealed,
} from "@/engine";
import { generateBackgroundFn } from "@/lib/background.functions";
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
        .filter((tid) =>
          isRoleTableRevealed(getRoleLifepathTable(roleId, tid), roleLifepath.entries),
        )
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

/**
 * The FACTS sent to the model. The instruction half is not built here: the
 * system prompt for this job lives in src/lib/background.prompts.ts and is
 * applied server-side, so the browser cannot choose what the model is.
 */
export function buildBackgroundUserPrompt(input: BackgroundInput): string {
  return [
    JSON.stringify(input, null, 2),
    `\nSession seed (use only to vary phrasing, never mention it): ${Math.random().toString(36).slice(2, 10)}`,
  ].join("\n");
}

/**
 * Real generation. Calls the Lovable AI gateway through a server function so
 * the API key never reaches the browser. Errors propagate to the UI on purpose:
 * we never fall back to canned prose.
 */
export async function generateBackground(input: BackgroundInput): Promise<string> {
  const { text } = await generateBackgroundFn({
    data: { job: "lifepath_background", user: buildBackgroundUserPrompt(input) },
  });
  return text.trim();
}
