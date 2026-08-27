/**
 * The trip home from a job.
 *
 * Settlement used to do three things: pay the printed fee, write one ledger
 * line, and count the bodies the combat engine had dropped. A job you walked
 * away from clean and a job that ended in a stairwell shootout with two dead
 * and a witness settled identically, and the money always arrived in full.
 *
 * This is the rest of it, and every part is read or rolled rather than asked:
 *
 *  - What the job cost is READ off the job's own ledger (engine/settlement.ts),
 *    in the closed vocabulary engine/clocks.ts already prices. Not narration:
 *    a model that forgets to mention a firefight cannot make one free.
 *  - Whether the money arrives is ROLLED (engine/payment.ts), weighted hard
 *    toward being paid, because a world where you cannot trust a payout is one
 *    where nobody would take work.
 *  - Who remembers you is PROMOTED, never invented: somebody the player fought,
 *    who has a name, and who was still standing at the end.
 *  - What is left over is WRITTEN INTO LIFE with a due day, so a consequence
 *    arrives on a schedule the engine owns rather than when the model
 *    remembers it.
 */
import {
  clampDisposition,
  describePayment,
  describeSettlement,
  readSettlement,
  reportsFrom,
  rollPayment,
  survivorsFrom,
  type PaymentOutcome,
  type SettlementFinding,
} from "@/engine";
import {
  appendCampaignEvent,
  findCampaignNpc,
  listCampaignEvents,
  saveCampaignNpc,
  setNpcDisposition,
  upsertSituations,
  type CampaignEvent,
  type CampaignInventoryItem,
  type Json,
  type SituationUpsert,
} from "@/lib/backend";
import { addToTally } from "./tally";

/** The ledger type a settlement report is written under. */
export const SETTLEMENT_EVENT = "job_settled";

/**
 * How far back settlement reads.
 *
 * Wide enough that the `mission_started` marking the beginning of even a very
 * long job is inside it. Settlement runs once when a job ends, not once a turn,
 * so this never touches the cost of playing.
 */
export const JOB_LEDGER_LIMIT = 2000;

/** How long a grudge takes to find you, in days. */
export const GRUDGE_DUE_DAYS = 6;
/** Disposition a survivor starts at. They watched you try to kill them. */
export const SURVIVOR_DISPOSITION = -3;

// ---------------------------------------------------------------------------
// Reading the job.
// ---------------------------------------------------------------------------

export type AftermathInput = {
  campaignId: string;
  playerName: string;
  /** What was agreed for the job, before the money was rolled for. */
  agreed: number;
  /** True when objectives were left unfinished — a broker's excuse to shave. */
  messy: boolean;
  /** The day the job ended, so consequences can be given a due date. */
  day: number;
  /** The broker who owes the money, when the campaign knows who that is. */
  brokerKey?: string | null;
  inventory: CampaignInventoryItem[];
};

export type AftermathReport = {
  findings: SettlementFinding[];
  payment: PaymentOutcome;
  survivors: string[];
  /** Situations written onto the Life queue, for the wrap-up screen to show. */
  scars: { title: string; dueDay: number | null }[];
  /**
   * The broker who owes for this job, found in the same wide read. Handed back
   * so the caller does not have to look for a `mission_started` that may sit
   * outside a turn's window.
   */
  brokerKey: string | null;
};

// ---------------------------------------------------------------------------
// The people who lived.
// ---------------------------------------------------------------------------

/** A stable key for somebody the ledger only knows by name. */
export function survivorKey(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "survivor"
  );
}

/**
 * Turn the people who walked away into people the campaign remembers.
 *
 * Promotion, never invention: the name came off an attack the engine resolved,
 * so this is somebody who was genuinely there. An NPC the campaign already
 * knows keeps their row and just gets angrier.
 */
async function promoteSurvivors(input: AftermathInput, names: string[]): Promise<string[]> {
  const promoted: string[] = [];
  for (const name of names) {
    const key = survivorKey(name);
    const existing = await findCampaignNpc(input.campaignId, key);
    if (existing) {
      // Already somebody. Shooting at them again does not reset who they are,
      // it just costs more of what was left.
      await setNpcDisposition(existing.id, clampDisposition(existing.disposition - 1));
      promoted.push(name);
      continue;
    }
    const row = await saveCampaignNpc(input.campaignId, key, {
      name,
      data: {
        promotedFrom: "survived_a_job",
        note: "Walked away from a fight with the character, and remembers it.",
      } as unknown as Json,
    });
    await setNpcDisposition(row.id, clampDisposition(SURVIVOR_DISPOSITION));
    promoted.push(name);
  }
  return promoted;
}

// ---------------------------------------------------------------------------
// What gets written into Life.
// ---------------------------------------------------------------------------

/**
 * The consequences that come due on a day rather than on a whim.
 *
 * Grudges, wounds and chewed armor all become ordinary Life situations, so the
 * machinery that already ages, escalates and expires them does the work — and
 * the model meets them as things that are true rather than things to invent.
 */
export function scarsFor(
  input: AftermathInput,
  survivors: string[],
  hp: { current: number; max: number },
): SituationUpsert[] {
  const out: SituationUpsert[] = [];

  for (const name of survivors) {
    out.push({
      situationKey: `grudge_${survivorKey(name)}`,
      category: "pressure",
      title: `${name} is still out there`,
      summary: `${name} walked away from a fight with you and did not forget it.`,
      npcKey: survivorKey(name),
      status: "live",
      severity: 3,
      dueDay: input.day + GRUDGE_DUE_DAYS,
    });
  }

  // Wounds worth the character's own attention. The engine already knows the
  // number; this makes it something Life will put in front of them.
  if (hp.max > 0 && hp.current < hp.max / 2) {
    out.push({
      situationKey: "aftermath_wounds",
      category: "need",
      title: "You came back hurt",
      summary: `HP ${hp.current}/${hp.max}. Time or a ripperdoc, and neither is free.`,
      status: "live",
      severity: hp.current <= hp.max / 4 ? 4 : 2,
      dueDay: null,
    });
  }

  // Armor that stopped something and has the dents to show for it.
  const chewed = input.inventory.filter(
    (row) => row.current_sp !== null && row.current_sp <= 0 && row.equipped,
  );
  if (chewed.length > 0) {
    out.push({
      situationKey: "aftermath_armor",
      category: "need",
      title: "Your armor is finished",
      summary: `${chewed.length} piece${chewed.length === 1 ? "" : "s"} ablated to nothing. It stops nothing until it is patched.`,
      status: "live",
      severity: 3,
      dueDay: null,
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Settling.
// ---------------------------------------------------------------------------

/**
 * Read the job, roll the money, promote who lived, write what is left.
 *
 * Returns everything it decided so the wrap-up screen can show its working:
 * a number that silently changed teaches the player nothing about the world.
 */
export async function settleAftermath(
  input: AftermathInput,
  hp: { current: number; max: number },
): Promise<AftermathReport | null> {
  // Settling twice would pay twice, promote twice and charge the clocks twice.
  // Both callers are guarded by the mission's own status, but money is worth a
  // second lock: the ledger already says whether this job has been settled.
  // A whole job, not a turn's window: settlement counts everything since the
  // last `mission_started`, and a long job can outrun the 200 rows a turn
  // reads. This runs once per job, so the wider read costs nothing per turn.
  const live = await listCampaignEvents(input.campaignId, JOB_LEDGER_LIMIT);
  if (alreadySettled(live)) return null;

  // Everything below reads `live`, not the caller's snapshot: what the job cost
  // is counted from the last `mission_started`, and a turn's 200-row window can
  // start after a long job began — which would silently count only part of it.
  const findings = readSettlement({ events: live, playerName: input.playerName });
  const payment = rollPayment({ agreed: input.agreed, messy: input.messy });

  const survivors = survivorsFrom({ events: live, playerName: input.playerName }).map(
    (s) => s.name,
  );
  const promoted = await promoteSurvivors(input, survivors);

  const scars = scarsFor(input, promoted, hp);
  if (scars.length > 0) await upsertSituations(input.campaignId, scars);

  await appendCampaignEvent({
    campaign_id: input.campaignId,
    type: SETTLEMENT_EVENT,
    summary: `${describePayment(payment)} ${describeSettlement(findings)}`,
    roll: payment.roll.roll as unknown as Json,
    data: {
      findings,
      payment: { key: payment.key, agreed: payment.agreed, paid: payment.paid },
      survivors: promoted,
      scars: scars.map((s) => s.situationKey),
    } as unknown as Json,
  });

  // Counted once, here, so the record's totals are exact however long the
  // campaign runs and however short a turn's window is.
  await addToTally(input.campaignId, {
    jobsFinished: 1,
    bodies: findings.find((f) => f.observation === "killed")?.count ?? 0,
  });

  return {
    findings,
    payment,
    survivors: promoted,
    scars: scars.map((s) => ({ title: s.title, dueDay: s.dueDay ?? null })),
    brokerKey: brokerKeyFor(live),
  };
}

/** The reports engine/clocks.ts prices, aimed at whoever the job was against. */
export function pressureReportsFor<F>(report: AftermathReport, factionId: F) {
  return reportsFrom(report.findings, factionId);
}

/**
 * The broker who owes for this job, read off the event that started it.
 *
 * Recovered from the ledger rather than reconstructed: the person who made the
 * offer is the person who pays, and by settlement the hook that named them is
 * long resolved.
 */
export function brokerKeyFor(events: CampaignEvent[]): string | null {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event?.type !== "mission_started") continue;
    const key = (event.data as { brokerKey?: unknown } | null)?.brokerKey;
    return typeof key === "string" && key ? key : null;
  }
  return null;
}

/**
 * True when the job that is currently ending has already been settled.
 *
 * Looks only after the last `mission_started`, so finishing job three is not
 * blocked by job two having been settled.
 */
export function alreadySettled(events: CampaignEvent[]): boolean {
  const startedAt = events.map((e) => e.type).lastIndexOf("mission_started");
  const thisJob = startedAt === -1 ? events : events.slice(startedAt + 1);
  return thisJob.some((e) => e.type === SETTLEMENT_EVENT);
}
