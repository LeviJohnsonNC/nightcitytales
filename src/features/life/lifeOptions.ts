/**
 * What the player is offered when they ask what they could do.
 *
 * Life has no menu. The scene says what is there and what to do about it is the
 * player's problem — options exist only behind a button, and asking for them
 * costs nothing. That was the design and it had quietly stopped being true: the
 * same `placeActions` that feed the model's context were ALSO drawn as a
 * permanent "here you can" strip, so the standing business of the district sat
 * on screen at all times and the model, handed that list as context, answered
 * "what could I do" by reading it back. Two surfaces, one source, guaranteed
 * duplication.
 *
 * So the two are one surface now, and they divide by kind:
 *
 *  - The MODEL writes what is live. Somebody is at the door, the kid's inverter
 *    is still in pieces, the room has gone quiet. It knows what just happened
 *    and the engine does not.
 *
 *  - The ENGINE offers the standing business of the venues. Eat, drink, buy,
 *    take a room, look in on the neighbours. It knows what is really there, at
 *    what price, and the model does not get to invent either.
 *
 * Both arrive as the same card and are not marked apart, which is only honest
 * because the numbers on both are enforced: whichever card is picked, the turn
 * costs the minutes it printed and spends the eurobucks it printed. A card that
 * advertised one price and charged another would be the worst smell in the
 * codebase, and before this both kinds did exactly that.
 *
 * Pure: cards in, cards out, no React and no network.
 */
import { placeActions, type PlaceAction, type PlaceState } from "@/engine";
import type { LifeActionCard } from "./lifeResponse";

/**
 * How many options a single ask may put on the board.
 *
 * Six. The engine caps what a district offers at five and what can be happening
 * in it at two, for the same reason: a board that lists everything conceivable
 * is a quest log, and the player stops reading quest logs.
 */
export const MAX_LIFE_OPTIONS = 6;

/**
 * The standing business of where the character is, as option cards.
 *
 * `localExpertLevel` decides whether the quiet doors of the district are among
 * them. A stranger is offered what a stranger would find; somebody who knows
 * this neighbourhood is also offered the fence, the unlicensed surgery and the
 * bunk nobody writes your name down for — which is the first time in the loop
 * that being a local changes what the player can DO rather than what they know.
 */
export function venueOptions(input: {
  districtKey: string;
  placeKey?: string | undefined;
  places?: Record<string, PlaceState> | undefined;
  localExpertLevel?: number | undefined;
  /** Whether what they have found here adds up to something not yet worked out. */
  conclusionAvailable?: boolean | undefined;
}): LifeActionCard[] {
  const actions = placeActions(input);
  // Ordered for the card strip, which is shorter than this list and trims from
  // the end. What is in front of the character comes first, then the quiet
  // doors of a neighbourhood they know — the rarest thing here and the one the
  // cap has swallowed before — then the ways of looking at where they are, then
  // the ordinary verbs of buildings down the road.
  const rank = (action: PlaceAction): number => {
    if (action.here && !action.skillId) return 0;
    if (action.local) return 1;
    if (action.skillId) return 2;
    return 3;
  };
  return actions
    .map((action, index) => ({ action, index }))
    .sort((a, b) => rank(a.action) - rank(b.action) || a.index - b.index)
    .map(({ action }) => toCard(action));
}

/**
 * What a picked card sends as the player's turn.
 *
 * A card tagged with a Skill is a check somebody already has in mind, so
 * clicking it must not degrade into prose the model may narrate away. Without
 * this the approach cards were a promise nothing kept: the card printed
 * "Perception: 14" and a pink border, and picking it sent "Look closer. Slow
 * down and go over the place properly." as plain text — which the model was
 * free to answer with a paragraph about looking around, rolling nothing, and
 * the whole truth system sat there unconsulted.
 *
 * The same fix reaches the model's own tagged cards, which were losing their
 * Skill the same way. It mirrors `suggestionInput` on the job screen; the DV is
 * deliberately not named, because the difficulty belongs to whatever is there
 * to be found and the engine is the one that knows.
 */
export function cardInput(card: LifeActionCard): string {
  const said = `${card.label}. ${card.description}`.trim();
  if (!card.skillId) return said;
  return (
    `${said}\n(ENGINE: this action leans on ${card.skillId}. Propose a skill_check with that ` +
    "skillId and a DV from the published table, and stop. Do not decide what it turns up.)"
  );
}

function toCard(action: PlaceAction): LifeActionCard {
  return {
    label: action.label,
    // The venue is named in the description rather than in the label, so an
    // engine card reads like the model's cards rather than like a menu row.
    description: `${action.description} ${action.here ? "Here." : `At ${action.placeName}.`}`,
    timeMinutes: action.minutes,
    knownCost: action.cost,
    // Set for an APPROACH — a way of looking rather than a thing to do — which
    // makes the card print the Skill and the number the character would add,
    // the same as a card the model tagged.
    skillId: action.skillId ?? null,
  };
}

/** Everything a card mentions, flattened for comparison. */
function textOf(card: LifeActionCard): string {
  return `${card.label} ${card.description}`.toLowerCase();
}

/**
 * The model's options, then the engine's, capped.
 *
 * The engine yields where the model has already been. An option the model wrote
 * that names a venue is about that venue, so offering the engine's generic verb
 * for the same place beside it is the duplication this module exists to remove —
 * and it is the model's card that survives, because it was written for tonight
 * rather than for any evening.
 *
 * The prompt also asks the model not to repeat the standing business. This is
 * the belt to that pair of braces: prompts are guidance and the board has to be
 * right whether or not the model listened.
 */
export function mergeOptions(
  model: LifeActionCard[],
  venue: LifeActionCard[],
  venueNames: string[] = [],
): LifeActionCard[] {
  // No menu unless one was asked for. An ordinary turn returns no options, and
  // the standing business of the district must not quietly reinstate the strip
  // on its own — which is the whole thing this change removed.
  if (!model.length) return [];

  const modelText = model.map(textOf).join(" ");
  const taken = new Set(model.map((c) => c.label.toLowerCase().trim()));

  const spoken = venueNames.filter((name) => name && modelText.includes(name.toLowerCase()));

  const fill = venue.filter((card) => {
    if (taken.has(card.label.toLowerCase().trim())) return false;
    // A venue the model has already written about is the model's to describe.
    return !spoken.some((name) => textOf(card).includes(name.toLowerCase()));
  });

  return [...model, ...fill].slice(0, MAX_LIFE_OPTIONS);
}
