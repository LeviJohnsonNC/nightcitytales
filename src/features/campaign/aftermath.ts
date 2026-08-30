/**
 * The trip home from a job.
 *
 * The engine reads the immutable job ledger and prepares the consequences. A
 * single purpose-built database function then applies payment, people,
 * pressure, persistent situations, tallies and the phase transition together.
 * Combat HP, wound state, armor and ammunition are already canonical by this
 * point; settlement reports those costs but does not create a second copy.
 */
import {
  applyObservations,
  clampDisposition,
  clampStanding,
  describePayment,
  describeSettlement,
  getFaction,
  readMechanicalCost,
  readSettlement,
  reportsFrom,
  rollPayment,
  survivorsFrom,
  tickClock,
  type FactionId,
  type JobMechanicalCost,
  type PaymentOutcome,
  type SettlementFinding,
} from "@/engine";
import {
  getCampaign,
  listCampaignEvents,
  listCampaignFactions,
  listClocks,
  settleJob,
  type CampaignEvent,
  type Json,
  type SettleJobPayload,
} from "@/lib/backend";
import { tallyFrom, type CampaignTally } from "./tally";

export const SETTLEMENT_EVENT = "job_settled";
export const JOB_LEDGER_LIMIT = 2000;
export const GRUDGE_DUE_DAYS = 6;
export const SURVIVOR_DISPOSITION = -3;

export type AftermathInput = {
  campaignId: string;
  missionId: string;
  playerName: string;
  agreed: number;
  messy: boolean;
  factionId: FactionId | null;
  completion: { summary: string; beatId: string | null; data: Json };
};

export type PressureReceipt = {
  kind: "clock" | "standing";
  key: string;
  label: string;
  before: number;
  after: number;
};

export type NpcReceipt = {
  key: string;
  name: string;
  before: number | null;
  after: number;
};

export type AftermathReport = {
  findings: SettlementFinding[];
  payment: PaymentOutcome;
  mechanical: JobMechanicalCost;
  survivors: string[];
  scars: { title: string; dueDay: number | null }[];
  brokerKey: string | null;
  pressure: PressureReceipt[];
  people: NpcReceipt[];
};

/** A stable key for somebody the ledger only knows by name. */
export function survivorKey(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "survivor"
  );
}

/** Only non-derived residue is persisted. HP and armor are derived in Life. */
export function scarsFor(day: number, survivors: string[]) {
  return survivors.map((name) => ({
    situation_key: `grudge_${survivorKey(name)}`,
    category: "pressure",
    title: `${name} is still out there`,
    summary: `${name} walked away from a fight with you and did not forget it.`,
    npc_key: survivorKey(name),
    severity: 3,
    due_day: day + GRUDGE_DUE_DAYS,
  }));
}

function jobStartFor(events: CampaignEvent[]): CampaignEvent | null {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i]?.type === "mission_started") return events[i] ?? null;
  }
  return null;
}

function nextTally(current: CampaignTally, bodies: number): CampaignTally {
  return {
    ...current,
    jobsFinished: current.jobsFinished + 1,
    bodies: current.bodies + Math.max(0, Math.trunc(bodies)),
  };
}

/** The broker who owes for this job, recovered from its opening ledger event. */
export function brokerKeyFor(events: CampaignEvent[]): string | null {
  const start = jobStartFor(events);
  const key = (start?.data as { brokerKey?: unknown } | null)?.brokerKey;
  return typeof key === "string" && key ? key : null;
}

/** True when the current job already has a closeout marker. */
export function alreadySettled(events: CampaignEvent[]): boolean {
  const startedAt = events.map((e) => e.type).lastIndexOf("mission_started");
  const thisJob = startedAt === -1 ? events : events.slice(startedAt + 1);
  return thisJob.some((e) => e.type === SETTLEMENT_EVENT);
}

/** Read fresh canonical state, prepare one closeout, and commit it exactly once. */
export async function settleAftermath(input: AftermathInput): Promise<AftermathReport | null> {
  const [full, live, clockRows, factionRows] = await Promise.all([
    getCampaign(input.campaignId),
    listCampaignEvents(input.campaignId, JOB_LEDGER_LIMIT),
    listClocks(input.campaignId),
    listCampaignFactions(input.campaignId),
  ]);
  if (!full?.vitals) throw new Error("Campaign state is unavailable for settlement.");
  if (alreadySettled(live)) return null;
  const jobStart = jobStartFor(live);
  if (!jobStart) throw new Error("This job has no mission_started boundary.");

  const findings = readSettlement({ events: live, playerName: input.playerName });
  const mechanical = readMechanicalCost({ events: live, playerName: input.playerName });
  const payment = rollPayment({ agreed: input.agreed, messy: input.messy });
  const survivors = survivorsFrom({ events: live, playerName: input.playerName }).map(
    (s) => s.name,
  );
  const brokerKey = brokerKeyFor(live);

  const npcPlans = new Map<string, SettleJobPayload["npcs"][number]>();
  const people: NpcReceipt[] = [];
  for (const name of survivors) {
    const key = survivorKey(name);
    const existing = full.npcs.find((npc) => npc.npc_id === key);
    const after = existing ? clampDisposition(existing.disposition - 1) : SURVIVOR_DISPOSITION;
    npcPlans.set(key, {
      ...(existing ? { id: existing.id } : {}),
      npc_key: key,
      name,
      disposition: after,
      ...(!existing
        ? {
            data: {
              promotedFrom: "survived_a_job",
              note: "Walked away from a fight with the character, and remembers it.",
            } as unknown as Json,
          }
        : {}),
    });
    people.push({ key, name, before: existing?.disposition ?? null, after });
  }

  if (brokerKey && payment.brokerStanding !== 0) {
    const existing = full.npcs.find((npc) => npc.npc_id === brokerKey);
    if (existing) {
      const priorPlan = npcPlans.get(brokerKey);
      const before = priorPlan?.disposition ?? existing.disposition;
      const after = clampDisposition(before + payment.brokerStanding);
      npcPlans.set(brokerKey, {
        id: existing.id,
        npc_key: brokerKey,
        name: existing.name,
        disposition: after,
      });
      const receipt = people.find((person) => person.key === brokerKey);
      if (receipt) receipt.after = after;
      else
        people.push({ key: brokerKey, name: existing.name, before: existing.disposition, after });
    }
  }

  const pressure: PressureReceipt[] = [];
  const clocks: SettleJobPayload["clocks"] = [];
  const factions: SettleJobPayload["factions"] = [];
  const pressureChange = applyObservations(reportsFrom(findings, input.factionId));
  for (const change of pressureChange.ticks) {
    const row = clockRows.find((clock) => clock.clock_key === change.definition.key);
    const before = row?.filled ?? 0;
    const after = tickClock(
      {
        key: change.definition.key,
        label: change.definition.label,
        filled: before,
        segments: change.definition.segments,
        hidden: change.definition.hidden,
      },
      change.delta,
    );
    clocks.push({
      clock_key: after.key,
      label: change.definition.label,
      filled: after.filled,
      segments: after.segments,
      hidden: after.hidden,
      data: {
        kind: change.definition.kind,
        factionId: change.definition.factionId,
      } as unknown as Json,
    });
    pressure.push({
      kind: "clock",
      key: after.key,
      label: change.definition.label,
      before,
      after: after.filled,
    });
  }
  for (const change of pressureChange.standings) {
    const row = factionRows.find((faction) => faction.faction_id === change.factionId);
    const before = row?.standing ?? 0;
    const after = clampStanding(before + change.delta);
    const faction = getFaction(change.factionId);
    factions.push({ faction_id: change.factionId, name: faction.name, standing: after });
    pressure.push({
      kind: "standing",
      key: change.factionId,
      label: faction.name,
      before,
      after,
    });
  }

  const situations = scarsFor(full.campaign.day, survivors);
  const tally = nextTally(
    tallyFrom(full.flags),
    findings.find((finding) => finding.observation === "killed")?.count ?? 0,
  );
  const receipt: AftermathReport = {
    findings,
    payment,
    mechanical,
    survivors,
    scars: situations.map((situation) => ({ title: situation.title, dueDay: situation.due_day })),
    brokerKey,
    pressure,
    people,
  };

  const result = await settleJob({
    campaign_id: input.campaignId,
    job_event_id: jobStart.id,
    mission_id: input.missionId,
    summary: `${describePayment(payment)} ${describeSettlement(findings)}`,
    roll: payment.roll.roll as unknown as Json,
    receipt: receipt as unknown as Json,
    completion: {
      summary: input.completion.summary,
      beat_id: input.completion.beatId,
      data: input.completion.data,
    },
    payment: { agreed: payment.agreed, paid: payment.paid },
    npcs: [...npcPlans.values()],
    situations,
    clocks,
    factions,
    tally: tally as unknown as Json,
  });
  return result.alreadySettled ? null : receipt;
}
