/**
 * The system prompts for generated chargen prose, held on the server.
 *
 * These used to be built in the browser and sent up with the request, which
 * made `generateBackgroundFn` a general-purpose language model wearing a
 * chargen costume: whoever called it chose what the model was. The client now
 * names a JOB from the closed list below and supplies only the facts; what the
 * model is told to be is decided here.
 *
 * That is the same ruling the rest of the project runs on — the caller picks
 * from a vocabulary the server owns rather than authoring the instruction — and
 * it is what keeps `prose-style.ts` the single source of house voice, since
 * nothing reaching the model can now skip it.
 *
 * Imported lazily by the handler, so this text and the house style it wraps
 * stay out of the client bundle. The job NAMES live in background.jobs.ts,
 * which is the half the browser is allowed to know.
 */
import type { BackgroundJob } from "./background.jobs";
import { withHouseStyle } from "./prose-style";

const LIFEPATH_BACKGROUND = [
  "You are the Game Master for a Cyberpunk RED campaign in Night City.",
  "Write a character background from the structured Lifepath facts in the user message.",
  "Weave ALL of the given facts in naturally: origins, family, childhood, crises, personality, values, style, language, friends, enemies and their grudges, tragic loves, Role, Role answers, and life goal.",
  "Do not invent game mechanics, STATs, cyberware, skills, or rules; narrative color only.",
  "Use second person, present tense.",
  "Structure: at least 3 paragraphs, 300 to 450 words total. Paragraph one covers where you came from, family, and childhood. Paragraph two covers the turn or crisis that made you who you are. Paragraph three covers the people who matter, friends, enemies, and any tragic love. A final short paragraph lands on where you stand now as your Role and what you are chasing.",
  "Separate paragraphs with a blank line.",
  "Make each telling distinct: vary the opening beat, the specifics you dwell on, and the closing line.",
  "Return only the background prose, with no preamble, headings, labels, or surrounding quotation marks.",
].join(" ");

const SELF_DESCRIPTION = [
  "You are the Game Master for a Cyberpunk RED campaign in Night City.",
  "Write ONE sentence: how this character reads at a glance to a stranger on The Street.",
  "Roughly 8 to 20 words. Present tense. Third person, unless the character's own swagger is better served otherwise.",
  "Use the given pronouns and gender read naturally; never make gender the subject of the line.",
  "Lean on the concrete flavor given: look, style, attitude, Role. Do not invent game mechanics, STATs, gear, or rules.",
  "Return only the sentence: no quotation marks, no preamble, no label, no list.",
].join(" ");

const TASKS: Record<BackgroundJob, string> = {
  lifepath_background: LIFEPATH_BACKGROUND,
  self_description: SELF_DESCRIPTION,
};

/** The system prompt for a job, in the house voice. */
export function systemPromptFor(job: BackgroundJob): string {
  return withHouseStyle(TASKS[job]);
}
