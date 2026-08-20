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

// ---------------------------------------------------------------------------
// STUB. Replace the body below with a real model call (see header). The UI
// only depends on this signature.
// ---------------------------------------------------------------------------
export async function generateBackground(input: BackgroundInput): Promise<string> {
  await delay(900); // simulate a fast model call

  const lower = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
  const factBy = (needle: string) =>
    input.facts.find((f) => f.label.toLowerCase().includes(needle))?.value;

  const origin = factBy("cultural");
  const family = factBy("family background") ?? factBy("family");
  const childhood = factBy("childhood");
  const crisis = factBy("crisis");
  const personality = factBy("personality");
  const value = factBy("value");
  const style = factBy("clothing") ?? factBy("style");

  const open: string[] = [];
  if (origin) open.push(`You came up in ${lower(origin)}.`);
  if (family) open.push(`Your people were ${lower(family)}.`);
  if (childhood) open.push(`You spent your early years ${lower(childhood)}.`);
  if (crisis) open.push(`Then it all tilted: ${lower(crisis)}.`);
  if (personality) open.push(`You carry yourself ${lower(personality)},`);
  if (value) open.push(`and above all else you value ${lower(value)}.`);
  if (style) open.push(`On The Street they know you by ${lower(style)}.`);

  const second: string[] = [];
  if (input.language) second.push(`You keep ${input.language} on your tongue.`);
  if (input.friends.length) second.push(`You have people who have your back.`);
  for (const e of input.enemies) {
    second.push(`You crossed ${lower(e.who)}, and now they want ${lower(e.revenge)}.`);
  }
  if (input.tragicLoves.length) second.push(`A love ended badly, and it left a mark.`);
  if (input.role) {
    const roleBits = input.roleAnswers.slice(0, 2).map((a) => lower(a.value));
    second.push(
      roleBits.length
        ? `These days you run as a ${input.role}: ${roleBits.join(", ")}.`
        : `These days you run as a ${input.role}.`,
    );
  }
  if (input.lifeGoal) second.push(`What you want out of all of it: ${lower(input.lifeGoal)}.`);

  const p1 = open.join(" ").replace(/,\s*$/, ".");
  const p2 = second.join(" ");
  return [p1, p2].filter(Boolean).join("\n\n");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
