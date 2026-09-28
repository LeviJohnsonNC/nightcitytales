/**
 * The fixer interview: who is asking, and what they say on each step.
 *
 * Character creation is told as a meet. The player picks which of the fixers
 * dealt for them they are here to see (engine `fixerCandidates`), that fixer
 * asks every question the wizard asks, reacts to the Role, and closes the file
 * with a verdict — and then turns up in the campaign as the character's fixer,
 * because the pick rides the cast plan into `generateCast`.
 *
 * Every line is written by hand, in each fixer's own voice, from their bio.
 * Presentation copy only: no rules values, no numbers. A test holds every
 * fixer to a line for every step and every Role.
 */
import data from "@/data/cast/fixer-interview.json";
import type { ChargenStep } from "./steps";

export type FixerVoice = {
  /** Where the meet happens. */
  where: string;
  /** The uploaded backdrop of that place, by file name (docs/art-style.md). */
  venue: string;
  /** Why you would pick them, in one line. */
  pitch: string;
  /** What they say when you sit down. */
  greeting: string;
  /** The question on each step. */
  ask: Partial<Record<ChargenStep, string>>;
  /** Their reaction to the Role the character picks. */
  roles: Record<string, string>;
  /** Their reaction to the terms the character picks, by creation method. */
  methods: Record<string, string>;
  /** How they close the file. */
  verdict: string;
  /** How they open each chapter of the Lifepath. */
  chapters: Record<LifepathChapterId, string>;
};

/** The chapters the Lifepath is asked in. */
export type LifepathChapterId = "origin" | "self" | "people" | "drive" | "work";

const VOICES = (data as unknown as { fixers: Record<string, FixerVoice> }).fixers;

/** Every fixer with a voice. */
export const INTERVIEW_FIXERS: string[] = Object.keys(VOICES);

/** The steps a fixer has a question for: everything but the meet itself. */
export const INTERVIEW_STEPS: ChargenStep[] = [
  "role",
  "method",
  "lifepath",
  "stats",
  "skills",
  "package",
  "gear",
  "cyberware",
  "lifestyle",
  "identity",
  "review",
];

export function fixerVoice(name: string | null | undefined): FixerVoice | null {
  return name ? (VOICES[name] ?? null) : null;
}

/**
 * What the fixer says on this step, given where the character is.
 *
 * On the Role step the question gives way to their reaction once a Role is
 * picked: the point of asking was to hear the answer.
 */
export function fixerSays(
  name: string | null | undefined,
  step: ChargenStep,
  roleId: string | null,
): string | null {
  const voice = fixerVoice(name);
  if (!voice) return null;
  if (step === "fixer") return voice.greeting;
  if (step === "role" && roleId && voice.roles[roleId]) return voice.roles[roleId];
  return voice.ask[step] ?? null;
}

/** The fixer's reaction to the terms the character picked, or null. */
export function fixerMethodReaction(
  name: string | null | undefined,
  method: string | null,
): string | null {
  if (!method) return null;
  return fixerVoice(name)?.methods[method] ?? null;
}

/** What the fixer says opening a chapter of the Lifepath. */
export function fixerChapterLine(
  name: string | null | undefined,
  chapter: LifepathChapterId,
): string | null {
  return fixerVoice(name)?.chapters[chapter] ?? null;
}

/** The fixer's surname or handle, for tight spaces: "Tally", "Achebe", "Kit". */
export function fixerShortName(name: string): string {
  const quoted = /"([^"]+)"/.exec(name);
  if (quoted) return quoted[1]!;
  const parts = name.trim().split(/\s+/);
  return parts[0] ?? name;
}
