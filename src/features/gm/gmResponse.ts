/**
 * The structured contract the GM model must return. Validated with Zod so a
 * malformed model response is rejected rather than silently trusted. The engine
 * resolves proposedActions; nothing here changes state on its own.
 */
import { z } from "zod";

/**
 * A hostile the GM brings into a fight. These are NPC stat blocks the GM
 * improvises (the core rules' mook numbers), not values read from the rules
 * data, so every field is clamped into a sane band before the engine sees it.
 * The weapon's range type must be one of the printed Range DV tables.
 */
export const GM_RANGE_TYPES = [
  "pistol",
  "smg",
  "shotgun_slug",
  "assault_rifle",
  "sniper_rifle",
  "bow_crossbow",
  "grenade_launcher",
  "rocket_launcher",
] as const;
export type GmRangeType = (typeof GM_RANGE_TYPES)[number];

export const GmEnemySchema = z.object({
  /** Stable key the GM uses to refer to this hostile in later attacks. */
  key: z.string(),
  name: z.string(),
  ref: z.number().int(),
  body: z.number().int(),
  hp: z.number().int(),
  /** Armor SP (used for both body and head). */
  sp: z.number().int(),
  /** The hostile's level in the skill their weapon uses. */
  attackSkill: z.number().int(),
  weaponName: z.string(),
  damageDice: z.number().int(),
  rangeType: z.enum(GM_RANGE_TYPES),
  /** Distance in metres from the player character right now. */
  distance: z.number().int(),
});
export type GmEnemy = z.infer<typeof GmEnemySchema>;

/** A mechanical action the engine should resolve from the player's intent. */
export const GmProposedActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("skill_check"),
    skillId: z.string(),
    dv: z.number().int(),
    intent: z.string(),
  }),
  z.object({
    kind: z.literal("start_encounter"),
    name: z.string(),
    enemies: z.array(GmEnemySchema),
  }),
  z.object({
    kind: z.literal("attack"),
    targetId: z.string(),
    intent: z.string(),
    /** Distance in metres to the target; the engine reads the Range DV table with it. */
    distance: z.number().int(),
  }),
  z.object({ kind: z.literal("advance_beat"), to: z.string() }),
  z.object({
    kind: z.literal("rest"),
    /** Whole days of downtime. The engine heals BODY Hit Points per full day. */
    days: z.number().int(),
    intent: z.string(),
  }),
  z.object({ kind: z.literal("none") }),
]);
export type GmProposedAction = z.infer<typeof GmProposedActionSchema>;

/** A narrative state change to record (never a mechanical/dice change). */
export const GmStateDeltaSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("set_flag"), flag: z.string() }),
  z.object({ kind: z.literal("npc_disposition"), npcKey: z.string(), delta: z.number().int() }),
  z.object({ kind: z.literal("note"), text: z.string() }),
]);
export type GmStateDelta = z.infer<typeof GmStateDeltaSchema>;

/** A concrete thing the player could try right now, offered as a button. */
export const GmSuggestedActionSchema = z.object({
  /** Short, in-fiction, first-person-ish intent the player can click. */
  label: z.string(),
  /** The skill it would most likely lean on, if any. */
  skill: z.string().nullish(),
});
export type GmSuggestedAction = z.infer<typeof GmSuggestedActionSchema>;

export const GmResponseSchema = z.object({
  narration: z.string(),
  proposedActions: z.array(GmProposedActionSchema).default([]),
  suggestedActions: z.array(GmSuggestedActionSchema).default([]),
  stateDeltas: z.array(GmStateDeltaSchema).default([]),
  endsWithDecision: z.boolean().default(false),
});
export type GmResponse = z.infer<typeof GmResponseSchema>;

/**
 * The wire schema actually sent to the model. Discriminated unions, optionals
 * and defaults are unreliable across providers' structured-output modes, and
 * models drift on item field names, so the wire shape is deliberately loose and
 * normalizeGmResponse() below narrows it into the typed GmResponse.
 */
export const GmWireResponseSchema = z.object({
  narration: z.string(),
  proposedActions: z.array(z.unknown()).nullish(),
  suggestedActions: z.array(z.unknown()).nullish(),
  stateDeltas: z.array(z.unknown()).nullish(),
  endsWithDecision: z.boolean().nullish(),
});
export type GmWireResponse = z.infer<typeof GmWireResponseSchema>;

type Loose = Record<string, unknown>;

const str = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;
const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/** Talking distance when the GM forgets to state one; still a printed range band. */
export const DEFAULT_ATTACK_DISTANCE = 12;

/** Narrow a loose list of GM-authored hostiles into clamped enemy stat blocks. */
function normalizeEnemies(raw: unknown): GmEnemy[] {
  if (!Array.isArray(raw)) return [];
  const out: GmEnemy[] = [];
  raw.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const e = item as Loose;
    const name = str(e["name"]) ?? str(e["label"]);
    if (!name) return;
    const rangeRaw = str(e["rangeType"]) ?? str(e["weaponType"]);
    const rangeType = (GM_RANGE_TYPES as readonly string[]).includes(rangeRaw ?? "")
      ? (rangeRaw as GmEnemy["rangeType"])
      : "pistol";
    out.push({
      key: str(e["key"]) ?? str(e["id"]) ?? `${name}-${index}`,
      name,
      ref: clamp(num(e["ref"]) ?? 5, 1, 10),
      body: clamp(num(e["body"]) ?? 5, 1, 12),
      hp: clamp(num(e["hp"]) ?? 25, 1, 80),
      sp: clamp(num(e["sp"]) ?? 7, 0, 20),
      attackSkill: clamp(num(e["attackSkill"]) ?? num(e["skill"]) ?? 4, 0, 10),
      weaponName: str(e["weaponName"]) ?? str(e["weapon"]) ?? "sidearm",
      damageDice: clamp(num(e["damageDice"]) ?? 2, 1, 8),
      rangeType,
      distance: clamp(num(e["distance"]) ?? DEFAULT_ATTACK_DISTANCE, 1, 800),
    });
  });
  return out;
}

/** Narrow the loose model output into the typed GM response the engine uses. */
/** The longest stretch of downtime one proposal may claim. */
export const MAX_REST_DAYS = 7;

export function normalizeGmResponse(wire: GmWireResponse): GmResponse {
  const proposedActions: GmProposedAction[] = [];
  for (const raw of wire.proposedActions ?? []) {
    if (!raw || typeof raw !== "object") continue;
    const a = raw as Loose;
    const kind = str(a["kind"]);
    const intent = str(a["intent"]) ?? str(a["description"]) ?? "";
    if (kind === "skill_check") {
      const skillId = str(a["skillId"]) ?? str(a["skill"]);
      if (skillId)
        proposedActions.push({ kind: "skill_check", skillId, dv: num(a["dv"]) ?? 13, intent });
    } else if (kind === "attack") {
      const targetId = str(a["targetId"]) ?? str(a["target"]);
      const distance = num(a["distance"]) ?? num(a["range"]);
      if (targetId)
        proposedActions.push({
          kind: "attack",
          targetId,
          intent,
          distance: clamp(distance ?? DEFAULT_ATTACK_DISTANCE, 1, 800),
        });
    } else if (kind === "start_encounter") {
      const enemies = normalizeEnemies(a["enemies"] ?? a["hostiles"] ?? a["combatants"]);
      if (enemies.length)
        proposedActions.push({
          kind: "start_encounter",
          name: str(a["name"]) ?? "Firefight",
          enemies,
        });
    } else if (kind === "advance_beat") {
      const to = str(a["to"]) ?? str(a["beatId"]);
      if (to) proposedActions.push({ kind: "advance_beat", to });
    } else if (kind === "rest") {
      // A stretch of downtime. The rate is per FULL day, so a part-day is
      // floored rather than rounded — num() rounds, which would hand out a day
      // the fiction never had. Bounded so a hallucinated "rest 900 days" cannot
      // heal a character to full off a typo; the engine still owns the rate.
      const raw = a["days"] ?? a["duration"];
      const days = typeof raw === "number" && Number.isFinite(raw) ? Math.floor(raw) : 1;
      proposedActions.push({ kind: "rest", days: clamp(days, 1, MAX_REST_DAYS), intent });
    }
  }

  const stateDeltas: GmStateDelta[] = [];
  for (const raw of wire.stateDeltas ?? []) {
    if (typeof raw === "string") {
      const text = str(raw);
      if (text) stateDeltas.push({ kind: "note", text });
      continue;
    }
    if (!raw || typeof raw !== "object") continue;
    const d = raw as Loose;
    const kind = str(d["kind"]) ?? str(d["type"]);
    const flag = str(d["flag"]);
    const npcKey = str(d["npcKey"]) ?? str(d["npc"]);
    const text = str(d["text"]) ?? str(d["note"]) ?? str(d["summary"]);
    if (kind === "set_flag" && flag) stateDeltas.push({ kind: "set_flag", flag });
    else if (kind === "npc_disposition" && npcKey)
      stateDeltas.push({ kind: "npc_disposition", npcKey, delta: num(d["delta"]) ?? 0 });
    else if (text) stateDeltas.push({ kind: "note", text });
  }

  const suggestedActions: GmSuggestedAction[] = [];
  for (const raw of wire.suggestedActions ?? []) {
    if (typeof raw === "string") {
      const label = str(raw);
      if (label) suggestedActions.push({ label, skill: null });
      continue;
    }
    if (!raw || typeof raw !== "object") continue;
    const s = raw as Loose;
    const label = str(s["label"]) ?? str(s["text"]) ?? str(s["action"]) ?? str(s["intent"]);
    if (label) suggestedActions.push({ label, skill: str(s["skill"]) ?? str(s["skillId"]) });
  }

  return {
    narration: wire.narration,
    proposedActions,
    suggestedActions,
    stateDeltas,
    endsWithDecision: wire.endsWithDecision ?? false,
  };
}
