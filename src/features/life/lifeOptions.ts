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

/** The standing business of where the character is, as option cards. */
export function venueOptions(input: {
  districtKey: string;
  placeKey?: string | undefined;
  places?: Record<string, PlaceState> | undefined;
}): LifeActionCard[] {
  return placeActions(input).map(toCard);
}

function toCard(action: PlaceAction): LifeActionCard {
  return {
    label: action.label,
    // The venue is named in the description rather than in the label, so an
    // engine card reads like the model's cards rather than like a menu row.
    description: `${action.description} ${action.here ? "Here." : `At ${action.placeName}.`}`,
    timeMinutes: action.minutes,
    knownCost: action.cost,
    skillId: null,
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
