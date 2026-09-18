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

export const OPENING_CHOICES = ["take_work", "see_someone", "just_living", "role_action"] as const;

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
  just_living:
    "the character stays home for the night, no plan and no appointment, and the game shows them their own life as it actually stands right now: the apartment, what they own, what they owe.",
  role_action:
    "the character does one small thing tonight that only someone with their training and instincts would think to do — not a job, no client, no pay, just the kind of move their Role makes without thinking about it.",
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
  just_living: {
    label: "Stay home tonight",
    line: "No plan. Just your own four walls and what's actually in them.",
  },
  role_action: {
    label: "Do the thing you're good at",
    line: "Not a job. Just the kind of move you make without thinking.",
  },
};

/** Every door, in the order they should be offered. */
export function openingChoiceList(): OpeningChoice[] {
  return [...OPENING_CHOICES];
}
