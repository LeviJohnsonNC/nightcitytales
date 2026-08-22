/**
 * Portrait generation input and prompt.
 *
 * The player never writes the image prompt. It is assembled from what the
 * character already is: Role, pronouns and the gender read from them, and the
 * Lifepath glance facts already rolled. One house look constant lives here so
 * every character in the roster comes out of the same art department.
 */
import { getLifepathTable } from "@/engine";
import { displayValue, readGeneralLifepath } from "./lifepathState";
import { genderFromPronouns, type GenderRead } from "./selfDescription";
import { stepsFor } from "./steps";
import { validateStep } from "./validation";
import type { ChargenState } from "./store";

export const MAX_PORTRAIT_TAKES = 4;
export const MAX_PORTRAIT_GENERATIONS = 6;

export type PortraitFacts = {
  handle: string;
  pronouns: string;
  gender: GenderRead;
  role: string | null;
  roleAbility: string | null;
  facts: { label: string; value: string }[];
  selfDescription: string;
};

/** Lifepath tables that describe how someone looks, not what they have done. */
const LOOK_TABLES = [
  "personality",
  "clothing_style",
  "hairstyle",
  "affectation",
  "cultural_origin",
];

export function buildPortraitFacts(state: ChargenState, roleName?: string): PortraitFacts {
  const general = readGeneralLifepath(state.lifepath.general);
  const facts: { label: string; value: string }[] = [];
  for (const id of LOOK_TABLES) {
    const entry = general.entries[id];
    if (entry) facts.push({ label: getLifepathTable(id).label, value: displayValue(entry) });
  }
  return {
    handle: state.handle.trim(),
    pronouns: state.pronouns.trim(),
    gender: genderFromPronouns(state.pronouns),
    role: roleName ?? null,
    roleAbility: state.roleAbility?.name ?? null,
    facts,
    selfDescription: state.selfDescription.trim(),
  };
}

const HOUSE_LOOK = [
  "Waist-up character portrait of a single person, facing the camera, 3:4 framing, head and shoulders filling the frame.",
  "Grainy photographic realism, shot like a street photojournalist's flash portrait at night in Night City.",
  "Moody practical lighting: neon signage, sodium streetlight and screen glow, deep shadow, wet asphalt reflections behind them.",
  "Grounded near-future 2045 cyberpunk styling: worn synthetic fabrics, visible cybernetics only where it fits the description, lived-in and specific, not costume-shop chrome.",
  "No text, no logos, no watermarks, no captions, no weapons aimed at the camera, no collage, no multiple people, no anime styling.",
].join(" ");

/** The exact prompt sent to the image model. */
export function buildPortraitPrompt(facts: PortraitFacts): string {
  const lines: string[] = [HOUSE_LOOK, ""];
  lines.push("Subject:");
  if (facts.role) lines.push(`- Occupation on The Street: ${facts.role}`);
  if (facts.roleAbility) lines.push(`- Known for: ${facts.roleAbility}`);
  lines.push(`- Presents as: ${genderPhrase(facts.gender)} (pronouns ${facts.pronouns || "n/a"})`);
  for (const f of facts.facts) lines.push(`- ${f.label}: ${f.value}`);
  if (facts.selfDescription) lines.push(`- Reads at a glance as: ${facts.selfDescription}`);
  lines.push("");
  lines.push(
    "Render exactly the person described. Do not add gear, tattoos, or cybernetics that were not described.",
  );
  return lines.join("\n");
}

function genderPhrase(gender: GenderRead): string {
  switch (gender) {
    case "female":
      return "a woman";
    case "male":
      return "a man";
    case "non-binary":
      return "androgynous, non-binary presentation";
    default:
      return "gender unspecified, ambiguous presentation";
  }
}

/**
 * Everything still missing before a portrait can be generated: the identity
 * fields, plus every earlier required step of the wizard passing its own
 * validation. Self-description stays optional.
 */
export function portraitMissing(state: ChargenState): string[] {
  const missing: string[] = [];
  if (!state.name.trim()) missing.push("name");
  if (!state.handle.trim()) missing.push("handle");
  if (!state.pronouns.trim()) missing.push("pronouns");

  const ids = stepsFor(state.method);
  for (const step of ids) {
    if (step.id === "identity" || step.id === "review") continue;
    // Only actual rule violations block a portrait. Steps where buying
    // nothing is legal (Gear & Armor, Cyberware) must not gate on "untouched".
    const { violations } = validateStep(step.id, state);
    if (violations.length > 0) missing.push(step.title);
  }
  return [...new Set(missing)];
}
