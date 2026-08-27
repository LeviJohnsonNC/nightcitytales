/**
 * What the campaign remembers, assembled from what it knows for certain.
 *
 * A turn shows the model six lines of recent narration. That is the right size
 * for a turn and the wrong size for a campaign: at hour forty the model's
 * memory is still six lines deep, which is the exact point a long game starts
 * feeling amnesiac — the fixer you have worked with eleven times greets you
 * like a stranger, and the corp whose building you burned has no opinion.
 *
 * So the long memory is built rather than remembered. Every line below is
 * derived from state the engine already holds and treats as true: jobs taken
 * and finished, factions crossed and where they stand, clocks that have filled,
 * bodies counted, who keeps bringing you work, who is still looking for you.
 *
 * That has one property a written summary cannot have: it cannot be wrong.
 * A model asked to summarise fifty sessions is summarising its own summaries,
 * and every error it makes becomes permanent. This is recomputed from the
 * ledger's own conclusions each time, so it is exactly as accurate as the game
 * state is.
 *
 * Pure: counts and standings in, lines out.
 */
import { getFaction, isFactionId, standingBand, type FactionStanding } from "./factions";

export type ChronicleInput = {
  /** In-world day, so the record can say how long this has been going on. */
  day: number;
  /** Jobs the character agreed to. */
  jobsTaken: number;
  /** Jobs that reached a settlement. */
  jobsFinished: number;
  /** Offers turned down. */
  jobsDeclined: number;
  /** People the engine recorded dying on the character's jobs. */
  bodies: number;
  /** Organisations with an opinion, and what it is. */
  standings: FactionStanding[];
  /** Clocks with something on them, already worded by the engine. */
  pressure: string[];
  /** The people the campaign knows, and where they stand. */
  people: { name: string; role?: string | undefined; disposition: number; jobsBrought?: number }[];
  /** Anyone who survived a job and has not been dealt with. */
  stillLooking: string[];
};

/** How many days count as a campaign worth summarising at all. */
export const CHRONICLE_MIN_DAYS = 2;

/**
 * The most lines the record will ever be.
 *
 * This goes into every prompt, so it needs a ceiling that does not grow with
 * the campaign. Ordered most-important-first, so a truncation loses the
 * softest detail rather than the fact that Militech want you dead.
 */
export const CHRONICLE_MAX_LINES = 16;

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * The campaign in a dozen lines or fewer.
 *
 * Empty for a campaign that has not happened yet: a record that says "0 jobs,
 * nobody has an opinion of you" is noise in a prompt, and the situation blocks
 * already say everything true about day one.
 */
export function chronicle(input: ChronicleInput): string[] {
  const lines: string[] = [];
  if (input.day < CHRONICLE_MIN_DAYS && input.jobsTaken === 0) return lines;

  // --- the work ------------------------------------------------------------
  if (input.jobsTaken > 0) {
    const parts = [`${plural(input.jobsTaken, "job", "jobs")} taken`];
    if (input.jobsFinished > 0) parts.push(`${input.jobsFinished} finished`);
    const open = input.jobsTaken - input.jobsFinished;
    if (open > 0) parts.push(`${open} left unfinished`);
    lines.push(`${parts.join(", ")}, over ${plural(input.day, "day", "days")} in Night City.`);
  } else {
    lines.push(`${plural(input.day, "day", "days")} in Night City, no work taken yet.`);
  }

  if (input.jobsDeclined > 0) {
    lines.push(`${plural(input.jobsDeclined, "offer", "offers")} turned down.`);
  }

  if (input.bodies > 0) {
    lines.push(`${plural(input.bodies, "person", "people")} died on those jobs.`);
  }

  // --- who has an opinion ---------------------------------------------------
  // Sorted by how strongly they feel, so the worst enemy leads.
  const notable = [...input.standings]
    .filter((s) => s.standing !== 0 && isFactionId(s.factionId))
    .sort((a, b) => Math.abs(b.standing) - Math.abs(a.standing));
  for (const standing of notable.slice(0, 4)) {
    const faction = getFaction(standing.factionId);
    const band = standingBand(standing.standing);
    lines.push(`${faction.name}: ${band.label} (${standing.standing}).`);
  }

  // --- what is on the dials -------------------------------------------------
  for (const line of input.pressure.slice(0, 4)) lines.push(line);

  // --- who keeps turning up -------------------------------------------------
  const broker = [...input.people]
    .filter((p) => (p.jobsBrought ?? 0) > 0)
    .sort((a, b) => (b.jobsBrought ?? 0) - (a.jobsBrought ?? 0))[0];
  if (broker) {
    lines.push(
      `${broker.name} has brought ${plural(broker.jobsBrought ?? 0, "job", "jobs")} of that work.`,
    );
  }

  const close = input.people.filter((p) => p.disposition >= 2).map((p) => p.name);
  if (close.length) lines.push(`Close to the character: ${close.join(", ")}.`);

  const hostile = input.people.filter((p) => p.disposition <= -2).map((p) => p.name);
  if (hostile.length) lines.push(`Wants nothing to do with them: ${hostile.join(", ")}.`);

  if (input.stillLooking.length) {
    lines.push(
      `Walked away from a job with them and has not been settled with: ${input.stillLooking.join(", ")}.`,
    );
  }

  return lines.slice(0, CHRONICLE_MAX_LINES);
}

/** True when there is enough of a campaign to be worth telling the model about. */
export function hasChronicle(input: ChronicleInput): boolean {
  return chronicle(input).length > 0;
}
