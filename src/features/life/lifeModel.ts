/**
 * Pure glue between persisted rows and the LIFE engine's data shapes. No
 * network, no React: everything here is a translation or a derivation, so the
 * Life loop can be reasoned about (and tested) without a campaign in the cloud.
 */
import {
  clampSeverity,
  deriveNeeds,
  phaseOf,
  type GamePhase,
  type LifeClock,
  type LifeSituation,
  type LifeStateInput,
} from "@/engine";
import { downtimeView } from "@/features/downtime/downtimeModel";
import type {
  Campaign,
  CampaignClock,
  CampaignEvent,
  CampaignInventoryItem,
  CampaignNpc,
  CampaignSituation,
  CampaignVitals,
  FullCharacter,
} from "@/lib/backend";
import type { SituationUpsert } from "@/lib/backend";
import type { LifePersonSummary } from "./lifeContext";

/** Read a persisted situation row back into the engine's shape. */
export function situationFromRow(row: CampaignSituation): LifeSituation {
  const data = (row.data ?? {}) as Record<string, unknown>;
  return {
    key: row.situation_key,
    category: row.category as LifeSituation["category"],
    title: row.title,
    summary: row.summary ?? "",
    status: row.status as LifeSituation["status"],
    severity: clampSeverity(row.severity),
    ...(row.npc_key ? { npcKey: row.npc_key } : {}),
    ...(row.due_day !== null ? { dueDay: row.due_day } : {}),
    ...(row.last_shown_day !== null ? { lastShownDay: row.last_shown_day } : {}),
    data,
  };
}

/** And back again, for persistence. */
export function situationToUpsert(situation: LifeSituation): SituationUpsert {
  return {
    situationKey: situation.key,
    category: situation.category,
    title: situation.title,
    summary: situation.summary,
    npcKey: situation.npcKey ?? null,
    status: situation.status,
    severity: situation.severity,
    dueDay: situation.dueDay ?? null,
    lastShownDay: situation.lastShownDay ?? null,
    data: (situation.data ?? {}) as unknown as NonNullable<SituationUpsert["data"]>,
  };
}

export function clockFromRow(row: CampaignClock): LifeClock {
  return {
    key: row.clock_key,
    label: row.label,
    filled: row.filled,
    segments: row.segments,
    hidden: row.hidden,
  };
}

/** The day an NPC was last dealt with, if the campaign recorded one. */
function lastSeenDay(npc: CampaignNpc): number | undefined {
  const data = (npc.data ?? {}) as { lastSeenDay?: unknown };
  return typeof data.lastSeenDay === "number" ? data.lastSeenDay : undefined;
}

/** Recurring faces, as both the engine and the prompt want them. */
export function lifePeople(npcs: CampaignNpc[]): LifePersonSummary[] {
  return npcs
    .filter((n) => n.status !== "dead")
    .map((n) => {
      const seen = lastSeenDay(n);
      return {
        key: n.npc_id ?? n.name,
        name: n.name,
        disposition: n.disposition,
        status: n.status,
        ...(seen !== undefined ? { lastSeenDay: seen } : {}),
        ...(n.notes ? { notes: n.notes } : {}),
      };
    });
}

/** Weapons in the kit that have nothing chambered, and those that are broken. */
function weaponStates(inventory: CampaignInventoryItem[]): {
  empty: string[];
  broken: string[];
} {
  const empty: string[] = [];
  const broken: string[] = [];
  for (const row of inventory) {
    if (row.kind !== "gear" && row.kind !== "weapon") continue;
    const name = row.item_id.replace(/_/g, " ");
    if (row.condition === "broken") broken.push(name);
    else if (row.ammo_loaded === 0) empty.push(name);
  }
  return { empty, broken };
}

export type LifeBundleInput = {
  campaign: Campaign;
  vitals: CampaignVitals;
  character: FullCharacter;
  inventory: CampaignInventoryItem[];
  npcs: CampaignNpc[];
};

/**
 * Everything the Life engine needs to know about the world right now. Every
 * mechanical number (bills, repair costs, HP) comes from the existing engine
 * modules through downtimeView — none is invented here.
 */
export function buildLifeState(input: LifeBundleInput): Omit<LifeStateInput, "people"> {
  const view = downtimeView({
    campaign: input.campaign,
    vitals: input.vitals,
    character: input.character,
    inventory: input.inventory,
    restDays: 0,
  });
  const { empty, broken } = weaponStates(input.inventory);
  const stats = (input.character.stats ?? {}) as {
    humanity_current?: number | null;
    humanity_max?: number | null;
  };

  return {
    day: view.day,
    eurobucks: view.eurobucks,
    hpCurrent: view.hpCurrent,
    hpMax: view.hpMax,
    woundState: input.vitals.wound_state,
    ...(typeof stats.humanity_current === "number"
      ? { humanityCurrent: stats.humanity_current }
      : {}),
    ...(typeof stats.humanity_max === "number" ? { humanityMax: stats.humanity_max } : {}),
    billsOwed: view.bills.total,
    billsDueDay: view.paidThrough + view.daysToNextBill,
    damagedArmor: view.repairs.map((r) => ({
      name: r.name,
      missingSp: r.missingSp,
      cost: r.cost,
    })),
    emptyWeapons: empty,
    brokenWeapons: broken,
  };
}

/** Candidate situations for this exact state. Deterministic. */
export function derivedSituations(input: LifeBundleInput): LifeSituation[] {
  const state = buildLifeState(input);
  return deriveNeeds({ ...state, people: lifePeople(input.npcs) });
}

/** The last few things that happened, for continuity in the prompt. */
export function recentLifeLines(events: CampaignEvent[], limit = 6): string[] {
  const interesting = new Set([
    "life_narration",
    "life_action",
    "skill_check",
    "mission_completed",
    "campaign_ended",
    "hook_offered",
    "hook_declined",
  ]);
  return events
    .filter((e) => interesting.has(e.type) && e.summary)
    .slice(-limit)
    .map((e) => e.summary as string);
}

/** The phase the campaign is in right now, defaulting to Life. */
export function campaignPhase(campaign: Campaign): GamePhase {
  return phaseOf((campaign as { phase?: unknown }).phase);
}
