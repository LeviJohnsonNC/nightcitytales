/**
 * LIFE — the phase between jobs, as pure data.
 *
 * The app, not the AI, decides what is demanding the character's attention.
 * This module turns real state (money owed, armor chewed, wounds, empty
 * magazines, ticking pressures, people not seen in a while) into candidate
 * situations, picks the one that matters most, and ages the world forward.
 *
 * The AI's only job is to DRESS the situation this module selected. It never
 * remembers, escalates or expires anything.
 *
 * No Cyberpunk RED rules values are invented here: every mechanical number
 * (bills, repair costs, healing, DVs) is computed by the existing engine
 * modules and passed in. What lives here is app pacing — which problem is
 * loudest right now.
 */

export const LIFE_CATEGORIES = ["need", "people", "opportunity", "pressure", "hook"] as const;
export type LifeCategory = (typeof LIFE_CATEGORIES)[number];

export const SITUATION_STATUSES = ["live", "resolved", "expired", "escalated"] as const;
export type SituationStatus = (typeof SITUATION_STATUSES)[number];

/** A persistent thing the world is holding against (or offering) the player. */
export type LifeSituation = {
  key: string;
  category: LifeCategory;
  title: string;
  summary: string;
  npcKey?: string;
  status: SituationStatus;
  /** 1 (idle interest) .. 5 (someone is at the door right now). */
  severity: number;
  /** The in-world day this comes due or expires, when it has one. */
  dueDay?: number;
  /** Last day this was put in front of the player, so it does not repeat. */
  lastShownDay?: number;
  data?: Record<string, unknown>;
};

export const SEVERITY_MIN = 1;
export const SEVERITY_MAX = 5;

export function clampSeverity(value: number): number {
  if (!Number.isFinite(value)) return SEVERITY_MIN;
  return Math.max(SEVERITY_MIN, Math.min(SEVERITY_MAX, Math.round(value)));
}

// ---------------------------------------------------------------------------
// Clocks — slow pressures that fill a segment at a time.
// ---------------------------------------------------------------------------

export type LifeClock = {
  key: string;
  label: string;
  filled: number;
  segments: number;
  hidden: boolean;
};

export function clockFull(clock: LifeClock): boolean {
  return clock.filled >= clock.segments;
}

/** Fill (or empty, with a negative delta) segments, clamped to the dial. */
export function tickClock(clock: LifeClock, delta: number): LifeClock {
  const filled = Math.max(0, Math.min(clock.segments, clock.filled + Math.round(delta)));
  return { ...clock, filled };
}

/** "Arasaka Investigation: 2/6" */
export function formatClockLabel(clock: LifeClock): string {
  return `${clock.label}: ${clock.filled}/${clock.segments}`;
}

// ---------------------------------------------------------------------------
// NEEDS — derived from what is actually true of the character right now.
// ---------------------------------------------------------------------------

/** The real numbers a Life turn reasons about. All computed elsewhere. */
export type LifeStateInput = {
  day: number;
  eurobucks: number;
  hpCurrent: number;
  hpMax: number;
  woundState: string;
  humanityCurrent?: number;
  humanityMax?: number;
  /** Total owed right now (bills + lifestyle), from the downtime engine. */
  billsOwed: number;
  /** The day the next bill lands; negative days-away means already overdue. */
  billsDueDay: number;
  /** Armor lines below their printed SP, with the printed repair cost. */
  damagedArmor: { name: string; missingSp: number; cost: number }[];
  /** Carried weapons with nothing loaded. */
  emptyWeapons: string[];
  /** Carried weapons marked broken. */
  brokenWeapons: string[];
  /** Recurring NPCs and the day they were last dealt with. */
  people: { key: string; name: string; disposition: number; lastSeenDay?: number }[];
};

/** Days of quiet before a recurring face takes the initiative. */
export const PEOPLE_SILENCE_DAYS = 3;

/** How close a bill must be before it becomes the loudest thing in the room. */
export const RENT_WARNING_DAYS = 5;

/**
 * Turn real state into candidate situations. Deterministic: the same state
 * always yields the same candidates, with the same keys, so they persist
 * instead of evaporating between turns.
 */
export function deriveNeeds(state: LifeStateInput): LifeSituation[] {
  const out: LifeSituation[] = [];

  const daysToBill = state.billsDueDay - state.day;
  if (state.billsOwed > 0) {
    const overdue = daysToBill <= 0;
    out.push({
      key: "rent_due",
      category: overdue ? "pressure" : "need",
      title: overdue ? "The rent is late" : "Rent is coming due",
      summary: overdue
        ? `${state.billsOwed}eb is overdue on your place.`
        : `${state.billsOwed}eb is due in ${daysToBill} day${daysToBill === 1 ? "" : "s"}.`,
      status: "live",
      severity: overdue ? 5 : daysToBill <= RENT_WARNING_DAYS ? 3 : 2,
      dueDay: state.billsDueDay,
      data: { owed: state.billsOwed },
    });
  }

  if (state.hpCurrent < state.hpMax) {
    const serious = state.woundState === "serious" || state.woundState === "mortal";
    out.push({
      key: "wounded",
      category: "need",
      title: serious ? "You are still bleeding" : "You are carrying damage",
      summary: `HP ${state.hpCurrent}/${state.hpMax}.`,
      status: "live",
      severity: serious ? 4 : 2,
      data: { hpCurrent: state.hpCurrent, hpMax: state.hpMax },
    });
  }

  for (const armor of state.damagedArmor) {
    out.push({
      key: `armor_repair_${slug(armor.name)}`,
      category: "need",
      title: `${armor.name} needs patching`,
      summary: `Down ${armor.missingSp} SP. A shop wants ${armor.cost}eb.`,
      status: "live",
      severity: armor.missingSp >= 3 ? 3 : 2,
      data: { cost: armor.cost, missingSp: armor.missingSp },
    });
  }

  if (state.emptyWeapons.length) {
    out.push({
      key: "no_ammo",
      category: "need",
      title: "You are carrying dead weight",
      summary: `Nothing loaded in your ${list(state.emptyWeapons)}.`,
      status: "live",
      severity: 3,
      data: { weapons: state.emptyWeapons },
    });
  }

  if (state.brokenWeapons.length) {
    out.push({
      key: "broken_weapon",
      category: "need",
      title: "Broken kit",
      summary: `${capitalize(list(state.brokenWeapons))} won't fire until it's fixed.`,
      status: "live",
      severity: 3,
      data: { weapons: state.brokenWeapons },
    });
  }

  if (
    state.humanityCurrent !== undefined &&
    state.humanityMax !== undefined &&
    state.humanityMax > 0 &&
    state.humanityCurrent <= state.humanityMax / 2
  ) {
    out.push({
      key: "humanity_low",
      category: "need",
      title: "The chrome is talking louder than you are",
      summary: `Humanity ${state.humanityCurrent}/${state.humanityMax}.`,
      status: "live",
      severity: state.humanityCurrent <= state.humanityMax / 4 ? 4 : 2,
      data: { humanity: state.humanityCurrent },
    });
  }

  if (state.eurobucks <= 50) {
    out.push({
      key: "broke",
      category: "need",
      title: "You are running on fumes",
      summary: `${state.eurobucks}eb to your name.`,
      status: "live",
      severity: 3,
      data: { eurobucks: state.eurobucks },
    });
  }

  for (const person of state.people) {
    const quiet = state.day - (person.lastSeenDay ?? 0);
    if (quiet < PEOPLE_SILENCE_DAYS) continue;
    out.push({
      key: `person_${slug(person.key)}`,
      category: "people",
      title: `${person.name} reaches out`,
      summary: `You haven't dealt with ${person.name} in ${quiet} days.`,
      npcKey: person.key,
      status: "live",
      severity: person.disposition <= -1 ? 3 : 2,
      data: { disposition: person.disposition },
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Ageing the world forward.
// ---------------------------------------------------------------------------

/** Escalate a situation whose deadline has passed; expire one that is spent. */
export function ageSituation(situation: LifeSituation, day: number): LifeSituation {
  if (situation.status !== "live") return situation;
  if (situation.dueDay === undefined || day < situation.dueDay) return situation;
  if (situation.category === "opportunity" || situation.category === "hook") {
    return { ...situation, status: "expired" };
  }
  return {
    ...situation,
    status: "live",
    severity: clampSeverity(situation.severity + 1),
    data: { ...(situation.data ?? {}), escalatedOnDay: day },
  };
}

export function ageSituations(situations: LifeSituation[], day: number): LifeSituation[] {
  return situations.map((s) => ageSituation(s, day));
}

// ---------------------------------------------------------------------------
// Selection — one primary situation per turn.
// ---------------------------------------------------------------------------

const CATEGORY_WEIGHT: Record<LifeCategory, number> = {
  hook: 6,
  pressure: 3,
  need: 2,
  people: 2,
  opportunity: 1,
};

/** How loud a situation is right now. Higher wins. */
export function situationWeight(situation: LifeSituation, day: number): number {
  let weight = situation.severity * 10 + CATEGORY_WEIGHT[situation.category];
  if (situation.dueDay !== undefined) {
    const daysLeft = situation.dueDay - day;
    if (daysLeft <= 0) weight += 15;
    else if (daysLeft <= RENT_WARNING_DAYS) weight += 5;
  }
  // Something already put to the player today should not be put again.
  if (situation.lastShownDay !== undefined && situation.lastShownDay >= day) weight -= 12;
  return weight;
}

/**
 * The situation to open this turn. Hooks outrank everything (the player is
 * being asked a direct question); otherwise the loudest live problem wins, and
 * the one shown last turn steps aside unless it escalated.
 */
export function selectSituation(
  situations: LifeSituation[],
  day: number,
  lastShownKey?: string,
): LifeSituation | null {
  const live = situations.filter((s) => s.status === "live");
  if (!live.length) return null;
  const scored = live
    .map((s) => ({
      s,
      w: situationWeight(s, day) - (s.key === lastShownKey ? 8 : 0),
    }))
    .sort((a, b) => b.w - a.w || a.s.key.localeCompare(b.s.key));
  return scored[0]?.s ?? null;
}

/**
 * Fold freshly derived candidates into what is already persisted: existing keys
 * keep their history (and take the higher severity), new keys are added, and
 * derived needs that are no longer true are resolved.
 */
export function mergeSituations(
  existing: LifeSituation[],
  derived: LifeSituation[],
): LifeSituation[] {
  const derivedKeys = new Set(derived.map((d) => d.key));
  const byKey = new Map(existing.map((s) => [s.key, s]));
  const out: LifeSituation[] = [];

  for (const prior of existing) {
    const match = derived.find((d) => d.key === prior.key);
    if (match) {
      out.push({
        ...prior,
        title: match.title,
        summary: match.summary,
        severity: clampSeverity(Math.max(prior.severity, match.severity)),
        status: "live",
        ...(match.dueDay !== undefined ? { dueDay: match.dueDay } : {}),
        data: { ...(prior.data ?? {}), ...(match.data ?? {}) },
      });
      continue;
    }
    // A derived need that stopped being true (armor patched, rent paid) is done.
    const wasDerived = isDerivedKey(prior.key);
    if (wasDerived && !derivedKeys.has(prior.key) && prior.status === "live") {
      out.push({ ...prior, status: "resolved" });
      continue;
    }
    out.push(prior);
  }

  for (const candidate of derived) {
    if (!byKey.has(candidate.key)) out.push(candidate);
  }
  return out;
}

const DERIVED_PREFIXES = ["rent_due", "wounded", "armor_repair_", "no_ammo", "broken_weapon", "humanity_low", "broke", "person_"];

function isDerivedKey(key: string): boolean {
  return DERIVED_PREFIXES.some((p) => (p.endsWith("_") ? key.startsWith(p) : key === p));
}

// ---------------------------------------------------------------------------

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function list(values: string[]): string {
  if (values.length <= 1) return values[0] ?? "";
  return `${values.slice(0, -1).join(", ")} and ${values[values.length - 1]}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
