/**
 * A campaign's Role Ability, as the play loop sees it.
 *
 * Reads which ability the character has, what Rank they hold it at, and any
 * live state stored for it (a Solo's Combat Awareness division). Pure: it
 * decides nothing mechanical, it only assembles what the engine needs.
 */
import {
  combatAwarenessEffects,
  fieldExpertiseBonus,
  makerSpecialtyPool,
  medicineSkillLevels,
  operatorHaggleBonus,
  roleAbilityOf,
  teamMemberSlots,
  canDrive,
  getVehicle,
  motorpoolFor,
  MOTORPOOL_SWAP_HOUR,
  vehicleFamiliarityBonus,
  vehicleTravelRule,
  type TravelModeRule,
  type Vehicle,
  type CombatantRoleEffects,
  type CombatAwarenessAllocation,
  type CombatAwarenessEffects,
  type RoleAbilityInfo,
} from "@/engine";
import type { Campaign, FullCharacter } from "@/lib/backend";
import type { LiveEncounter } from "@/features/campaign/encounterState";
import type { PendingBackup } from "./backupFlow";

export type LiveRoleAbility = {
  info: RoleAbilityInfo;
  /** The Rank on the sheet, falling back to the Role's starting Rank. */
  rank: number;
};

/** The character's Role Ability and Rank, or null when the Role has none. */
export function liveRoleAbility(character: FullCharacter): LiveRoleAbility | null {
  const info = roleAbilityOf(character.character.role ?? null);
  if (!info) return null;
  const stored = character.roleAbility?.rank;
  const rank = typeof stored === "number" ? stored : info.startingRank;
  return { info, rank };
}

/** Live state for one ability, out of the campaign's role_state blob. */
function abilityState(campaign: Campaign, abilityId: string): Record<string, unknown> {
  const all = (campaign.role_state ?? {}) as Record<string, unknown>;
  const one = all[abilityId];
  return one && typeof one === "object" ? (one as Record<string, unknown>) : {};
}

/** A Solo's current division of their Combat Awareness pool. */
export function combatAwarenessAllocation(campaign: Campaign): CombatAwarenessAllocation {
  const raw = abilityState(campaign, "combat_awareness")["allocation"];
  if (!raw || typeof raw !== "object") return {};
  const out: CombatAwarenessAllocation = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      out[key] = Math.trunc(value);
    }
  }
  return out;
}

/** The role_state blob with one ability's state replaced. */
export function withAbilityState(
  campaign: Campaign,
  abilityId: string,
  state: Record<string, unknown>,
): Record<string, unknown> {
  const all = (campaign.role_state ?? {}) as Record<string, unknown>;
  return { ...all, [abilityId]: state };
}

/**
 * What a Solo's current division is doing right now. Null for every other Role,
 * so callers can ask unconditionally.
 */
export function combatAwarenessFor(
  campaign: Campaign,
  character: FullCharacter,
): (CombatAwarenessEffects & { rank: number }) | null {
  const ability = liveRoleAbility(character);
  if (!ability || ability.info.abilityId !== "combat_awareness") return null;
  const effects = combatAwarenessEffects(combatAwarenessAllocation(campaign), ability.rank);
  return { ...effects, rank: ability.rank };
}

/**
 * The slice of a Role Ability the combat engine applies itself, for this
 * character right now — or null for a Role that changes nothing in a fight.
 *
 * This is RECOMPUTED rather than persisted, and deliberately. Combat Awareness
 * is re-divisible outside combat, so a division made between fights has to
 * reach the next one; and combatant rows carry no role effects, so a fight read
 * back from the database would otherwise come back with the Solo's entire Role
 * Ability switched off. Only Initiative survived that, because Initiative is
 * rolled once at the start and stored as a number.
 */
export function combatRoleEffects(
  campaign: Campaign,
  character: FullCharacter,
): CombatantRoleEffects | null {
  const awareness = combatAwarenessFor(campaign, character);
  if (!awareness) return null;
  return {
    initiative: awareness.initiative,
    attack: awareness.attack,
    damageDeflection: awareness.damageDeflection,
    spotWeakness: awareness.spotWeakness,
    fumbleRecovery: awareness.fumbleRecovery,
  };
}

/**
 * A loaded encounter with the player's live Role effects put back on them.
 *
 * Null encounter in, null out, so the caller can hand it whatever it has.
 */
export function withPlayerRoleEffects(
  live: LiveEncounter | null,
  effects: CombatantRoleEffects | null,
): LiveEncounter | null {
  if (!live || !effects) return live;
  const player = Object.values(live.state.combatants).find((c) => c.isPlayer);
  if (!player) return live;
  return {
    ...live,
    state: {
      ...live.state,
      combatants: {
        ...live.state.combatants,
        [player.id]: { ...player, roleEffects: effects },
      },
    },
  };
}

/** Backup that has answered and is on its way, if any. */
export function pendingBackup(campaign: Campaign): PendingBackup | null {
  const raw = abilityState(campaign, "backup")["pending"];
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (typeof p["tierName"] !== "string" || typeof p["arrivesOnRound"] !== "number") return null;
  return {
    tierName: p["tierName"],
    arrivesOnRound: p["arrivesOnRound"],
    groups: typeof p["groups"] === "number" ? p["groups"] : 1,
  };
}

/**
 * A Nomad's Family Motorpool, and which of it is out.
 *
 * The printed rule is that a Nomad may have ONE Family Vehicle out at a time
 * and calls the Family to swap it for another the next morning. `available` is
 * everything their Rank permits; `out` is the one they are actually driving.
 *
 * A Nomad who has never chosen is driving the first thing their Rank reaches
 * rather than nothing. That is the difference between a Role Ability and a
 * settings screen: the vehicle is theirs, and having to go and switch it on
 * before it exists is how the last version of this gave them a modifier and no
 * machine.
 */
export type LiveMotorpool = {
  available: Vehicle[];
  out: Vehicle | null;
  /** The vehicle the Family is bringing, and the day it arrives. */
  incoming: { vehicle: Vehicle; arrivesOnDay: number } | null;
};

export function liveMotorpool(campaign: Campaign, character: FullCharacter): LiveMotorpool | null {
  const ability = liveRoleAbility(character);
  if (!ability || ability.info.abilityId !== "moto") return null;

  const available = motorpoolFor(ability.rank);
  const state = abilityState(campaign, "moto");
  const stored = typeof state["vehicleId"] === "string" ? state["vehicleId"] : null;
  // A stored vehicle their Rank no longer reaches is not driven. Ranks do not
  // fall in this game, but a rules edit can move a tier, and quietly driving
  // something the motorpool disowns is worse than falling back.
  const chosen =
    (stored && canDrive(ability.rank, stored) ? getVehicle(stored) : null) ?? available[0] ?? null;

  const swapId = typeof state["swapId"] === "string" ? state["swapId"] : null;
  const swapDay = typeof state["swapDay"] === "number" ? state["swapDay"] : null;
  const swapVehicle = swapId && canDrive(ability.rank, swapId) ? getVehicle(swapId) : null;

  // The swap lands on READ rather than on a tick somebody has to remember to
  // run: once the morning it was promised for has come, that is the vehicle
  // outside. Nothing needs to have happened in between, which is the point —
  // the Family turned up whether or not the player opened a screen.
  const arrived = swapVehicle !== null && swapDay !== null && (campaign.day ?? 0) >= swapDay;
  return {
    available,
    out: arrived ? swapVehicle : chosen,
    incoming:
      swapVehicle && swapDay !== null && !arrived
        ? { vehicle: swapVehicle, arrivesOnDay: swapDay }
        : null,
  };
}

/**
 * The role_state a call to the Family leaves behind: what is coming and when.
 *
 * "The next morning" is the printed promise; the hour it lands at is the one
 * house rule in it, and vehicles.json says so. A call placed before that hour
 * still arrives the same day — you called in the small hours and it was there
 * when you got up.
 */
export function motorpoolSwapState(
  campaign: Campaign,
  character: FullCharacter,
  vehicleId: string,
): Record<string, unknown> {
  const day = campaign.day ?? 0;
  const minute = campaign.minute ?? 0;
  const beforeTheDrop = minute < MOTORPOOL_SWAP_HOUR * 60;
  // A previous swap that has already landed is settled on the way past, so the
  // vehicle they are driving right now is the one they keep until this new one
  // turns up. Without it a second call would put them back in the machine they
  // swapped out of, for a day, for no reason anybody could see.
  const settled = liveMotorpool(campaign, character)?.out?.id ?? null;
  return {
    ...abilityState(campaign, "moto"),
    ...(settled ? { vehicleId: settled } : {}),
    swapId: vehicleId,
    swapDay: beforeTheDrop ? day : day + 1,
  };
}

/**
 * The travel rule for whatever this character is driving, or null when they are
 * on foot like everybody else.
 *
 * Callers ask unconditionally, which is what keeps every travel site from
 * having to know what a Nomad is.
 */
export function liveVehicleRule(
  campaign: Campaign,
  character: FullCharacter,
): TravelModeRule | null {
  const vehicle = liveMotorpool(campaign, character)?.out;
  return vehicle ? vehicleTravelRule(vehicle) : null;
}

/** Positive whole numbers out of a stored map, ignoring anything else. */
function numberMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0)
      out[key] = Math.trunc(value);
  }
  return out;
}

/** A Tech's division of their Maker Specialty ranks. */
export function makerSpecialties(campaign: Campaign): Record<string, number> {
  return numberMap(abilityState(campaign, "maker")["specialties"]);
}

/** How many Specialty ranks a Tech has to spend, and how many are spent. */
export function makerSpecialtyBudget(
  campaign: Campaign,
  character: FullCharacter,
): { pool: number; spent: number } | null {
  const ability = liveRoleAbility(character);
  if (!ability || ability.info.abilityId !== "maker") return null;
  const allocation = makerSpecialties(campaign);
  const spent = Object.values(allocation).reduce((sum, value) => sum + value, 0);
  return { pool: makerSpecialtyPool(ability.rank), spent };
}

/** A Medtech's division of their Medicine Specialty points. */
export function medicineSpecialties(campaign: Campaign): Record<string, number> {
  return numberMap(abilityState(campaign, "medicine")["specialties"]);
}

/** Doses a Medtech has synthesized and not yet used, by drug id. */
export function medicineDoses(campaign: Campaign): Record<string, number> {
  return numberMap(abilityState(campaign, "medicine")["doses"]);
}

/** The Skill Levels those Specialty points buy, ready to add to a check. */
export function medicineSkills(campaign: Campaign): Record<string, number> {
  return medicineSkillLevels(medicineSpecialties(campaign));
}

/** One of an Exec's Team Members. */
export type TeamMember = {
  id: string;
  name: string;
  memberClass: string;
  statRoll: number;
  loyalty: number;
};

/** The Exec's team, and how many slots their Rank supports. */
export function execTeam(
  campaign: Campaign,
  character: FullCharacter,
): { members: TeamMember[]; slots: number } | null {
  const ability = liveRoleAbility(character);
  if (!ability || ability.info.abilityId !== "teamwork") return null;
  const raw = abilityState(campaign, "teamwork")["members"];
  const members: TeamMember[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") continue;
      const m = entry as Record<string, unknown>;
      if (typeof m["id"] !== "string" || typeof m["name"] !== "string") continue;
      members.push({
        id: m["id"],
        name: m["name"],
        memberClass: typeof m["memberClass"] === "string" ? m["memberClass"] : "Team Member",
        statRoll: typeof m["statRoll"] === "number" ? m["statRoll"] : 0,
        loyalty: typeof m["loyalty"] === "number" ? m["loyalty"] : 0,
      });
    }
  }
  return { members, slots: teamMemberSlots(ability.rank) };
}

/**
 * Every Role-Ability modifier that applies to one skill check, as labelled roll
 * modifiers. Empty for a Role with nothing to say about this check — which is
 * most Roles on most checks, and is the point: the ones that speak up are the
 * ones the fiction says should.
 */
export function roleCheckModifiers(input: {
  campaign: Campaign;
  character: FullCharacter;
  skillId: string;
}): { label: string; value: number }[] {
  const ability = liveRoleAbility(input.character);
  if (!ability) return [];
  const out: { label: string; value: number }[] = [];

  // Solo: Threat Detection is points spent on seeing it coming.
  const awareness = combatAwarenessFor(input.campaign, input.character);
  if (awareness && input.skillId === "perception" && awareness.perception > 0) {
    out.push({ label: "Threat Detection", value: awareness.perception });
  }

  // Tech: Field Expertise rides on the printed list of Tech Skills.
  const field = fieldExpertiseBonus({
    abilityId: ability.info.abilityId,
    specialtyRank: makerSpecialties(input.campaign)["field_expertise"] ?? 0,
    skillId: input.skillId,
  });
  if (field > 0) out.push({ label: "Field Expertise", value: field });

  // Nomad: the Moto Rank rides on anything they drive, fly, sail or fix.
  const moto = vehicleFamiliarityBonus({
    abilityId: ability.info.abilityId,
    rank: ability.rank,
    skillId: input.skillId,
  });
  if (moto > 0) out.push({ label: "Moto", value: moto });

  // Medtech: Specialty points ARE Skill Levels in Surgery and Medical Tech, so
  // they land on a check as the Skill the character does not otherwise have.
  if (ability.info.abilityId === "medicine") {
    const level = medicineSkills(input.campaign)[input.skillId] ?? 0;
    if (level > 0) out.push({ label: "Medicine", value: level });
  }

  // Fixer: the Operator Rank is part of the printed Haggle roll.
  const haggle = operatorHaggleBonus({
    abilityId: ability.info.abilityId,
    rank: ability.rank,
    skillId: input.skillId,
  });
  if (haggle > 0) out.push({ label: "Operator", value: haggle });

  return out;
}
