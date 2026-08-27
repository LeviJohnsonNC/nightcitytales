/**
 * Gathering what the campaign knows into the shape the chronicle wants.
 *
 * engine/chronicle.ts turns counts and standings into lines. This is the part
 * that goes and gets them — from the ledger for the things that are events
 * (jobs taken, finished, declined, bodies) and from live rows for the things
 * that are state (standings, clocks, people).
 *
 * The counts do NOT come off that window. A turn reads the last 200 rows, and
 * counting "jobs taken" out of those would mean counting the last two sessions
 * — a long-memory feature with a short memory. They come from a running tally
 * (campaign/tally.ts) written when each thing happens, so they are exact
 * however long the campaign runs.
 */
import { chronicle, type ChronicleInput } from "@/engine";
import type { CampaignEvent, CampaignNpc } from "@/lib/backend";
import type { CampaignTally } from "./tally";
import type { FactionStanding } from "@/engine";

function bag(event: CampaignEvent): Record<string, unknown> {
  return event.data && typeof event.data === "object" && !Array.isArray(event.data)
    ? (event.data as Record<string, unknown>)
    : {};
}

/** How many jobs each broker has brought, off the events that started them. */
export function jobsByBroker(events: CampaignEvent[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const event of events) {
    if (event.type !== "mission_started") continue;
    const key = bag(event)["brokerKey"];
    if (typeof key !== "string" || !key) continue;
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

export type ChronicleSources = {
  day: number;
  /** The campaign's running totals, which outlive a turn's window. */
  tally: CampaignTally;
  events: CampaignEvent[];
  standings: FactionStanding[];
  pressure: string[];
  npcs: CampaignNpc[];
  /** Situation keys, so anybody still owed a reckoning can be named. */
  situationKeys: string[];
};

/** Everything engine/chronicle.ts needs, read off the campaign as it stands. */
export function chronicleInput(sources: ChronicleSources): ChronicleInput {
  const brought = jobsByBroker(sources.events);

  // A grudge situation still on the books is somebody who has not been settled
  // with. The key carries the person, which is how they are named here.
  const owed = new Set(
    sources.situationKeys
      .filter((key) => key.startsWith("grudge_"))
      .map((key) => key.slice("grudge_".length)),
  );

  const people = sources.npcs
    .filter((npc) => npc.status !== "dead")
    .map((npc) => {
      const key = npc.npc_id ?? npc.name;
      return {
        name: npc.name,
        disposition: npc.disposition,
        jobsBrought: brought.get(key) ?? 0,
      };
    });

  return {
    day: sources.day,
    jobsTaken: sources.tally.jobsTaken,
    jobsFinished: sources.tally.jobsFinished,
    jobsDeclined: sources.tally.jobsDeclined,
    bodies: sources.tally.bodies,
    standings: sources.standings,
    pressure: sources.pressure,
    people,
    stillLooking: sources.npcs
      .filter((npc) => owed.has(npc.npc_id ?? npc.name))
      .map((npc) => npc.name),
  };
}

/** The campaign's long memory, as lines. Empty when there is nothing to say. */
export function chronicleFor(sources: ChronicleSources): string[] {
  return chronicle(chronicleInput(sources));
}
