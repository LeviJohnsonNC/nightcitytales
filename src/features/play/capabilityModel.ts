/**
 * Building the capability snapshot the legality gate judges against.
 *
 * Pure mapping from persisted rows (the sheet, the campaign's kit, the live
 * fight, the event ledger) into the engine's CapabilitySnapshot. No dice, no
 * decisions, and no invented rules values: magazine sizes, ROF and range bands
 * come from the catalog through weaponProfile, and anything the rules data does
 * not print is left null for the gate to allow.
 */
import {
  EMPTY_TURN_ECONOMY,
  describeWeapon,
  getCyberware,
  itemName,
  luckRemaining,
  roleAbilityOf,
  weaponProfile,
  type CapabilitySnapshot,
  type CyberwareCapability,
  type FailedAttempt,
  type ItemCapability,
  type TargetCapability,
  type TurnEconomy,
  type WeaponCapability,
  type WoundStateCode,
} from "@/engine";
import type { LiveEncounter } from "@/features/campaign/encounterState";
import type { CombatantTurnState } from "./encounterModel";
import type {
  CampaignEvent,
  CampaignInventoryItem,
  CampaignVitals,
  FullCharacter,
} from "@/lib/backend";
import { statsRecord } from "./playModel";

/** Inventory rows that are ammunition, by campaign slot or catalog id. */
function isAmmunitionRow(row: CampaignInventoryItem): boolean {
  return row.slot === "ammunition" || row.item_id.endsWith("_ammo");
}

function inventoryFor(
  inventory: CampaignInventoryItem[],
  character: FullCharacter,
): CampaignInventoryItem[] {
  if (inventory.length > 0) return inventory;
  // A campaign started before the kit was copied still plays off the sheet.
  return character.gear.map((g) => ({
    id: g.id,
    campaign_id: "",
    kind: "gear",
    item_id: g.item_id,
    quantity: g.quantity,
    equipped: g.equipped,
    slot: g.slot,
    current_sp: g.current_sp,
    notes: g.notes,
    ammo_loaded: null,
    condition: "ok",
  }));
}

/** Every carried weapon, with what is loaded in it and what is spare. */
export function weaponCapabilities(rows: CampaignInventoryItem[]): WeaponCapability[] {
  const spareRounds = rows
    .filter(isAmmunitionRow)
    .reduce((sum, row) => sum + Math.max(0, row.quantity), 0);

  const out: WeaponCapability[] = [];
  for (const row of rows) {
    if (row.slot !== "weapon") continue;
    let profile;
    try {
      profile = weaponProfile(row.item_id);
    } catch {
      continue; // not a catalog weapon; the engine will not guess its numbers
    }
    // A weapon the catalog gives no magazine (melee, and the exotics printed
    // without one) has no ammunition to run out of.
    const roundsLoaded =
      profile.magazine === null
        ? null
        : row.ammo_loaded === null
          ? profile.magazine // pre-existing campaigns start the clock full
          : Math.max(0, row.ammo_loaded);
    out.push({
      itemId: profile.itemId,
      name: profile.name,
      melee: profile.melee,
      rof: profile.rof,
      magazine: profile.magazine,
      roundsLoaded,
      spareRounds,
      rangeType: profile.rangeType,
      damageDice: profile.damageDice,
      broken: row.condition === "broken",
    });
  }
  return out;
}

/** Everything else in the kit that still has something left of it. */
export function itemCapabilities(rows: CampaignInventoryItem[]): ItemCapability[] {
  const out: ItemCapability[] = [];
  for (const row of rows) {
    if (row.slot === "weapon" || row.kind === "cyberware") continue;
    if (row.quantity <= 0) continue;
    let name = row.item_id;
    for (const kind of ["gear", "ammunition", "armor", "fashion"] as const) {
      try {
        name = itemName(kind, row.item_id);
        break;
      } catch {
        // try the next catalog section
      }
    }
    out.push({ itemId: row.item_id, name, kind: row.slot ?? row.kind, quantity: row.quantity });
  }
  return out;
}

/** Installed chrome, with whether each piece's printed requirement is met. */
export function cyberwareCapabilities(character: FullCharacter): CyberwareCapability[] {
  const installed = new Set(character.cyberware.map((c) => c.item_id));
  return character.cyberware.map((row) => {
    let name = row.item_id;
    let requires: string | null = null;
    try {
      const def = getCyberware(row.item_id);
      name = def.name;
      requires = def.requires;
    } catch {
      // not in the catalog; report it as-is rather than dropping it
    }
    return {
      itemId: row.item_id,
      name,
      requires,
      prerequisiteMet: !requires || installed.has(requires),
    };
  });
}

/** Who the player can currently see and shoot at. */
export function targetCapabilities(live: LiveEncounter | null): TargetCapability[] {
  if (!live || live.state.status !== "active") return [];
  const out: TargetCapability[] = [];
  for (const combatant of Object.values(live.state.combatants)) {
    if (combatant.isPlayer) continue;
    const data = live.data[combatant.id];
    out.push({
      key: data?.key ?? combatant.id,
      id: combatant.id,
      name: combatant.name,
      distance: data?.distance ?? 0,
      defeated: combatant.defeated,
      perceivable: true,
    });
  }
  return out;
}

/** What is left of the player's Turn, from the live fight's own bookkeeping. */
export function turnEconomy(live: LiveEncounter | null, move: number): TurnEconomy {
  if (!live || live.state.status !== "active") return { ...EMPTY_TURN_ECONOMY, move };
  const player = Object.values(live.state.combatants).find((c) => c.isPlayer);
  const raw: Partial<CombatantTurnState> = (player ? live.data[player.id]?.turn : undefined) ?? {};
  const sameRound = raw.round === live.state.round;
  return {
    inCombat: true,
    actionUsed: sameRound ? (raw.actionUsed ?? false) : false,
    shotsThisRound: sameRound ? (raw.shotsThisRound ?? 0) : 0,
    shotWeaponId: sameRound ? (raw.shotWeaponId ?? null) : null,
    metresMoved: sameRound ? (raw.metresMoved ?? 0) : 0,
    move,
  };
}

/**
 * Checks that already failed in this beat, so the same approach is not simply
 * re-rolled. Reads the ledger's resolved skill checks; a new beat wipes the
 * slate because the circumstances have changed by definition.
 */
export function failedAttempts(events: CampaignEvent[], beatId: string | null): FailedAttempt[] {
  const out: FailedAttempt[] = [];
  for (const event of events) {
    if (event.type !== "skill_check" && event.type !== "opposed_check") continue;
    if ((event.beat_id ?? null) !== beatId) continue;
    const data = (event.data ?? {}) as { skillId?: unknown; intent?: unknown; success?: unknown };
    const roll = (event.roll ?? {}) as { success?: unknown };
    const success = typeof data.success === "boolean" ? data.success : roll.success;
    if (success !== false) continue;
    if (typeof data.skillId !== "string") continue;
    out.push({ skillId: data.skillId, intent: typeof data.intent === "string" ? data.intent : "" });
  }
  return out;
}

export type SnapshotInput = {
  character: FullCharacter;
  vitals: CampaignVitals;
  inventory: CampaignInventoryItem[];
  encounter: LiveEncounter | null;
  events: CampaignEvent[];
  beatId: string | null;
};

export function buildCapabilitySnapshot(input: SnapshotInput): CapabilitySnapshot {
  const stats = statsRecord(input.character);
  const rows = inventoryFor(input.inventory, input.character);
  const move = stats["move"] ?? 0;
  const ability = roleAbilityOf(input.character.character.role);
  const luckStats = { luck: stats["luck"] ?? 0 };

  return {
    hp: input.vitals.hp_current,
    hpMax: input.vitals.hp_max,
    woundState: input.vitals.wound_state as WoundStateCode,
    incapacitated: input.vitals.hp_current <= 0,
    eurobucks: input.vitals.eurobucks,
    luck: luckRemaining(input.vitals.luck_current, luckStats),
    move,
    weapons: weaponCapabilities(rows),
    items: itemCapabilities(rows),
    cyberware: cyberwareCapabilities(input.character),
    roleAbility: ability
      ? {
          abilityId: ability.abilityId,
          abilityName: ability.abilityName,
          rank: input.character.roleAbility?.rank ?? ability.startingRank,
        }
      : null,
    targets: targetCapabilities(input.encounter),
    turn: turnEconomy(input.encounter, move),
    failedAttempts: failedAttempts(input.events, input.beatId),
  };
}

/** The context lines the GM sees: what they can do, and what they cannot. */
export function renderCapabilityLines(snapshot: CapabilitySnapshot): string[] {
  const lines: string[] = [];
  lines.push(
    snapshot.weapons.length
      ? `Weapons carried: ${snapshot.weapons.map(describeWeapon).join("; ")}`
      : "Weapons carried: none — they are unarmed.",
  );
  const items = snapshot.items.filter((i) => i.quantity > 0);
  lines.push(
    items.length
      ? `Kit on hand: ${items.map((i) => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ""}`).join(", ")}`
      : "Kit on hand: nothing but what they are wearing.",
  );
  lines.push(
    snapshot.cyberware.length
      ? `Cyberware installed: ${snapshot.cyberware.map((c) => c.name).join(", ")}`
      : "Cyberware installed: none.",
  );
  if (snapshot.roleAbility) {
    lines.push(
      `Role Ability: ${snapshot.roleAbility.abilityName} at Rank ${snapshot.roleAbility.rank} — nothing above that Rank.`,
    );
  }
  lines.push(`MOVE ${snapshot.move}, Luck ${snapshot.luck} left, ${snapshot.eurobucks}eb.`);
  if (snapshot.turn.inCombat) {
    const t = snapshot.turn;
    lines.push(
      `This Round: ${t.actionUsed ? "Action already spent" : "Action available"}, ` +
        `${t.shotsThisRound} attack(s) made, ${t.metresMoved} m moved.`,
    );
    if (snapshot.targets.length) {
      lines.push(
        `Targets in the fight: ${snapshot.targets
          .map((t2) => `${t2.name} [${t2.key}] at ${t2.distance} m${t2.defeated ? " (down)" : ""}`)
          .join(", ")}`,
      );
    }
  }
  if (snapshot.incapacitated) {
    lines.push("They are down and Mortally Wounded: they cannot act until stabilised.");
  }
  return lines;
}

/**
 * Record that the attacker spent an attack this Round, so the ROF cap and the
 * one-Action rule have something real to read. Returns the encounter's `data`
 * map with the attacker's turn counters advanced; the caller persists it.
 */
export function withAttackSpent(
  live: LiveEncounter,
  attackerId: string,
  weaponItemId: string,
): Record<string, (typeof live.data)[string]> {
  const existing = live.data[attackerId];
  if (!existing) return live.data;
  const round = live.state.round;
  const prior = existing.turn?.round === round ? existing.turn : null;
  return {
    ...live.data,
    [attackerId]: {
      ...existing,
      turn: {
        round,
        actionUsed: true,
        shotsThisRound: (prior?.shotsThisRound ?? 0) + 1,
        shotWeaponId: weaponItemId,
        metresMoved: prior?.metresMoved ?? 0,
      },
    },
  };
}

/**
 * One round out of the weapon that just fired. Weapons the catalog gives no
 * magazine have no ammunition to spend, and a row that has never been fired
 * starts from its printed magazine.
 */
export function ammoAfterShot(
  rows: CampaignInventoryItem[],
  weaponItemId: string,
): { inventoryId: string; ammoLoaded: number } | null {
  const row = rows.find((r) => r.slot === "weapon" && r.item_id === weaponItemId);
  if (!row) return null;
  let magazine: number | null;
  try {
    magazine = weaponProfile(row.item_id).magazine;
  } catch {
    return null;
  }
  if (magazine === null) return null;
  const loaded = row.ammo_loaded === null ? magazine : row.ammo_loaded;
  return { inventoryId: row.id, ammoLoaded: Math.max(0, loaded - 1) };
}
