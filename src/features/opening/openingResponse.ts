/**
 * What the model is allowed to say, and what we do with what it said.
 *
 * The wire schema is loose on purpose and the normalizer is strict: a model
 * that returns three doors, five doors, or the same door twice must produce a
 * playable opening rather than an exception on the player's first screen. The
 * doors are ours (engine/opening.ts), so they can always be reconstructed.
 *
 * The PROSE is the one thing that cannot be reconstructed. Empty prose is a
 * failed generation and is reported as one — the player retries rather than
 * being served a lesser opening, which is the call recorded in
 * docs/progression-and-first-play-plan.md.
 */
import { z } from "zod";
import {
  OPENING_CHOICES,
  OPENING_FALLBACK,
  isOpeningChoice,
  openingChoiceList,
  type OpeningChoice,
} from "@/engine";

export const OpeningWireSchema = z.object({
  title: z.string(),
  opening: z.string(),
  choices: z.array(
    z.object({
      choice: z.string(),
      label: z.string(),
      line: z.string(),
    }),
  ),
});

export type OpeningWire = z.infer<typeof OpeningWireSchema>;

export type OpeningDoor = {
  choice: OpeningChoice;
  label: string;
  line: string;
};

export type Opening = {
  title: string;
  /** The prose, already split into paragraphs. Never empty. */
  paragraphs: string[];
  doors: OpeningDoor[];
};

/** Thrown when the model returned no usable prose. The caller offers a retry. */
export class EmptyOpeningError extends Error {
  constructor() {
    super("The opening came back empty.");
    this.name = "EmptyOpeningError";
  }
}

/** Blank lines separate paragraphs; a single newline inside one is just wrap. */
export function paragraphsOf(prose: string): string[] {
  return prose
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/**
 * The model's answer, made safe to render.
 *
 * Every door is present exactly once and in the engine's order, whatever came
 * back: a door the model wrote is used, a door it forgot or mangled falls back
 * to the printed wording, and a door it invented is dropped.
 */
export function normalizeOpening(wire: OpeningWire): Opening {
  const paragraphs = paragraphsOf(wire.opening ?? "");
  if (paragraphs.length === 0) throw new EmptyOpeningError();

  const written = new Map<OpeningChoice, { label: string; line: string }>();
  for (const entry of wire.choices ?? []) {
    if (!isOpeningChoice(entry.choice)) continue;
    // First writing of a door wins, so a duplicate cannot overwrite a good one
    // with a worse one.
    if (written.has(entry.choice)) continue;
    const label = clean(entry.label);
    const line = clean(entry.line);
    if (!label) continue;
    written.set(entry.choice, { label, line: line || OPENING_FALLBACK[entry.choice].line });
  }

  const doors = openingChoiceList().map((choice) => ({
    choice,
    ...(written.get(choice) ?? OPENING_FALLBACK[choice]),
  }));

  const title = clean(wire.title);
  return {
    title: title || "Night City",
    paragraphs,
    doors,
  };
}

/** Every door the engine knows, for a caller that wants them without a model. */
export const ALL_DOORS: OpeningChoice[] = [...OPENING_CHOICES];
