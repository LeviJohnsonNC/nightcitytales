/**
 * What a pin on the map is allowed to say.
 *
 * The map has been an encyclopedia: pins you tap to read an article. This turns
 * it into something you choose from — but the moment a map can show that
 * something is happening somewhere, the temptation is to make sure something
 * always is, and a city where every pin is lit is not a city, it is a quest
 * board with a skin on.
 *
 * So the rule here is stricter than it looks:
 *
 *  - EVERY SIGNAL TRACES TO A ROW. A signal is emitted because a situation is
 *    live at that place, or because somebody the player knows is standing
 *    there. There is no interestingness score, no "this district has a lot
 *    going on", nothing computed from the writing. Anything that measures how
 *    interesting a place is will always find something.
 *
 *  - THERE IS A BUDGET, and it is enforced here rather than hoped for. Three
 *    signals across the whole city, one per district. When more qualify the
 *    loudest win and the rest stay dark, so a busy week reads as a busy week
 *    instead of as a lit-up map.
 *
 * A dark pin is the normal case and the map should look like it.
 *
 * Pure TypeScript: rows in, signals out, no knowledge of how any of it is drawn.
 */
import { districtOfPlace, getPlace } from "./geography";
import type { LifeSituation } from "./life";

/**
 * The closed vocabulary of things a pin may announce.
 *
 * Adding a kind means finding a row that proves it. `trade` and `meeting` are
 * declared and not yet emitted: the rows behind them — a vendor's stock, a
 * person's standing invitation — arrive with the systems that own them, and
 * declaring them here early is cheaper than a second vocabulary later.
 */
export const SIGNAL_KINDS = ["market", "event", "person", "meeting", "trade"] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];

export function isSignalKind(value: unknown): value is SignalKind {
  return typeof value === "string" && (SIGNAL_KINDS as readonly string[]).includes(value);
}

/** The mark each kind wears on the map. */
export const SIGNAL_ICONS: Record<SignalKind, string> = {
  market: "🌙",
  event: "⚠",
  person: "👤",
  meeting: "💬",
  trade: "🔧",
};

/** How loudly each kind asks to be shown, when the budget cannot fit them all. */
const KIND_WEIGHT: Record<SignalKind, number> = {
  meeting: 5,
  event: 4,
  market: 3,
  person: 2,
  trade: 1,
};

export type PlaceSignal = {
  placeKey: string;
  placeName: string;
  districtKey: string;
  kind: SignalKind;
  icon: string;
  /** Short enough to sit beside a pin. "Night market tonight". */
  label: string;
  /** What produced it, so a signal can always be traced back to its row. */
  source: string;
};

/**
 * At most three lit pins in the whole city.
 *
 * Not a rendering detail — the number IS the design. Four would already read as
 * a map that always has something on it.
 */
export const MAX_SIGNALS = 3;

/** And never two in the same district, however busy it is. */
export const MAX_SIGNALS_PER_DISTRICT = 1;

export type SignalInput = {
  /** The campaign's situations. Only live ones anchored to a place can signal. */
  situations: LifeSituation[];
  /**
   * People whose whereabouts the campaign actually knows, as place keys. Empty
   * until the cast are given somewhere to be; a face nobody has placed cannot
   * light a pin.
   */
  peopleAt?: { name: string; placeKey: string }[];
};

/** The kind a situation announces itself as, when it announces one at all. */
function kindOf(situation: LifeSituation): SignalKind {
  const declared = (situation.data ?? {})["signal"];
  if (isSignalKind(declared)) return declared;
  return situation.category === "people" ? "person" : "event";
}

/**
 * Which pins are lit right now.
 *
 * Sorted by how loud the thing is before the budget is applied, so what
 * survives is what actually matters rather than whatever came first.
 */
export function placeSignals(input: SignalInput): PlaceSignal[] {
  const candidates: { signal: PlaceSignal; weight: number }[] = [];
  // The district the character is standing in arrives twice: once as a
  // persisted situation and once in the map's preview of the city. Same row,
  // same key, one pin.
  const counted = new Set<string>();

  for (const situation of input.situations) {
    if (situation.status !== "live") continue;
    if (counted.has(situation.key)) continue;
    counted.add(situation.key);
    const placeKey = (situation.data ?? {})["placeKey"];
    if (typeof placeKey !== "string") continue;
    const place = getPlace(placeKey);
    const district = districtOfPlace(placeKey);
    if (!place || !district) continue;
    const kind = kindOf(situation);
    candidates.push({
      // Severity first, because a thing coming for you outranks a market; the
      // kind only breaks the tie.
      weight: situation.severity * 10 + KIND_WEIGHT[kind],
      signal: {
        placeKey: place.key,
        placeName: place.name,
        districtKey: district.key,
        kind,
        icon: SIGNAL_ICONS[kind],
        label: situation.title,
        source: `situation:${situation.key}`,
      },
    });
  }

  for (const person of input.peopleAt ?? []) {
    const place = getPlace(person.placeKey);
    const district = districtOfPlace(person.placeKey);
    if (!place || !district) continue;
    candidates.push({
      weight: KIND_WEIGHT.person,
      signal: {
        placeKey: place.key,
        placeName: place.name,
        districtKey: district.key,
        kind: "person",
        icon: SIGNAL_ICONS.person,
        label: `${person.name} is here`,
        source: `person:${person.name}`,
      },
    });
  }

  candidates.sort(
    (a, b) => b.weight - a.weight || a.signal.placeKey.localeCompare(b.signal.placeKey),
  );

  const perDistrict = new Map<string, number>();
  const out: PlaceSignal[] = [];
  for (const candidate of candidates) {
    if (out.length >= MAX_SIGNALS) break;
    const district = candidate.signal.districtKey;
    const used = perDistrict.get(district) ?? 0;
    if (used >= MAX_SIGNALS_PER_DISTRICT) continue;
    perDistrict.set(district, used + 1);
    out.push(candidate.signal);
  }
  return out;
}

/** The signal for one district, when it has one. */
export function signalForDistrict(
  signals: PlaceSignal[],
  districtKey: string,
): PlaceSignal | undefined {
  return signals.find((s) => s.districtKey === districtKey);
}

/** The signal for one exact place, when it has one. */
export function signalForPlace(signals: PlaceSignal[], placeKey: string): PlaceSignal | undefined {
  return signals.find((s) => s.placeKey === placeKey);
}
