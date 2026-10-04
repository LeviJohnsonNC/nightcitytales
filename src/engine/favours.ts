/**
 * What the people of a place will do for somebody they have taken to.
 *
 * The goodwill dial has always moved: doing a place an actual service raises it,
 * costing it its peace lowers it, and at the top it sets `welcome` — and that was
 * the whole of it. A flag nobody could spend is a number with a story, which is
 * the failure `PRODUCT.md` calls a dial the player never meets. This is what the
 * goodwill is FOR: a place that is glad to see you will, once in a while, go
 * out on a limb.
 *
 * Three rules hold it.
 *
 *  - IT BUYS TIME, ACCESS AND A HAND, NEVER A DIE. A favour cannot raise a roll,
 *    lower a DV, set a price or settle an outcome. What it moves is something the
 *    engine already moves, through the function that already moves it: a day of
 *    rest's healing (`planRest`), the NCPD heat clock (`applyObservations`).
 *
 *  - IT COSTS WHAT IT IS WORTH. Goodwill is spent in dial segments, and a favour
 *    is only asked when it would leave at least one, so spending goodwill never
 *    turns a place against you — doing them wrong does that, and the engine
 *    already has a word for it. It does not regrow by itself.
 *
 *  - IT IS NOT AN ACCOUNT. One a day from any one place, and only where you are
 *    standing. They are doing you a kindness, not honouring a card.
 *
 * The dial stays hidden from the player. What they see is the place saying it
 * will, in words, and what it would do for them.
 *
 * Pure TypeScript: a place and a character's state in, the offers out.
 */
import data from "@/data/atlas/favours.json";
import { applyObservations, HEAT_CLOCK_KEY, type ObservationReport } from "./clocks";
import { planRest } from "./downtime";
import { districtOfPlace, getPlace } from "./geography";
import { heatMultiplier, tagsOf } from "./places";
import { hasFlag, spendDial, startingState, type PlaceState } from "./placeState";

export type FavourEffect = "patch" | "lay_low";

type FavourFile = {
  houseRule: boolean;
  requires: { flag: string; dial: string };
  perDay: number;
  layLowSegments: number;
  favours: {
    key: string;
    effect: FavourEffect;
    tags: string[];
    label: string;
    description: string;
    cost: number;
    minutes: number;
  }[];
};

const FILE = data as unknown as FavourFile;

/** True while these are what they claim to be: tunable house rules. */
export const FAVOURS_ARE_HOUSE_RULE: boolean = FILE.houseRule;

/** The flag a place must carry before it will do anything for you. */
export const FAVOUR_FLAG: string = FILE.requires.flag;
/** The dial a favour is paid from. */
export const FAVOUR_DIAL: string = FILE.requires.dial;
/** How many favours one place does for you in one in-world day. */
export const FAVOURS_PER_DAY: number = FILE.perDay;

/** Every favour the city knows, before any of them is attached to a place. */
export const FAVOUR_TEMPLATES = FILE.favours;

/** What a character brings to the asking: how hurt, how hunted, what they have had today. */
export type FavourContext = {
  hpCurrent: number;
  hpMax: number;
  body: number;
  /** A Medtech's standing self-care, in HP a day. */
  perDayBonus?: number;
  /** Filled segments on the NCPD heat clock. */
  heat: number;
  /** Whether this place has already done one favour for them today. */
  calledToday: boolean;
};

export type FavourOffer = {
  key: string;
  effect: FavourEffect;
  label: string;
  description: string;
  placeKey: string;
  placeName: string;
  minutes: number;
  /** In goodwill segments. The player is shown the offer in words, never this. */
  cost: number;
  /** Whether it can be asked for now. */
  ready: boolean;
  /** Why not, when it cannot, in the voice of the place. */
  reason: string | null;
  /** What it would heal, for a `patch`. */
  hpHealed: number;
  /** Segments it would take off the NCPD heat clock, for a `lay_low`. */
  heatEased: number;
};

/** The two `clean` reports a `lay_low` is worth: working clean is what takes heat off. */
export function layLowReports(): ObservationReport[] {
  return Array.from({ length: FILE.layLowSegments }, () => ({
    observation: "clean" as const,
    factionId: null,
  }));
}

/** Segments `lay_low` would actually take off the heat clock here, given how much there is. */
function easeAt(placeKey: string, heat: number): number {
  const district = districtOfPlace(placeKey);
  const change = applyObservations(layLowReports(), {
    heatMultiplier: district ? heatMultiplier(district.key) : 1,
  });
  const delta = change.ticks.find((t) => t.definition.key === HEAT_CLOCK_KEY)?.delta ?? 0;
  return Math.max(0, Math.min(-delta, Math.max(0, Math.trunc(heat))));
}

/** The place's own state, or where it starts when nothing has happened to it. */
function stateOf(placeKey: string, state: PlaceState | undefined): PlaceState {
  return state ?? startingState(placeKey);
}

/**
 * What the place where the character is standing will do for them.
 *
 * Empty unless the place is glad to see them (`welcome`). Every favour its
 * ground supports is listed, ready or not, so a player can see what a place
 * would do for them even on the day they cannot ask.
 */
export function favoursAt(input: {
  placeKey: string;
  state?: PlaceState | undefined;
  context: FavourContext;
}): FavourOffer[] {
  const place = getPlace(input.placeKey);
  if (!place) return [];
  const state = stateOf(input.placeKey, input.state);
  if (!hasFlag(state, FAVOUR_FLAG)) return [];
  const have = state.dials[FAVOUR_DIAL];
  if (have === undefined) return [];

  const tags = tagsOf(input.placeKey);
  const ctx = input.context;
  const out: FavourOffer[] = [];
  for (const template of FILE.favours) {
    if (!template.tags.some((tag) => (tags as string[]).includes(tag))) continue;

    const hpHealed =
      template.effect === "patch" && ctx.hpCurrent > 0
        ? planRest({
            days: 1,
            hpCurrent: ctx.hpCurrent,
            hpMax: ctx.hpMax,
            body: ctx.body,
            perDayBonus: ctx.perDayBonus ?? 0,
          }).hpHealed
        : 0;
    const heatEased = template.effect === "lay_low" ? easeAt(input.placeKey, ctx.heat) : 0;

    let reason: string | null = null;
    if (ctx.calledToday) reason = "They have done enough for you today.";
    else if (have - template.cost < 1) {
      reason = "They have gone out on a limb for you lately. Give it time.";
    } else if (template.effect === "patch" && ctx.hpCurrent <= 0) {
      reason = "You are past what a kindness can fix. That needs a medic.";
    } else if (template.effect === "patch" && hpHealed <= 0) reason = "You are not hurt.";
    else if (template.effect === "lay_low" && heatEased <= 0) reason = "Nobody is looking for you.";

    out.push({
      key: template.key,
      effect: template.effect,
      label: template.label,
      description: template.description,
      placeKey: place.key,
      placeName: place.name,
      minutes: template.minutes,
      cost: template.cost,
      ready: reason === null,
      reason,
      hpHealed,
      heatEased,
    });
  }
  return out;
}

/** The place after a favour is paid for: goodwill spent, nothing else touched. */
export function afterFavour(state: PlaceState, offer: Pick<FavourOffer, "cost">): PlaceState {
  return spendDial(state, FAVOUR_DIAL, offer.cost);
}
