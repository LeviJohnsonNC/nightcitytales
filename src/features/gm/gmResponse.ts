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
  /**
   * A check against a person who is actively resisting: both sides roll
   * STAT + Skill + 1d10 and the higher total wins. The GM supplies who opposes
   * it and what they bring; the engine rolls both dice and compares them.
   */
  z.object({
    kind: z.literal("opposed_check"),
    skillId: z.string(),
    /** Stable key for the NPC, reused so the same face keeps the same numbers. */
    npcKey: z.string(),
    npcName: z.string(),
    /** The printed skill the NPC resists with; its STAT comes from the rules. */
    opposingSkillId: z.string(),
    opposingSkillLevel: z.number().int(),
    /** The NPC's value in the STAT that opposing skill is printed under. */
    opposingStatValue: z.number().int(),
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
 *
 * Loose is not undescribed: an untyped array told the model nothing about what a
 * proposed action looks like, and an action it spelled its own way was dropped —
 * which is how checks stopped reaching the table. The item shapes are documented
 * here so the schema itself carries the contract, and normalizeGmResponse accepts
 * the spellings models reach for anyway.
 */
export const GmWireResponseSchema = z.object({
  narration: z.string(),
  proposedActions: z
    .array(z.unknown())
    .describe(
      'Mechanical actions for the engine to resolve. Each item is an object with a "kind" field ' +
        "and the fields that kind needs: " +
        '{"kind":"skill_check","skillId":"<id from the SKILLS list>","dv":<number>,"intent":"<what they are attempting>"}; ' +
        '{"kind":"opposed_check","skillId":"<id from the SKILLS list>","npcKey":"<stable key>","npcName":"<who resists>","opposingSkillId":"<printed skill id they resist with>","opposingSkillLevel":<0-10>,"opposingStatValue":<1-10>,"intent":"<what they are attempting>"}; ' +
        '{"kind":"start_encounter","name":"<label>","enemies":[{"key","name","ref","body","hp","sp","attackSkill","weaponName","damageDice","rangeType","distance"}]}; ' +
        '{"kind":"attack","targetId":"<enemy key>","intent":"<what they are doing>","distance":<metres>}; ' +
        '{"kind":"advance_beat","to":"<beat id>"}. Use [] when nothing is proposed.',
    )
    .nullish(),
  suggestedActions: z
    .array(z.unknown())
    .describe(
      "Empty on an ordinary turn. Filled with 3-4 things the player could try ONLY when the " +
        "context says they asked what their options are. Each item is " +
        '{"label":"<short in-fiction action>","skill":"<skill id it would lean on, or null>"}.',
    )
    .nullish(),
  stateDeltas: z
    .array(z.unknown())
    .describe(
      "Narrative state changes to record. Each item is " +
        '{"kind":"set_flag","flag":"<name>"}, {"kind":"npc_disposition","npcKey":"<key>","delta":<number>}, ' +
        'or {"kind":"note","text":"<what happened>"}.',
    )
    .nullish(),
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

/** Collapse a model-authored kind ("Skill Check", "skillCheck") to a snake key. */
function snake(raw: string): string {
  return raw
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * The discriminator the engine reads is "kind", but nothing forces a model to
 * spell it that way — and an action we cannot name is an action the player never
 * gets to roll. So every plausible spelling of the field, and of the value, maps
 * back onto the four kinds the engine actually resolves.
 */
const ACTION_KIND_KEYS = ["kind", "type", "action", "actionType", "action_type", "name"] as const;

const ACTION_KIND_ALIASES: Record<string, GmProposedAction["kind"]> = {
  skill_check: "skill_check",
  check: "skill_check",
  opposed_check: "opposed_check",
  opposed: "opposed_check",
  opposed_roll: "opposed_check",
  opposed_skill_check: "opposed_check",
  contest: "opposed_check",
  contested_check: "opposed_check",
  versus: "opposed_check",
  skill: "skill_check",
  skill_roll: "skill_check",
  roll: "skill_check",
  ability_check: "skill_check",
  start_encounter: "start_encounter",
  encounter: "start_encounter",
  begin_encounter: "start_encounter",
  start_combat: "start_encounter",
  combat: "start_encounter",
  attack: "attack",
  melee_attack: "attack",
  ranged_attack: "attack",
  advance_beat: "advance_beat",
  advance: "advance_beat",
  next_beat: "advance_beat",
  beat: "advance_beat",
  none: "none",
  no_action: "none",
};

/**
 * Which kind an action item is. Reads any of the spellings above, and when the
 * model names none, infers the kind from the fields it did send — a payload with
 * a skill and a DV is a check whatever it calls itself.
 */
export function actionKindOf(item: Loose): GmProposedAction["kind"] | null {
  for (const key of ACTION_KIND_KEYS) {
    const raw = str(item[key]);
    if (!raw) continue;
    const mapped = ACTION_KIND_ALIASES[snake(raw)];
    if (mapped) return mapped;
  }
  if (item["enemies"] ?? item["hostiles"] ?? item["combatants"]) return "start_encounter";
  // Opposed before plain: an item carrying an opposing side is a contest, and
  // reading it as a DV check would silently invent a difficulty nobody set.
  if (str(item["opposingSkillId"]) ?? str(item["opposing_skill_id"]) ?? str(item["opposingSkill"]))
    return "opposed_check";
  if (str(item["skillId"]) ?? str(item["skill"]) ?? str(item["skill_id"])) return "skill_check";
  if (str(item["targetId"]) ?? str(item["target"]) ?? str(item["target_id"])) return "attack";
  if (str(item["to"]) ?? str(item["beatId"]) ?? str(item["beat_id"])) return "advance_beat";
  return null;
}

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

export type NormalizeOptions = {
  /**
   * Where dropped actions are reported. A silently discarded proposal is a check
   * the player never sees, so nothing here fails quietly by default.
   */
  onWarn?: (message: string) => void;
};

/** Narrow the loose model output into the typed GM response the engine uses. */
export function normalizeGmResponse(
  wire: GmWireResponse,
  options: NormalizeOptions = {},
): GmResponse {
  const warn = options.onWarn ?? ((message: string) => console.warn(message));
  const proposedActions: GmProposedAction[] = [];
  const rawActions = wire.proposedActions ?? [];
  for (const raw of rawActions) {
    if (!raw || typeof raw !== "object") {
      warn(`GM proposed a non-object action, dropped: ${JSON.stringify(raw)}`);
      continue;
    }
    const a = raw as Loose;
    const kind = actionKindOf(a);
    const intent = str(a["intent"]) ?? str(a["description"]) ?? "";
    if (kind === null) {
      warn(`GM proposed an action with no recognizable kind, dropped: ${JSON.stringify(raw)}`);
      continue;
    }
    if (kind === "skill_check") {
      const skillId = str(a["skillId"]) ?? str(a["skill"]) ?? str(a["skill_id"]);
      if (skillId)
        proposedActions.push({ kind: "skill_check", skillId, dv: num(a["dv"]) ?? 13, intent });
      else warn(`GM proposed a check with no skill, dropped: ${JSON.stringify(raw)}`);
    } else if (kind === "opposed_check") {
      const skillId = str(a["skillId"]) ?? str(a["skill"]) ?? str(a["skill_id"]);
      const opposingSkillId =
        str(a["opposingSkillId"]) ?? str(a["opposing_skill_id"]) ?? str(a["opposingSkill"]);
      const npcName = str(a["npcName"]) ?? str(a["npc_name"]) ?? str(a["opponent"]);
      const npcKey = str(a["npcKey"]) ?? str(a["npc_key"]) ?? str(a["npcId"]) ?? npcName;
      if (skillId && opposingSkillId && npcKey && npcName) {
        proposedActions.push({
          kind: "opposed_check",
          skillId,
          npcKey,
          npcName,
          opposingSkillId,
          // NPCs are people: their STATs sit in the human 1-10 band and an
          // improvised Level never exceeds the printed maximum.
          opposingSkillLevel: clamp(
            num(a["opposingSkillLevel"]) ?? num(a["opposing_skill_level"]) ?? 3,
            0,
            10,
          ),
          opposingStatValue: clamp(
            num(a["opposingStatValue"]) ?? num(a["opposing_stat_value"]) ?? 5,
            1,
            10,
          ),
          intent,
        });
      } else {
        warn(`GM proposed an opposed check missing a side, dropped: ${JSON.stringify(raw)}`);
      }
    } else if (kind === "attack") {
      const targetId = str(a["targetId"]) ?? str(a["target"]) ?? str(a["target_id"]);
      const distance = num(a["distance"]) ?? num(a["range"]);
      if (targetId)
        proposedActions.push({
          kind: "attack",
          targetId,
          intent,
          distance: clamp(distance ?? DEFAULT_ATTACK_DISTANCE, 1, 800),
        });
      else warn(`GM proposed an attack with no target, dropped: ${JSON.stringify(raw)}`);
    } else if (kind === "start_encounter") {
      const enemies = normalizeEnemies(a["enemies"] ?? a["hostiles"] ?? a["combatants"]);
      if (enemies.length)
        proposedActions.push({
          kind: "start_encounter",
          name: str(a["name"]) ?? "Firefight",
          enemies,
        });
      else warn(`GM proposed an encounter with no hostiles, dropped: ${JSON.stringify(raw)}`);
    } else if (kind === "advance_beat") {
      const to = str(a["to"]) ?? str(a["beatId"]) ?? str(a["beat_id"]);
      if (to) proposedActions.push({ kind: "advance_beat", to });
      else warn(`GM proposed a beat advance with no destination, dropped: ${JSON.stringify(raw)}`);
    }
  }
  if (rawActions.length > 0 && proposedActions.length === 0) {
    warn(`GM returned ${rawActions.length} proposed action(s) and none survived normalization.`);
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
