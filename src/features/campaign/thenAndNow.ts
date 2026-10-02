/**
 * Then and now: how far the character has come since the campaign began, and
 * what it cost.
 *
 * A RED character's numbers move surprisingly little across a campaign. What
 * changes is everything around them — the chrome, the gun, who returns the
 * call, who now has a file on them — and the game held all of it and never set
 * it side by side. This does, from what already exists rather than from a
 * snapshot taken for the purpose:
 *
 *   - day one is the saved character (play never writes its gear, chrome or
 *     stats), each person's starting disposition by the role they hold in the
 *     cast, and a city that started with no opinion of anyone;
 *   - what changed is the live rows, plus the ledger's own record of every
 *     Level and Rank bought (`skill_raised`, `role_rank_raised`) and every
 *     award (`ip_awarded`).
 *
 * Losses stand beside gains, on purpose. Humanity spent, a friend gone cold, a
 * gang that now wants you dead: that is part of how far you have come, and a
 * climb that only goes up is a score. Money is left out for the same reason
 * PRODUCT.md gives — a balance that grew is not a mechanic.
 *
 * Pure: rows in, lines out. No React, no Query.
 */
import {
  getCyberware,
  getFaction,
  hasCyberware,
  isFactionId,
  itemName,
  getPlace,
  housingById,
  lifestyleById,
  readIpAwardedEventData,
  readMovedHouseEventData,
  readRoleRankRaisedEventData,
  readSkillRaisedEventData,
  roleAbilityOf,
  skillEntryName,
  standingBand,
  STARTING_DISPOSITION,
  type CastRole,
  type FactionStanding,
  type ItemKind,
} from "@/engine";
import { dispositionBand } from "@/features/life/hud/hudModel";
import type {
  CampaignCyberware,
  CampaignEvent,
  CampaignInventoryItem,
  CampaignNpc,
  CampaignVitals,
  FullCharacter,
} from "@/lib/backend";

export type ClimbTone = "good" | "bad" | "neutral";
export type ClimbLine = { text: string; tone: ClimbTone };
export type ClimbSection = { title: string; lines: ClimbLine[] };

/** The ledger events this reads, so the loader can ask for exactly these. */
export const THEN_AND_NOW_EVENTS = [
  "skill_raised",
  "role_rank_raised",
  "ip_awarded",
  "moved_house",
] as const;

/** Slots on the saved sheet that hold a weapon or a piece of armor. */
const KIT_SLOTS: Record<string, ItemKind> = {
  weapon: "weapon",
  body: "armor",
  head: "armor",
  shield: "armor",
};

function safeName(kind: ItemKind, id: string): string | null {
  try {
    return itemName(kind, id);
  } catch {
    return null; // a legacy row holding a label the catalogue no longer knows
  }
}

/** One line per Skill line that moved: its first recorded Level to its last. */
function skillLines(events: CampaignEvent[], homeDistrictKey: string | null): ClimbLine[] {
  const span = new Map<string, { name: string; from: number; to: number }>();
  for (const event of events) {
    if (event.type !== "skill_raised") continue;
    const raise = readSkillRaisedEventData(event.data);
    if (!raise) continue;
    const key = `${raise.skillId}::${raise.specialization ?? ""}`;
    const was = span.get(key);
    span.set(key, {
      name: skillEntryName(
        { skillId: raise.skillId, specialization: raise.specialization },
        homeDistrictKey,
      ),
      from: was ? Math.min(was.from, raise.fromLevel) : raise.fromLevel,
      to: was ? Math.max(was.to, raise.toLevel) : raise.toLevel,
    });
  }
  return [...span.values()]
    .sort((a, b) => b.to - b.from - (a.to - a.from) || a.name.localeCompare(b.name))
    .map((s) => ({
      text: s.from === 0 ? `${s.name}: learned, now ${s.to}` : `${s.name} ${s.from} → ${s.to}`,
      tone: "good",
    }));
}

function rankLine(events: CampaignEvent[], roleId: string | null): ClimbLine[] {
  let from: number | null = null;
  let to: number | null = null;
  for (const event of events) {
    if (event.type !== "role_rank_raised") continue;
    const raise = readRoleRankRaisedEventData(event.data);
    if (!raise) continue;
    from = from === null ? raise.fromRank : Math.min(from, raise.fromRank);
    to = to === null ? raise.toRank : Math.max(to, raise.toRank);
  }
  if (from === null || to === null) return [];
  const name = roleAbilityOf(roleId)?.abilityName ?? "Role Ability";
  return [{ text: `${name} Rank ${from} → ${to}`, tone: "good" }];
}

function ipEarned(events: CampaignEvent[]): number {
  return events
    .filter((e) => e.type === "ip_awarded")
    .reduce((sum, e) => sum + (readIpAwardedEventData(e.data)?.ip ?? 0), 0);
}

/** Names that are in `now` and not `then`, and the reverse, counting duplicates. */
function diffNames(then: string[], now: string[]): { gained: string[]; lost: string[] } {
  const left = [...then];
  const gained: string[] = [];
  for (const name of now) {
    const i = left.indexOf(name);
    if (i === -1) gained.push(name);
    else left.splice(i, 1);
  }
  return { gained, lost: left };
}

export function thenAndNow(input: {
  day: number;
  character: FullCharacter;
  vitals: CampaignVitals;
  inventory: CampaignInventoryItem[];
  cyberware: CampaignCyberware[];
  npcs: CampaignNpc[];
  standings: FactionStanding[];
  /** The campaign's skill_raised, role_rank_raised and ip_awarded events. */
  events: CampaignEvent[];
}): ClimbSection[] {
  const sections: ClimbSection[] = [];
  const roleId = input.character.character.role ?? null;
  const home = input.character.finance?.home_district_key ?? null;

  // Growth: what the I.P. bought.
  const growth = [...rankLine(input.events, roleId), ...skillLines(input.events, home)];
  const earned = ipEarned(input.events);
  if (earned > 0) growth.push({ text: `${earned} Improvement Points earned`, tone: "neutral" });
  if (growth.length) sections.push({ title: "What you can do", lines: growth });

  // Chrome: day one is the saved sheet; anything installed in play is new.
  const chromeThen = input.character.cyberware
    .map((c) => c.item_id)
    .filter(hasCyberware)
    .map((id) => getCyberware(id).name);
  const chromeNow = input.cyberware
    .map((c) => c.item_id)
    .filter(hasCyberware)
    .map((id) => getCyberware(id).name);
  const chrome = diffNames(chromeThen, chromeNow);
  const body: ClimbLine[] = [
    ...chrome.gained.map((name) => ({ text: `${name} installed`, tone: "good" as const })),
    ...chrome.lost.map((name) => ({ text: `${name} gone`, tone: "bad" as const })),
  ];
  const humanityThen =
    input.character.stats?.humanity_current ?? input.character.stats?.humanity_max ?? null;
  const humanityNow = input.vitals.humanity_current;
  if (humanityThen !== null && humanityNow !== humanityThen) {
    body.push({
      text: `Humanity ${humanityThen} → ${humanityNow}`,
      tone: humanityNow < humanityThen ? "bad" : "good",
    });
  }
  if (body.length) sections.push({ title: "Chrome and the cost of it", lines: body });

  // Kit: weapons and armor only. Ammunition and sundries come and go every
  // night, and a list of spent magazines is noise, not a climb.
  const kitThen = input.character.gear.flatMap((g) => {
    const kind = g.slot ? KIT_SLOTS[g.slot] : undefined;
    const name = kind ? safeName(kind, g.item_id) : null;
    return name ? [name] : [];
  });
  const kitNow = input.inventory.flatMap((row) => {
    if (row.kind !== "weapon" && row.kind !== "armor") return [];
    const name = safeName(row.kind, row.item_id);
    return name ? [name] : [];
  });
  const kit = diffNames(kitThen, kitNow);
  const kitLines: ClimbLine[] = [
    ...kit.gained.map((name) => ({ text: `${name}, new`, tone: "good" as const })),
    ...kit.lost.map((name) => ({ text: `${name}, gone`, tone: "bad" as const })),
  ];
  if (kitLines.length) sections.push({ title: "What you carry", lines: kitLines });

  // Home: the first move's "from" is where they started, the last one's "to"
  // is where they live. Neither better nor worse — a dearer flat is a bigger
  // bill — so it is told plainly.
  const moves = input.events
    .filter((e) => e.type === "moved_house")
    .map((e) => readMovedHouseEventData(e.data))
    .filter((m): m is NonNullable<typeof m> => m !== null);
  const first = moves[0];
  const last = moves.at(-1);
  if (first && last) {
    const homeLines: ClimbLine[] = [];
    const where = (housing: string, place: string | null) =>
      `${housingById(housing)?.name ?? housing}${place ? `, ${getPlace(place)?.name ?? place}` : ""}`;
    const then = where(first.fromHousing, first.fromPlace);
    const now = where(last.toHousing, last.toPlace);
    if (then !== now) homeLines.push({ text: `${then} → ${now}`, tone: "neutral" });
    if (first.fromLifestyle !== last.toLifestyle) {
      const name = (id: string) => lifestyleById(id)?.name ?? id;
      homeLines.push({
        text: `${name(first.fromLifestyle)} → ${name(last.toLifestyle)}`,
        tone: "neutral",
      });
    }
    if (homeLines.length) sections.push({ title: "Where you live", lines: homeLines });
  }

  // People: the standing six, against where each began. In words, not numbers:
  // how somebody feels about you is meant to be felt.
  const people: ClimbLine[] = [];
  for (const npc of input.npcs) {
    const role = ((npc.data ?? {}) as { role?: unknown }).role;
    if (typeof role !== "string" || !(role in STARTING_DISPOSITION)) continue;
    if (npc.status === "dead") {
      people.push({ text: `${npc.name}: dead`, tone: "bad" });
      continue;
    }
    const then = STARTING_DISPOSITION[role as CastRole];
    if (npc.disposition === then) continue;
    const from = dispositionBand(then).label;
    const to = dispositionBand(npc.disposition).label;
    people.push({
      text: from === to ? `${npc.name}: still ${to}` : `${npc.name}: ${from} → ${to}`,
      tone: npc.disposition > then ? "good" : "bad",
    });
  }
  if (people.length) sections.push({ title: "Who you know", lines: people });

  // Factions: every one began with no opinion at all.
  const standing = input.standings
    .filter((s) => isFactionId(s.factionId) && s.standing !== 0)
    .sort((a, b) => Math.abs(b.standing) - Math.abs(a.standing))
    .map((s) => ({
      text: `${getFaction(s.factionId).name}: ${standingBand(0).label} → ${standingBand(s.standing).label}`,
      tone: s.standing > 0 ? ("good" as const) : ("bad" as const),
    }));
  if (standing.length) sections.push({ title: "Who knows your name", lines: standing });

  return sections;
}
