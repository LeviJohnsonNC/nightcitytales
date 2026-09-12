/**
 * One-line self-description generation for the Identity step.
 *
 * Same shape as lifepathBackground: build a payload from what the player has
 * already decided, build a prompt in the house voice, and call the model
 * server-side so LOVABLE_API_KEY never reaches the browser.
 */
import { getLifepathTable } from "@/engine";
import { generateBackgroundFn } from "@/lib/background.functions";
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

/**
 * The FACTS sent to the model. The instruction half is applied server-side
 * from src/lib/background.prompts.ts — see buildBackgroundUserPrompt.
 */
export function buildSelfDescriptionUserPrompt(input: SelfDescriptionInput): string {
  return [
    JSON.stringify(input, null, 2),
    `\nSession seed (use only to vary phrasing, never mention it): ${Math.random().toString(36).slice(2, 10)}`,
  ].join("\n");
}

export async function generateSelfDescription(input: SelfDescriptionInput): Promise<string> {
  const { text } = await generateBackgroundFn({
    data: { job: "self_description", user: buildSelfDescriptionUserPrompt(input) },
  });
  return text.trim().replace(/^["“]|["”]$/g, "");
}
