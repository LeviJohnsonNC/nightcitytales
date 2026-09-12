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

/** The event types whose payloads carry mechanical weight. */
export const LEDGER_EVENTS = {
  attack: "attack",
  deathSave: "death_save",
  skillCheck: "skill_check",
  backupCalled: "backup_called",
  encounterStarted: "encounter_started",
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
