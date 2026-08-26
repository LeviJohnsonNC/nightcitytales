/**
 * Pressure on a campaign's books.
 *
 * The engine decides what an observation costs (engine/clocks.ts) and who the
 * organisations are (engine/factions.ts); this module is the only place either
 * becomes a row, and the only place a filled clock is spent.
 *
 * Three jobs:
 *  - read clock and faction rows back into engine shapes,
 *  - apply a turn's observations, creating clocks the first time they are needed,
 *  - hand back whichever clock has come due, so the caller can let it arrive.
 *
 * A clock's label and payoff are DERIVED from its key rather than read out of
 * the row. The fill is the only thing a campaign owns; wording can be corrected
 * without a migration, and a row cannot carry a label the engine disowns.
 */
import {
  applyObservations,
  clampStanding,
  clockDefinitionFor,
  factionClock,
  fired,
  getFaction,
  heatClock,
  isFactionId,
  isObservation,
  notableStandings,
  resolveFactionId,
  standingBand,
  tickClock,
  type ClockDefinition,
  type FactionId,
  type FactionStanding,
  type LifeClock,
  type Observation,
  type ObservationReport,
} from "@/engine";
import {
  appendCampaignEvent,
  listCampaignFactions,
  listClocks,
  upsertClock,
  upsertFactionStanding,
  type CampaignClock,
  type CampaignEvent,
  type CampaignFaction,
  type Json,
} from "@/lib/backend";

/** A clock as both halves: how full it is, and what it actually is. */
export type LivePressure = {
  clock: LifeClock;
  definition: ClockDefinition;
};

// ---------------------------------------------------------------------------
// Reading rows back.
// ---------------------------------------------------------------------------

function factionIdOf(row: CampaignClock): FactionId | null {
  const data = (row.data ?? {}) as { factionId?: unknown };
  return isFactionId(data.factionId) ? data.factionId : null;
}

/**
 * The pressure a campaign is actually under. Rows whose key the engine no longer
 * recognises are dropped rather than rendered: a clock nothing can fill and
 * nothing can fire is not pressure, it is clutter.
 */
export function pressureFrom(rows: CampaignClock[]): LivePressure[] {
  const out: LivePressure[] = [];
  for (const row of rows) {
    const definition = clockDefinitionFor(row.clock_key, factionIdOf(row));
    if (!definition) continue;
    out.push({
      definition,
      clock: {
        key: definition.key,
        label: definition.label,
        filled: Math.max(0, Math.min(definition.segments, row.filled)),
        segments: definition.segments,
        hidden: definition.hidden,
      },
    });
  }
  return out.sort(
    (a, b) => b.clock.filled - a.clock.filled || a.clock.key.localeCompare(b.clock.key),
  );
}

/** Standings a campaign has on file, in engine shape. */
export function standingsFrom(rows: CampaignFaction[]): FactionStanding[] {
  const out: FactionStanding[] = [];
  for (const row of rows) {
    const factionId = resolveFactionId(row.faction_id);
    if (!factionId) continue;
    out.push({ factionId, standing: clampStanding(row.standing) });
  }
  return out;
}

/** Everyone who has formed an opinion, worst first. */
export function notableFrom(rows: CampaignFaction[]): FactionStanding[] {
  return notableStandings(standingsFrom(rows));
}

// ---------------------------------------------------------------------------
// Reading what the model reported.
// ---------------------------------------------------------------------------

/**
 * Narrow a turn's reported observations down to the ones the engine admits.
 *
 * Anything the model spelled its own way, or aimed at an organisation that does
 * not exist, is dropped rather than half-understood. A faction it could not name
 * still counts: being loud is being loud whether or not anyone owns the street.
 */
export function readObservations(raw: unknown): ObservationReport[] {
  if (!Array.isArray(raw)) return [];
  const out: ObservationReport[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      if (isObservation(item)) out.push({ observation: item, factionId: null });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const record = item as {
      observation?: unknown;
      kind?: unknown;
      factionId?: unknown;
      faction?: unknown;
    };
    const observation = record.observation ?? record.kind;
    if (!isObservation(observation)) continue;
    out.push({
      observation: observation as Observation,
      factionId: resolveFactionId(record.factionId ?? record.faction),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Applying a turn.
// ---------------------------------------------------------------------------

/**
 * The signature of a set of reports, order-independent. Exported so the dedupe
 * rule can be tested against the real thing rather than a copy of it.
 */
export function reportSignature(reports: ObservationReport[]): string {
  return reports
    .map((r) => `${r.observation}:${r.factionId ?? ""}`)
    .sort()
    .join("|");
}

/**
 * True when this is the same thing the last pressure write already recorded.
 *
 * Aimed squarely at one failure mode: a model restating the body it mentioned
 * on the previous narration of the same player action. Two genuinely different
 * turns rarely produce a byte-identical report, and one that does was almost
 * certainly the same event described twice.
 */
function repeatsLastReport(reports: ObservationReport[], events: CampaignEvent[]): boolean {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (!event || event.type !== "pressure_moved") continue;
    const data = (event.data ?? {}) as { signature?: unknown };
    return typeof data.signature === "string" && data.signature === reportSignature(reports);
  }
  return false;
}

export type PressureResult = {
  /** Pressure after this turn, ready to render or prompt with. */
  pressure: LivePressure[];
  /** Ledger lines describing what moved, empty when nothing did. */
  moved: string[];
};

/**
 * Apply a turn's observations: move the clocks, move the standings, and write
 * one ledger line per dial that actually changed.
 *
 * Creating a clock is a side effect of needing one. A campaign that never
 * crosses Maelstrom never grows a Maelstrom clock, and the pressure panel stays
 * a list of things the player did rather than a list of things they might.
 */
export async function applyPressure(
  campaignId: string,
  reports: ObservationReport[],
  options: { beatId?: string | null; notAgainAfter?: CampaignEvent[] } = {},
): Promise<PressureResult> {
  if (options.notAgainAfter && repeatsLastReport(reports, options.notAgainAfter)) {
    return { pressure: pressureFrom(await listClocks(campaignId)), moved: [] };
  }
  const change = applyObservations(reports);
  if (!change.ticks.length && !change.standings.length) {
    return { pressure: pressureFrom(await listClocks(campaignId)), moved: [] };
  }

  const beat = options.beatId ? { beat_id: options.beatId } : {};
  const existing = pressureFrom(await listClocks(campaignId));
  const byKey = new Map(existing.map((p) => [p.clock.key, p]));
  const moved: string[] = [];

  for (const tick of change.ticks) {
    const before = byKey.get(tick.definition.key)?.clock ?? {
      key: tick.definition.key,
      label: tick.definition.label,
      filled: 0,
      segments: tick.definition.segments,
      hidden: tick.definition.hidden,
    };
    const after = tickClock(before, tick.delta);
    if (after.filled === before.filled) continue;

    await upsertClock(campaignId, {
      clockKey: after.key,
      label: tick.definition.label,
      filled: after.filled,
      segments: tick.definition.segments,
      hidden: tick.definition.hidden,
      data: { kind: tick.definition.kind, factionId: tick.definition.factionId } as unknown as Json,
    });
    moved.push(`${tick.definition.label}: ${after.filled}/${after.segments}`);
  }

  const factionRows = await listCampaignFactions(campaignId);
  const current = new Map(standingsFrom(factionRows).map((s) => [s.factionId, s.standing]));
  for (const shift of change.standings) {
    const before = current.get(shift.factionId) ?? 0;
    const after = clampStanding(before + shift.delta);
    if (after === before) continue;
    const faction = getFaction(shift.factionId);
    await upsertFactionStanding(campaignId, {
      factionId: shift.factionId,
      name: faction.name,
      standing: after,
    });
    moved.push(`${faction.name} now sees you as ${standingBand(after).label}.`);
  }

  if (moved.length) {
    await appendCampaignEvent({
      campaign_id: campaignId,
      type: "pressure_moved",
      summary: moved.join(" · "),
      data: {
        notes: change.notes,
        observations: reports.map((r) => r.observation),
        signature: reportSignature(reports),
      } as unknown as Json,
      ...beat,
    });
  }

  return { pressure: pressureFrom(await listClocks(campaignId)), moved };
}

// ---------------------------------------------------------------------------
// Spending a clock that has come due.
// ---------------------------------------------------------------------------

export type ArrivedPressure = {
  definition: ClockDefinition;
  /** What arrived, for the ledger and for the model to dress. */
  payoff: string;
};

/**
 * Take the worst clock that has filled and spend it.
 *
 * Spending means resetting to empty and writing what arrived to the ledger. A
 * clock is not left sitting full: a faction that has already come for you starts
 * over, so the pressure recurs if you keep giving them reasons rather than
 * pinning permanently at the top of the dial doing nothing.
 *
 * Returns null when nothing is due, which is the common case.
 */
export async function spendFiredClock(
  campaignId: string,
  options: { beatId?: string | null } = {},
): Promise<ArrivedPressure | null> {
  // Read live rather than trusting a caller's snapshot. One player turn can
  // narrate several times (an action, then the check it proposed, then the
  // result), and each pass would otherwise spend the same full clock again off
  // the same stale copy.
  const pressure = pressureFrom(await listClocks(campaignId));
  const due = fired(pressure.map((p) => p.clock))[0];
  if (!due) return null;
  const hit = pressure.find((p) => p.clock.key === due.key);
  if (!hit) return null;

  await upsertClock(campaignId, {
    clockKey: hit.definition.key,
    label: hit.definition.label,
    filled: 0,
    segments: hit.definition.segments,
    hidden: hit.definition.hidden,
    data: { kind: hit.definition.kind, factionId: hit.definition.factionId } as unknown as Json,
  });

  await appendCampaignEvent({
    campaign_id: campaignId,
    type: "pressure_arrived",
    summary: hit.definition.payoff,
    data: {
      clockKey: hit.definition.key,
      kind: hit.definition.kind,
      factionId: hit.definition.factionId,
    } as unknown as Json,
    ...(options.beatId ? { beat_id: options.beatId } : {}),
  });

  return { definition: hit.definition, payoff: hit.definition.payoff };
}

// ---------------------------------------------------------------------------
// Rendering, for the prompt and the panels.
// ---------------------------------------------------------------------------

/** "Tyger Claws Retaliation: 4/6" for every clock worth showing. */
export function pressureLines(pressure: LivePressure[]): string[] {
  return pressure
    .filter((p) => !p.clock.hidden && p.clock.filled > 0)
    .map((p) => `${p.clock.label}: ${p.clock.filled}/${p.clock.segments}`);
}

/** "Tyger Claws: hostile (-5). Westbrook and Japantown, run on protection..." */
export function standingLines(standings: FactionStanding[]): string[] {
  return notableStandings(standings).map((s) => {
    const faction = getFaction(s.factionId);
    return `${faction.name}: ${standingBand(s.standing).label} (${s.standing}). ${faction.blurb}`;
  });
}

/** The clock a faction would fill, for callers that only know who was wronged. */
export function clockForFaction(factionId: FactionId): ClockDefinition {
  return factionClock(factionId);
}

export { heatClock };
