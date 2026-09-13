/**
 * The first choice: what the character does with their first night.
 *
 * A closed vocabulary, for the same reason `OBSERVATIONS` is one. The model
 * writes how each option SOUNDS in this character's mouth; the engine owns what
 * each option DOES. Nothing the model returns can invent a fifth door, rename a
 * door, or make two doors lead to the same place.
 *
 * That split is what keeps the opening off the "fake agency" list in
 * PRODUCT.md — "no choices whose outcome is predetermined, and no suggestion
 * lists that are secretly the only legal moves". These four genuinely diverge:
 * one puts a job on the table, and the other three do not.
 *
 * Pure data and types. The feature layer applies them.
 */

export const OPENING_CHOICES = [
  "take_work",
  "see_someone",
  "walk_the_block",
  "handle_business",
] as const;

export type OpeningChoice = (typeof OPENING_CHOICES)[number];

export function isOpeningChoice(value: unknown): value is OpeningChoice {
  return typeof value === "string" && (OPENING_CHOICES as readonly string[]).includes(value);
}

/**
 * What each door actually does, in the engine's words.
 *
 * This text reaches the model so it knows what it is writing flavour FOR. It is
 * deliberately mechanical: the model should understand the consequence exactly,
 * and then never mention it.
 */
export const OPENING_MEANINGS: Record<OpeningChoice, string> = {
  take_work:
    "the character goes looking for paying work tonight, and finds some. A real job lands on the table as an offer they can question, argue over or turn down.",
  see_someone:
    "the character goes to see one specific person they already know, because something between them is unfinished.",
  walk_the_block:
    "the character stays on their own streets and pays attention to them. No plan, no appointment.",
  handle_business:
    "the character deals with their own life first: the rent, the debt, the thing that has been sitting there.",
};

/**
 * The fallback wording, used when the model returns nothing usable for a door.
 *
 * Never used for the opening PROSE — a failed generation is retried rather than
 * papered over, because the prose is the experience. A door's label is not: the
 * door exists whatever it is called, and a campaign that cannot start because
 * one label came back empty would be a worse answer than a plain one.
 */
export const OPENING_FALLBACK: Record<OpeningChoice, { label: string; line: string }> = {
  take_work: {
    label: "Find work tonight",
    line: "Somebody out there is paying. Go and be found.",
  },
  see_someone: {
    label: "Go see someone",
    line: "There is a conversation you have been putting off.",
  },
  walk_the_block: {
    label: "Walk your own streets",
    line: "No appointment. Just see what the block is doing.",
  },
  handle_business: {
    label: "Handle your own business",
    line: "Rent, debts, the thing on the counter. Deal with it.",
  },
};

/** Every door, in the order they should be offered. */
export function openingChoiceList(): OpeningChoice[] {
  return [...OPENING_CHOICES];
}
