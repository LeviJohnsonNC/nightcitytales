/**
 * The obituary: how a run ended, told from what the game already knows.
 *
 * Death used to land on a bordered box that said "You died in Night City" and
 * a link to the roster. It is the one moment every long campaign is guaranteed
 * to reach if the rules are kept, and the game spent it on nothing: the hit
 * that did it, the Death Save that failed, the people left behind, all of it
 * was in the ledger and none of it was read back.
 *
 * Everything here is a fact the engine recorded. The two receipts come off the
 * attack and Death Save rows through `readAttackEventData` and
 * `readDeathSaveEventData`, so the writer and this agree on field names by
 * construction; the people are the cast the campaign seeded; the numbers are the
 * tally. The sentences are fixed templates over those facts — no model writes
 * any of it, and it can say nothing the ledger did not. Losses and gains stand
 * together, as `thenAndNow` does: this is a record, not a score.
 *
 * It decides nothing about what happens after a death. That is open in
 * PRODUCT.md, and this screen does not pre-empt it.
 *
 * Pure: rows in, an obituary out. No React, no Query.
 */
import {
  getDistrict,
  getFaction,
  getLandmark,
  getPlace,
  isFactionId,
  readAttackEventData,
  readDeathSaveEventData,
  resolvePosition,
  standingBand,
  weekdayFor,
  formatTimeOfDay,
  type FactionStanding,
} from "@/engine";
import rolesData from "@/data/rules/roles.json";
import { dispositionBand } from "@/features/life/hud/hudModel";
import type { CampaignEvent, CampaignNpc } from "@/lib/backend";
import type { CampaignTally } from "./tally";

const ROLE_NAMES = rolesData.roles as unknown as Record<string, { name: string }>;

export type ObituaryTone = "good" | "bad" | "neutral";

/** One line of the receipt: a label and what was on it. */
export type ReceiptRow = { label: string; value: string };

/** A resolved roll, set down the way the till would print it. */
export type Receipt = {
  title: string;
  /** The engine's own trace of the roll, verbatim. */
  trace: string | null;
  rows: ReceiptRow[];
};

export type Mourner = {
  name: string;
  /** What they were to the character: "your friend", "the enemy". */
  relation: string;
  /** How they felt, in the HUD's own words — never a number. */
  feeling: string;
  tone: ObituaryTone;
};

export type Obituary = {
  name: string;
  role: string | null;
  /** "Day 41 · Tuesday · 2:10 AM" */
  when: string;
  /** The place they were at, as the atlas names it. */
  where: string | null;
  /** The sentence a stone would carry. */
  epitaph: string;
  /** What the run amounted to. Gains and losses side by side. */
  record: { text: string; tone: ObituaryTone }[];
  /** The last hit the character took, with the arithmetic behind it. */
  lastBlow: Receipt | null;
  /** The Death Save that failed. */
  finalSave: Receipt | null;
  /** The last shot the character took themselves. */
  lastShot: Receipt | null;
  /** The last thing the player had the character do, as they typed it. */
  lastWords: string | null;
  /** People the campaign knew, in the order their loss would be felt. */
  mourners: Mourner[];
};

export type ObituaryInput = {
  name: string;
  roleId: string | null;
  day: number;
  minute: number;
  locationKey: string | null;
  /** The job that was left unfinished, if the character died in one. */
  unfinishedJob: string | null;
  tally: CampaignTally;
  reputation: { level: number; whoKnows: string | null };
  eurobucks: number;
  /** The ledger window, oldest first. The last rows are the ones that matter. */
  events: CampaignEvent[];
  npcs: CampaignNpc[];
  standings: FactionStanding[];
};

/** How many people the page names. A eulogy, not a directory. */
export const MOURNERS_SHOWN = 5;
/** How long the character's last words may run before they are cut. */
export const LAST_WORDS_MAX = 180;

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Where a stored location is: the venue, then the landmark, then the district. */
export function placeNameOf(locationKey: string | null): string | null {
  const position = resolvePosition(locationKey);
  if (!position) return null;
  const venue = position.placeKey ? getPlace(position.placeKey)?.name : undefined;
  const landmark = position.landmarkKey ? getLandmark(position.landmarkKey)?.name : undefined;
  const district = getDistrict(position.districtKey)?.name;
  const spot = venue ?? landmark;
  if (spot && district && spot !== district) return `${spot}, ${district}`;
  return spot ?? district ?? null;
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Newest first, so a search stops at the row that matters. */
function newestFirst(events: CampaignEvent[]): CampaignEvent[] {
  return [...events].sort((a, b) => b.seq - a.seq);
}

function dash(value: number | null): string {
  return value === null ? "—" : String(value);
}

/** What the last damaging hit on the character cost them, row by row. */
function lastBlowOf(events: CampaignEvent[], name: string): Receipt | null {
  for (const event of newestFirst(events)) {
    if (event.type !== "attack") continue;
    const hit = readAttackEventData(event.data);
    if (!hit || !sameName(hit.target, name)) continue;
    // Not known to be a hit is not a hit: a miss has no damage to show.
    if (hit.hit === false || (hit.damage === null && hit.hpAfter === null)) continue;
    const rows: ReceiptRow[] = [
      { label: "Hit by", value: hit.weapon ? `${hit.attacker} · ${hit.weapon}` : hit.attacker },
    ];
    if (hit.damage !== null) rows.push({ label: "Damage rolled", value: String(hit.damage) });
    if (hit.spBefore !== null) {
      rows.push({
        label: `Armor (${hit.armorLocation})`,
        value: hit.ablated
          ? `${hit.spBefore} SP, worn to ${dash(hit.spAfter)}`
          : `${hit.spBefore} SP, held`,
      });
    }
    if (hit.throughArmor !== null) {
      const bonus = hit.bonusDamage ? ` + ${hit.bonusDamage} bonus` : "";
      rows.push({ label: "Through the armor", value: `${hit.throughArmor}${bonus}` });
    }
    if (hit.hpBefore !== null && hit.hpAfter !== null) {
      rows.push({ label: "Hit Points", value: `${hit.hpBefore} → ${hit.hpAfter}` });
    }
    if (hit.criticalInjury) rows.push({ label: "Critical Injury", value: "yes" });
    return { title: "The last hit you took", trace: event.summary ?? null, rows };
  }
  return null;
}

/** The Death Save that ended it, with the engine's own line for the roll. */
function finalSaveOf(events: CampaignEvent[], name: string): Receipt | null {
  for (const event of newestFirst(events)) {
    if (event.type !== "death_save") continue;
    const save = readDeathSaveEventData(event.data);
    if (!save || !save.died || !sameName(save.combatant, name)) continue;
    const roll = event.roll as Record<string, unknown> | null;
    const rows: ReceiptRow[] = [];
    if (roll && typeof roll["roll"] === "number" && typeof roll["effective"] === "number") {
      const penalty = typeof roll["penalty"] === "number" ? roll["penalty"] : 0;
      rows.push({
        label: "Rolled",
        value: `d10 ${roll["roll"]}${penalty ? ` + ${penalty} penalty` : ""} = ${roll["effective"]}`,
      });
      if (roll["autoFail"] === true) rows.push({ label: "Natural 10", value: "always fails" });
    }
    return { title: "The Death Save", trace: event.summary ?? null, rows };
  }
  return null;
}

/** The last shot the character took, hit or miss — the roll before the end. */
function lastShotOf(events: CampaignEvent[], name: string): Receipt | null {
  for (const event of newestFirst(events)) {
    if (event.type !== "attack") continue;
    const shot = readAttackEventData(event.data);
    if (!shot || !sameName(shot.attacker, name)) continue;
    const rows: ReceiptRow[] = [
      { label: "At", value: shot.weapon ? `${shot.target} · ${shot.weapon}` : shot.target },
      { label: "Result", value: shot.hit === false ? "missed" : shot.hit ? "hit" : "—" },
    ];
    if (shot.hit !== false && shot.damage !== null) {
      rows.push({ label: "Damage rolled", value: String(shot.damage) });
    }
    return { title: "Your last shot", trace: event.summary ?? null, rows };
  }
  return null;
}

/** What the player last told the character to do, cut to a line. */
function lastWordsOf(events: CampaignEvent[]): string | null {
  for (const event of newestFirst(events)) {
    if (event.type !== "player_input") continue;
    const text = (event.summary ?? "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    return text.length > LAST_WORDS_MAX ? `${text.slice(0, LAST_WORDS_MAX - 1).trimEnd()}…` : text;
  }
  return null;
}

const RELATION: Record<string, { text: string; order: number }> = {
  friend: { text: "your friend", order: 0 },
  old_flame: { text: "your old flame", order: 1 },
  fixer: { text: "your fixer", order: 2 },
  enemy: { text: "the one who wanted you dead", order: 3 },
  ripperdoc: { text: "your ripperdoc", order: 4 },
  landlord: { text: "your landlord", order: 5 },
};

function toneOfDisposition(disposition: number): ObituaryTone {
  return disposition > 0 ? "good" : disposition < 0 ? "bad" : "neutral";
}

/** The people the campaign knew, named in the order their loss would be felt. */
function mournersOf(npcs: CampaignNpc[]): Mourner[] {
  const ranked = npcs.map((npc) => {
    const role = ((npc.data ?? {}) as { role?: unknown }).role;
    const known = typeof role === "string" ? RELATION[role] : undefined;
    return { npc, known };
  });
  // The standing six come first, in the order above. Anyone else only earns a
  // line by feeling strongly about the character, either way.
  const cast = ranked
    .filter((r) => r.known)
    .sort((a, b) => a.known!.order - b.known!.order || a.npc.name.localeCompare(b.npc.name));
  const others = ranked
    .filter((r) => !r.known && Math.abs(r.npc.disposition) >= 2 && r.npc.status !== "dead")
    .sort(
      (a, b) =>
        Math.abs(b.npc.disposition) - Math.abs(a.npc.disposition) ||
        a.npc.name.localeCompare(b.npc.name),
    );
  return [...cast, ...others].slice(0, MOURNERS_SHOWN).map(({ npc, known }) => {
    const dead = npc.status === "dead";
    return {
      name: npc.name,
      relation: known?.text ?? "someone you knew",
      feeling: dead ? "already dead" : dispositionBand(npc.disposition).label,
      tone: dead ? "bad" : toneOfDisposition(npc.disposition),
    };
  });
}

function epitaphOf(input: ObituaryInput): string {
  const { name, day, tally } = input;
  if (day <= 1) return `${name} did not see a second day in Night City.`;
  const reached = `${name} made it to day ${day}`;
  if (tally.jobsFinished === 0) return `${reached}, and never finished a job.`;
  return `${reached} and finished ${plural(tally.jobsFinished, "job", "jobs")}.`;
}

function recordOf(input: ObituaryInput): Obituary["record"] {
  const lines: Obituary["record"] = [];
  const { tally } = input;
  if (tally.jobsTaken > 0) {
    const open = Math.max(0, tally.jobsTaken - tally.jobsFinished);
    const parts = [`${plural(tally.jobsTaken, "job", "jobs")} taken`];
    if (tally.jobsFinished > 0) parts.push(`${tally.jobsFinished} finished`);
    if (open > 0) parts.push(`${open} left unfinished`);
    lines.push({ text: parts.join(", "), tone: "neutral" });
  }
  if (input.unfinishedJob) {
    lines.push({ text: `Died on the job: ${input.unfinishedJob}`, tone: "bad" });
  }
  if (tally.bodies > 0) {
    lines.push({
      text: `${plural(tally.bodies, "person", "people")} died on their jobs`,
      tone: "bad",
    });
  }
  if (input.reputation.level > 0) {
    lines.push({
      text: input.reputation.whoKnows
        ? `Reputation ${input.reputation.level}: ${input.reputation.whoKnows}`
        : `Reputation ${input.reputation.level}`,
      tone: "good",
    });
  }
  for (const s of [...input.standings]
    .filter((s) => isFactionId(s.factionId) && s.standing !== 0)
    .sort((a, b) => Math.abs(b.standing) - Math.abs(a.standing))
    .slice(0, 2)) {
    lines.push({
      text: `${getFaction(s.factionId).name}: ${standingBand(s.standing).label}`,
      tone: s.standing > 0 ? "good" : "bad",
    });
  }
  if (input.eurobucks > 0) {
    lines.push({ text: `Died with ${input.eurobucks}eb to their name`, tone: "neutral" });
  }
  return lines;
}

export function obituary(input: ObituaryInput): Obituary {
  const roleName = input.roleId ? (ROLE_NAMES[input.roleId]?.name ?? input.roleId) : null;
  return {
    name: input.name,
    role: roleName,
    when: `Day ${input.day} · ${weekdayFor(input.day)} · ${formatTimeOfDay(input.minute)}`,
    where: placeNameOf(input.locationKey),
    epitaph: epitaphOf(input),
    record: recordOf(input),
    lastBlow: lastBlowOf(input.events, input.name),
    finalSave: finalSaveOf(input.events, input.name),
    lastShot: lastShotOf(input.events, input.name),
    lastWords: lastWordsOf(input.events),
    mourners: mournersOf(input.npcs),
  };
}
