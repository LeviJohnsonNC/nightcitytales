/**
 * The payload contract for the ledger events the engine reads back.
 *
 * WHY THIS EXISTS. `campaign_events.data` is a jsonb column. Every write casts
 * through `as unknown as Json`, and every read reconstructs the payload by
 * hand — `typeof data["hp_before"] === "number" ? … : []`. That is careful, and
 * it is the problem: the two sides agree on field names by coincidence, and
 * when they stop agreeing nothing throws. `readMechanicalCost` returns ZERO
 * rows and the job settles with no HP cost on the receipt, which is a
 * confidently wrong answer rather than a failure.
 *
 * It is the same shape as the outage `AGENTS.md` records — `save_encounter_state`
 * filtering on a column the surviving CREATE TABLE never made, silent because
 * nothing type-checked across the boundary.
 *
 * So one module owns each payload, and BOTH sides go through it:
 *
 *   - the writer builds with `attackEventData(...)`, so the field names are
 *     produced rather than typed out;
 *   - the reader parses with `readAttackEventData(...)`, so a payload that does
 *     not match is `null` at one place instead of silently-absent at six.
 *
 * A rename is then a TYPE error at the writer and a test failure on the
 * round-trip, which is a stronger guarantee than validating at runtime only.
 *
 * NO ZOD, deliberately. `src/engine/` imports no third-party library at all,
 * and that is worth more than the nicer error messages would be: the engine
 * takes plain objects and returns plain objects, and a schema library in here
 * would be the first crack in that. These are plain narrowing functions, which
 * is what the readers were already doing by hand.
 *
 * Only the events something READS BACK belong here. An event written purely for
 * the player to read is prose, and prose has no contract to break.
 */

import { isObservation, type Observation } from "./clocks";
import { isFactionId } from "./factions";
import type { Goal } from "./goals";

/** The event types whose payloads carry mechanical weight. */
export const LEDGER_EVENTS = {
  attack: "attack",
  deathSave: "death_save",
  skillCheck: "skill_check",
  backupCalled: "backup_called",
  encounterStarted: "encounter_started",
  skillRaised: "skill_raised",
  ipAwarded: "ip_awarded",
  roleRankRaised: "role_rank_raised",
  goalsPinned: "goals_pinned",
  jobSettled: "job_settled",
} as const;

export type LedgerEventType = (typeof LEDGER_EVENTS)[keyof typeof LEDGER_EVENTS];

/** A jsonb payload, before anybody has claimed to know what is in it. */
export type RawPayload = Record<string, unknown>;

/** The `data` of an event, or an empty bag. Arrays and nulls are not payloads. */
export function payloadOf(event: { data?: unknown }): RawPayload {
  return event.data && typeof event.data === "object" && !Array.isArray(event.data)
    ? (event.data as RawPayload)
    : {};
}

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

// ---------------------------------------------------------------------------
// attack
// ---------------------------------------------------------------------------

/**
 * Where a hit landed, and which armor piece paid for it.
 *
 * Deliberately NOT catalog.ts's `ArmorLocation`, which is where armor can be
 * WORN and includes "shield". A shield is not a place a body can be shot.
 */
export type HitLocation = "head" | "body";

/**
 * What a resolved attack records.
 *
 * The optional half is the damage half: an attack that MISSED has no HP or SP
 * numbers, and that is a real state rather than a broken payload — which is why
 * the parser accepts it and callers check the fields they need.
 */
export type AttackEventData = {
  attacker: string;
  target: string;
  /**
   * Null when the row does not say. Treat that as "not known to be a hit"
   * rather than as a miss — the damage fields are read either way, which is
   * what keeps an old row from silently costing the player nothing.
   */
  hit: boolean | null;
  margin: number | null;
  weapon: string | null;
  damage: number | null;
  throughArmor: number | null;
  bonusDamage: number | null;
  hpBefore: number | null;
  hpAfter: number | null;
  spBefore: number | null;
  spAfter: number | null;
  /** Whether the armor lost SP at all. How MUCH is sp_before - sp_after. */
  ablated: boolean;
  armorLocation: HitLocation;
  /** Whether this hit caused one. Which injury is not recorded — see ROADMAP. */
  criticalInjury: boolean;
  targetWoundState: string | null;
  ammo: { inventoryId: string; before: number; after: number } | null;
};

/**
 * The wire shape, which is what actually sits in the column.
 *
 * Snake_case and a different spelling from the domain type above on purpose:
 * these names are DATA, already written to rows that exist, and renaming a
 * field here silently reinterprets history. The mapping lives in one place so
 * that is a deliberate act rather than a typo.
 */
type AttackWire = {
  attacker: string;
  target: string;
  hit: boolean;
  margin?: number;
  weapon?: string;
  damage?: number;
  through_armor?: number;
  bonus_damage?: number;
  hp_before?: number;
  hp_after?: number;
  sp_before?: number;
  sp_after?: number;
  ablated?: boolean;
  armor_location?: HitLocation;
  critical_injury?: boolean;
  target_wound_state?: string;
  ammo?: { inventoryId: string; before: number; after: number };
};

/** Build the payload for a resolved attack. The only place these names are written. */
export function attackEventData(input: {
  attacker: string;
  target: string;
  hit: boolean;
  margin: number;
  weapon?: string | undefined;
  ammo?: { inventoryId: string; before: number; after: number } | undefined;
  targetWoundState?: string | undefined;
  damage?: number | undefined;
  /** Present only when damage was applied: a miss has none of it. */
  applied?:
    | {
        damageThroughArmor: number;
        bonusDamage: number;
        hpAfter: number;
        totalHpLoss: number;
        spBefore: number;
        spAfter: number;
        ablated: boolean;
        criticalInjury: boolean;
        armorLocation: HitLocation;
      }
    | undefined;
}): AttackWire {
  const wire: AttackWire = {
    attacker: input.attacker,
    target: input.target,
    hit: input.hit,
    margin: input.margin,
  };
  if (input.weapon !== undefined) wire.weapon = input.weapon;
  if (input.ammo !== undefined) wire.ammo = input.ammo;
  if (input.damage !== undefined) wire.damage = input.damage;
  if (input.targetWoundState !== undefined) wire.target_wound_state = input.targetWoundState;

  const applied = input.applied;
  if (applied) {
    wire.through_armor = applied.damageThroughArmor;
    wire.bonus_damage = applied.bonusDamage;
    // hp_before is not carried on the result: it is the floor plus what was
    // lost, and reconstructing it here keeps the receipt able to show both.
    wire.hp_before = applied.hpAfter + applied.totalHpLoss;
    wire.hp_after = applied.hpAfter;
    wire.sp_before = applied.spBefore;
    wire.sp_after = applied.spAfter;
    wire.ablated = applied.ablated;
    wire.armor_location = applied.armorLocation;
    wire.critical_injury = applied.criticalInjury;
  }
  return wire;
}

/** Read an attack payload back, or null when it is not one. */
export function readAttackEventData(raw: unknown): AttackEventData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const d = raw as RawPayload;

  const attacker = str(d["attacker"]);
  const target = str(d["target"]);
  // Attacker and target are the identity of the row: without them there is
  // nothing to price, and guessing would be worse than declining to.
  //
  // `hit` deliberately is NOT part of that. Requiring it would reject any row
  // that predates the field and throw away its HP, armor and ammunition with
  // it — which is the silent-zero this module exists to prevent, arriving by
  // the front door.
  if (attacker === null || target === null) return null;

  const ammoRaw = d["ammo"];
  let ammo: AttackEventData["ammo"] = null;
  if (ammoRaw && typeof ammoRaw === "object" && !Array.isArray(ammoRaw)) {
    const a = ammoRaw as RawPayload;
    const inventoryId = str(a["inventoryId"]);
    const before = num(a["before"]);
    const after = num(a["after"]);
    if (inventoryId !== null && before !== null && after !== null) {
      ammo = { inventoryId, before, after };
    }
  }

  return {
    attacker,
    target,
    hit: typeof d["hit"] === "boolean" ? d["hit"] : null,
    margin: num(d["margin"]),
    weapon: str(d["weapon"]),
    damage: num(d["damage"]),
    throughArmor: num(d["through_armor"]),
    bonusDamage: num(d["bonus_damage"]),
    hpBefore: num(d["hp_before"]),
    hpAfter: num(d["hp_after"]),
    spBefore: num(d["sp_before"]),
    spAfter: num(d["sp_after"]),
    ablated: d["ablated"] === true,
    // Body is the default because it is where an unlocated hit lands, and the
    // writer has always written one: this only covers rows older than that.
    armorLocation: d["armor_location"] === "head" ? "head" : "body",
    criticalInjury: d["critical_injury"] === true,
    targetWoundState: str(d["target_wound_state"]),
    ammo,
  };
}

// ---------------------------------------------------------------------------
// death_save
// ---------------------------------------------------------------------------

export type DeathSaveEventData = { combatant: string; died: boolean; survived: boolean };

type DeathSaveWire = { combatant: string; died: boolean; survived: boolean };

export function deathSaveEventData(input: { combatant: string; died: boolean }): DeathSaveWire {
  return { combatant: input.combatant, died: input.died, survived: !input.died };
}

export function readDeathSaveEventData(raw: unknown): DeathSaveEventData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const d = raw as RawPayload;
  const combatant = str(d["combatant"]);
  if (combatant === null || typeof d["died"] !== "boolean") return null;
  return { combatant, died: d["died"], survived: d["survived"] === true || !d["died"] };
}

// ---------------------------------------------------------------------------
// skill_check
// ---------------------------------------------------------------------------

/** Only the half settlement reads: which Skill, and whether it landed. */
export type SkillCheckEventData = { skillId: string; success: boolean | null };

export function readSkillCheckEventData(raw: unknown): SkillCheckEventData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const d = raw as RawPayload;
  const skillId = str(d["skill_id"]) ?? str(d["skillId"]);
  if (skillId === null) return null;
  return { skillId, success: typeof d["success"] === "boolean" ? d["success"] : null };
}

// ---------------------------------------------------------------------------
// backup_called
// ---------------------------------------------------------------------------

/** Whether the call was answered — an unanswered radio brings nobody. */
export type BackupCalledEventData = { responded: boolean };

export function readBackupCalledEventData(raw: unknown): BackupCalledEventData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const d = raw as RawPayload;
  if (typeof d["responded"] !== "boolean") return null;
  return { responded: d["responded"] };
}

// ---------------------------------------------------------------------------
// skill_raised — written by the database, not by TypeScript. `spend_ip_on_skill`
// appends it inside the same transaction that moves the Level, so the builder
// is a `jsonb_build_object` in a migration. `SKILL_RAISED_KEYS` is what that SQL
// must spell, and skillRaised.test.ts reads the newest definition of the
// function to hold it to them.
// ---------------------------------------------------------------------------

/** One Level bought with Improvement Points. */
export type SkillRaisedEventData = {
  skillId: string;
  /** The line's specialization, for a repeatable Skill; null otherwise. */
  specialization: string | null;
  fromLevel: number;
  toLevel: number;
  /** I.P. spent on this Level. */
  cost: number;
};

/** The jsonb keys the SQL writer uses, in the order it writes them. */
export const SKILL_RAISED_KEYS = [
  "skill_id",
  "specialization",
  "from_level",
  "to_level",
  "cost",
] as const;

export function readSkillRaisedEventData(raw: unknown): SkillRaisedEventData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const d = raw as RawPayload;
  const skillId = str(d["skill_id"]);
  const fromLevel = num(d["from_level"]);
  const toLevel = num(d["to_level"]);
  const cost = num(d["cost"]);
  if (skillId === null || fromLevel === null || toLevel === null || cost === null) return null;
  // One Level at a time is what the function enforces; anything else is not a
  // raise it could have written.
  if (toLevel !== fromLevel + 1) return null;
  return { skillId, specialization: str(d["specialization"]), fromLevel, toLevel, cost };
}

// ---------------------------------------------------------------------------
// role_rank_raised — like skill_raised, written by the database:
// `spend_ip_on_role_rank` appends it in the transaction that moves the Rank.
// `roleRankRaised.test.ts` holds the SQL's keys to ROLE_RANK_RAISED_KEYS.
// ---------------------------------------------------------------------------

export type RoleRankRaisedEventData = {
  abilityId: string;
  fromRank: number;
  toRank: number;
  cost: number;
};

export const ROLE_RANK_RAISED_KEYS = ["ability_id", "from_rank", "to_rank", "cost"] as const;

export function readRoleRankRaisedEventData(raw: unknown): RoleRankRaisedEventData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const d = raw as RawPayload;
  const abilityId = str(d["ability_id"]);
  const fromRank = num(d["from_rank"]);
  const toRank = num(d["to_rank"]);
  const cost = num(d["cost"]);
  if (abilityId === null || fromRank === null || toRank === null || cost === null) return null;
  if (toRank !== fromRank + 1) return null;
  return { abilityId, fromRank, toRank, cost };
}

// ---------------------------------------------------------------------------
// ip_awarded — read back to find where the next award's window starts, and
// what the player last declared. Written through `award_improvement_points`,
// which stores `data` as given, so the builder here is the whole contract.
// ---------------------------------------------------------------------------

/** What earned the points: a job closing, or a stretch of life with no award. */
export type IpAwardKind = "job" | "life";

export type IpAwardedEventData = {
  ip: number;
  /** "group" or a playstyle id: the column the award was read from. */
  source: string;
  descriptor: string;
  fromStandout: boolean;
  kind: IpAwardKind;
  /** The in-world day of the award; null on an award written before it was kept. */
  day: number | null;
  playstyles: { primary: string; secondary: string } | null;
};

type IpAwardedWire = {
  award: { ip: number; source: string; descriptor: string; fromStandout: boolean };
  judgement: unknown;
  playstyles: { primary: string; secondary: string };
  kind: IpAwardKind;
  day: number;
};

export function ipAwardedEventData(input: {
  award: { ip: number; source: string; descriptor: string; fromStandout: boolean };
  judgement: unknown;
  playstyles: { primary: string; secondary: string };
  kind: IpAwardKind;
  day: number;
}): IpAwardedWire {
  return {
    award: {
      ip: input.award.ip,
      source: input.award.source,
      descriptor: input.award.descriptor,
      fromStandout: input.award.fromStandout,
    },
    judgement: input.judgement,
    playstyles: { primary: input.playstyles.primary, secondary: input.playstyles.secondary },
    kind: input.kind,
    day: input.day,
  };
}

/**
 * Reads both shapes: the one above, and the one every award before it wrote —
 * the same `award` and `playstyles`, with no `kind` (all of them were jobs) and
 * no `day`.
 */
export function readIpAwardedEventData(raw: unknown): IpAwardedEventData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const d = raw as RawPayload;
  const award = d["award"];
  if (!award || typeof award !== "object" || Array.isArray(award)) return null;
  const a = award as RawPayload;
  const ip = num(a["ip"]);
  const source = str(a["source"]);
  if (ip === null || source === null) return null;
  const ps = d["playstyles"];
  const primary = ps && typeof ps === "object" ? str((ps as RawPayload)["primary"]) : null;
  const secondary = ps && typeof ps === "object" ? str((ps as RawPayload)["secondary"]) : null;
  return {
    ip,
    source,
    descriptor: str(a["descriptor"]) ?? "",
    fromStandout: a["fromStandout"] === true,
    kind: d["kind"] === "life" ? "life" : "job",
    day: num(d["day"]),
    playstyles: primary && secondary ? { primary, secondary } : null,
  };
}

// ---------------------------------------------------------------------------
// job_settled — the settlement receipt (`AftermathReport`), stored whole as the
// event's data by `settle_job`. Reputation reads back only two parts of it:
// what the city noticed, and the fee that was agreed.
// ---------------------------------------------------------------------------

export type JobSettledEventData = {
  /** How many times each thing was noticed. Absent means not at all. */
  noticed: Partial<Record<Observation, number>>;
  /** The fee agreed for the job, or 0 when the receipt does not say. */
  agreed: number;
};

export function readJobSettledEventData(raw: unknown): JobSettledEventData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const d = raw as RawPayload;
  const findings = d["findings"];
  if (!Array.isArray(findings)) return null;
  const noticed: Partial<Record<Observation, number>> = {};
  for (const finding of findings) {
    if (!finding || typeof finding !== "object") continue;
    const f = finding as RawPayload;
    const count = num(f["count"]);
    if (isObservation(f["observation"]) && count !== null && count > 0) {
      noticed[f["observation"]] = (noticed[f["observation"]] ?? 0) + count;
    }
  }
  const payment = d["payment"];
  const agreed =
    payment && typeof payment === "object" ? (num((payment as RawPayload)["agreed"]) ?? 0) : 0;
  return { noticed, agreed };
}

// ---------------------------------------------------------------------------
// goals_pinned — the player's pins, whole, each time they change. The latest
// event is the list; nothing is merged. Read back on every Life load.
// ---------------------------------------------------------------------------

export function goalsPinnedEventData(goals: Goal[]): { goals: Goal[] } {
  return { goals: goals.map((g) => ({ ...g })) };
}

function readGoal(raw: unknown): Goal | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const d = raw as RawPayload;
  switch (d["kind"]) {
    case "skill": {
      const skillId = str(d["skillId"]);
      const level = num(d["level"]);
      if (skillId === null || level === null) return null;
      return { kind: "skill", skillId, specialization: str(d["specialization"]), level };
    }
    case "rank": {
      const rank = num(d["rank"]);
      return rank === null ? null : { kind: "rank", rank };
    }
    case "chrome": {
      const itemId = str(d["itemId"]);
      const owned = num(d["owned"]);
      if (itemId === null || owned === null) return null;
      return { kind: "chrome", itemId, owned };
    }
    case "standing": {
      const factionId = d["factionId"];
      const atLeast = num(d["atLeast"]);
      if (!isFactionId(factionId) || atLeast === null) return null;
      return { kind: "standing", factionId, atLeast };
    }
    default:
      return null;
  }
}

/** The pinned goals, dropping any entry that no longer parses. */
export function readGoalsPinnedEventData(raw: unknown): Goal[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const goals = (raw as RawPayload)["goals"];
  if (!Array.isArray(goals)) return [];
  return goals.map(readGoal).filter((g): g is Goal => g !== null);
}

// ---------------------------------------------------------------------------
// walkOns — a field riding on life_narration/gm_narration, not an event of its
// own. Those two types are otherwise prose with no contract to break, but this
// one field IS read back (to show a walk-on's face on the same line, including
// on scrollback), so it gets the same round-trip guarantee as the mechanical
// events above rather than being read ad hoc where it is rendered.
// ---------------------------------------------------------------------------

/** A walk-on the turn named, already resolved to a concrete gender. */
export type WalkOnEventData = { subject: string; gender: "male" | "female" }[];

/**
 * No builder function: the value written IS this shape already —
 * `resolveWalkOns` in features/cast/walkOnMention.ts produces exactly
 * `{ subject, gender }[]`, validated against the flavor-art catalog before it
 * ever reaches here. Only the read side needs to distrust the jsonb column.
 */
export function readWalkOnsEventData(raw: unknown): WalkOnEventData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const list = (raw as RawPayload)["walkOns"];
  if (!Array.isArray(list)) return [];
  const out: WalkOnEventData = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const w = item as RawPayload;
    const subject = str(w["subject"]);
    const gender = str(w["gender"]);
    if (subject && (gender === "male" || gender === "female")) out.push({ subject, gender });
  }
  return out;
}

// ---------------------------------------------------------------------------
// provenance — like walkOns, a field riding on life_narration/gm_narration
// rather than an event of its own.
//
// WHY. The two prompts carry version numbers (GM_PROMPT_VERSION,
// LIFE_PROMPT_VERSION) that have been bumped about nineteen times between them
// and are read by NOTHING: zero imports, zero reads, never reaching an event, a
// log or a query. So "did 2.7.0 narrate worse than 2.6.0" is not a hard
// question, it is an unanswerable one — the ledger records what the narrator
// said and nothing about which narrator said it.
//
// This is the field that makes it answerable. It is deliberately about the
// CALL, not the answer: which prompt, at which version, asked which model, and
// which model the gateway says actually replied. A gateway that falls back to a
// different model is otherwise invisible, and a turn blamed on a prompt change
// that was really a silent model swap is the most expensive kind of wrong.
//
// Nothing renders it. Its readers are ledger queries and the eval harness that
// follows, which is a weaker claim than the mechanical events above make — but
// the round-trip guarantee is the point either way, because a field nobody
// looks at until they need it is exactly the field whose names rot.
// ---------------------------------------------------------------------------

/** Which of the two narrators wrote a turn. They are separate prompts on purpose. */
export type Narrator = "gm" | "life";

/** Which prompt, at which version, asked which model — and who answered. */
export type TurnProvenance = {
  narrator: Narrator;
  /** The version the prompt module declares, e.g. "2.8.0". */
  promptVersion: string;
  /** The model slug the server asked the gateway for. */
  model: string;
  /** What the gateway says actually answered, when it says. Null when it did not. */
  servedModel: string | null;
};

/**
 * The wire shape. Snake_case and nested under one key, so a turn's payload
 * gains one field rather than four loose ones that read like game state.
 */
type TurnProvenanceWire = {
  provenance: {
    narrator: Narrator;
    prompt_version: string;
    model: string;
    served_model: string | null;
  };
};

/** Build the provenance payload. The only place these names are written. */
export function turnProvenanceData(input: {
  narrator: Narrator;
  promptVersion: string;
  model: string;
  servedModel?: string | null;
}): TurnProvenanceWire {
  return {
    provenance: {
      narrator: input.narrator,
      prompt_version: input.promptVersion,
      model: input.model,
      served_model: input.servedModel ?? null,
    },
  };
}

/**
 * The same payload, or nothing at all when the turn arrived without provenance.
 *
 * Provenance is bookkeeping. By the time a narration event is written the dice
 * have been rolled, the damage applied and the encounter saved — so a missing
 * stamp must cost the record of who wrote the turn and NOT the turn. The type
 * says it is always there; the type is a promise made by a server function
 * across a serialization boundary, and a stale client bundle or a test double
 * can break it. Spread this rather than calling the builder directly at a
 * write site, the same way `resolveWalkOns` tolerates an absent list.
 */
export function turnProvenanceDataIfAny(
  provenance: TurnProvenance | null | undefined,
): TurnProvenanceWire | Record<string, never> {
  return provenance ? turnProvenanceData(provenance) : {};
}

/** Read a provenance payload back, or null when the turn carries none. */
export function readTurnProvenance(raw: unknown): TurnProvenance | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const bag = (raw as RawPayload)["provenance"];
  if (!bag || typeof bag !== "object" || Array.isArray(bag)) return null;
  const d = bag as RawPayload;
  const narrator = str(d["narrator"]);
  const promptVersion = str(d["prompt_version"]);
  const model = str(d["model"]);
  if ((narrator !== "gm" && narrator !== "life") || promptVersion === null || model === null) {
    return null;
  }
  return { narrator, promptVersion, model, servedModel: str(d["served_model"]) };
}
