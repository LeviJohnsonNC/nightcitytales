/**
 * One-line self-description generation for the Identity step.
 *
 * Same shape as lifepathBackground: build a payload from what the player has
 * already decided, build a prompt in the house voice, and call the model
 * server-side so LOVABLE_API_KEY never reaches the browser.
 */
import { getLifepathTable } from "@/engine";
import { generateBackgroundFn } from "@/lib/background.functions";
import { withHouseStyle } from "@/lib/prose-style";
import { displayValue, readGeneralLifepath } from "./lifepathState";
import type { ChargenState } from "./store";

export type GenderRead = "female" | "male" | "non-binary" | "unspecified";

/** Gender read from the pronouns the player typed. Never a guess: custom text is unspecified. */
export function genderFromPronouns(pronouns: string): GenderRead {
  const p = pronouns.trim().toLowerCase().replace(/\s+/g, "");
  if (!p) return "unspecified";
  if (p === "she/her") return "female";
  if (p === "he/him") return "male";
  if (p === "they/them") {
    return "non-binary";
  }
  return "unspecified";
}

export type SelfDescriptionInput = {
  name: string;
  handle: string;
  pronouns: string;
  gender: GenderRead;
  role: string | null;
  roleAbility: string | null;
  facts: { label: string; value: string }[];
};

/** Only the flavor tables that describe how someone reads at a glance. */
const GLANCE_TABLES = [
  "personality",
  "clothing_style",
  "hairstyle",
  "affectation",
  "value_most",
  "cultural_origin",
  "life_goals",
];

export function buildSelfDescriptionInput(
  state: ChargenState,
  roleName?: string,
): SelfDescriptionInput {
  const general = readGeneralLifepath(state.lifepath.general);
  const facts: { label: string; value: string }[] = [];
  for (const id of GLANCE_TABLES) {
    const entry = general.entries[id];
    if (entry) facts.push({ label: getLifepathTable(id).label, value: displayValue(entry) });
  }

  return {
    name: state.name.trim(),
    handle: state.handle.trim(),
    pronouns: state.pronouns.trim(),
    gender: genderFromPronouns(state.pronouns),
    role: roleName ?? null,
    roleAbility: state.roleAbility?.name ?? null,
    facts,
  };
}

/** Everything the button needs before it can be pressed. */
export function selfDescriptionMissing(state: ChargenState): string[] {
  const missing: string[] = [];
  if (!state.name.trim()) missing.push("name");
  if (!state.handle.trim()) missing.push("handle");
  if (!state.pronouns.trim()) missing.push("pronouns");
  if (!state.roleId) missing.push("a Role");
  return missing;
}

export function buildSelfDescriptionPrompt(input: SelfDescriptionInput): {
  system: string;
  user: string;
} {
  const task = [
    "You are the Game Master for a Cyberpunk RED campaign in Night City.",
    "Write ONE sentence: how this character reads at a glance to a stranger on The Street.",
    "Roughly 8 to 20 words. Present tense. Third person, unless the character's own swagger is better served otherwise.",
    "Use the given pronouns and gender read naturally; never make gender the subject of the line.",
    "Lean on the concrete flavor given: look, style, attitude, Role. Do not invent game mechanics, STATs, gear, or rules.",
    "Return only the sentence: no quotation marks, no preamble, no label, no list.",
  ].join(" ");

  return {
    system: withHouseStyle(task),
    user: [
      JSON.stringify(input, null, 2),
      `\nSession seed (use only to vary phrasing, never mention it): ${Math.random().toString(36).slice(2, 10)}`,
    ].join("\n"),
  };
}

export async function generateSelfDescription(input: SelfDescriptionInput): Promise<string> {
  const { text } = await generateBackgroundFn({ data: buildSelfDescriptionPrompt(input) });
  return text.trim().replace(/^["“]|["”]$/g, "");
}
