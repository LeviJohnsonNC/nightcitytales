/**
 * The structured contract the LIFE model must return, plus a tolerant
 * normalizer — the same pattern as gmResponse.ts, but with a vocabulary that
 * makes job behaviour unexpressible: there is no start_encounter, no attack,
 * no advance_beat, and no way to accept a job.
 */
import { z } from "zod";

export const LIFE_ACTION_KINDS = [
  "skill_check",
  "opposed_check",
  "spend",
  "travel",
  "rest",
  "hook_offer",
  "none",
] as const;

/** What the engine should resolve out of the player's stated intent. */
export const LifeProposedActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("skill_check"),
    skillId: z.string(),
    dv: z.number().int(),
    intent: z.string(),
  }),
  z.object({
    kind: z.literal("opposed_check"),
    skillId: z.string(),
    npcKey: z.string(),
    npcName: z.string(),
    opposingSkillId: z.string(),
    opposingSkillLevel: z.number().int(),
    opposingStatValue: z.number().int(),
    intent: z.string(),
  }),
  z.object({ kind: z.literal("spend"), amount: z.number().int(), reason: z.string() }),
  z.object({ kind: z.literal("travel"), destination: z.string(), minutes: z.number().int() }),
  z.object({ kind: z.literal("rest"), hours: z.number().int() }),
  z.object({
    kind: z.literal("hook_offer"),
    title: z.string(),
    patron: z.string(),
    npcKey: z.string(),
    payout: z.number().int(),
    summary: z.string(),
  }),
  z.object({ kind: z.literal("none") }),
]);
export type LifeProposedAction = z.infer<typeof LifeProposedActionSchema>;

export const LifeDeltaSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("set_flag"), flag: z.string() }),
  z.object({ kind: z.literal("npc_disposition"), npcKey: z.string(), delta: z.number().int() }),
  z.object({
    kind: z.literal("clock"),
    clockKey: z.string(),
    label: z.string(),
    delta: z.number().int(),
    segments: z.number().int(),
    hidden: z.boolean(),
  }),
  z.object({ kind: z.literal("note"), text: z.string() }),
]);
export type LifeDelta = z.infer<typeof LifeDeltaSchema>;

/** One of the three offered actions, as the player sees it on a card. */
export type LifeActionCard = {
  label: string;
  description: string;
  timeMinutes: number;
  knownCost: number | null;
  skillId: string | null;
};

export type LifeSituationCard = { title: string; description: string };

export type LifeNewSituation = {
  key: string;
  category: "need" | "people" | "opportunity" | "pressure";
  title: string;
  summary: string;
  npcKey: string | null;
  severity: number;
  dueDay: number | null;
};

export type LifeResponse = {
  situation: LifeSituationCard;
  actions: LifeActionCard[];
  resolution: string | null;
  proposedActions: LifeProposedAction[];
  deltas: LifeDelta[];
  newSituation: LifeNewSituation | null;
};

/**
 * The wire schema is deliberately loose. Models drift on field names and
 * nesting; rejecting the whole turn over a renamed key would cost the player a
 * turn, so everything is narrowed in normalizeLifeResponse instead.
 */
export const LifeWireResponseSchema = z.object({
  situation: z
    .object({ title: z.string().nullish(), description: z.string().nullish() })
    .nullish(),
  actions: z.array(z.unknown()).nullish(),
  resolution: z.string().nullish(),
  proposedActions: z.array(z.unknown()).nullish(),
  deltas: z.array(z.unknown()).nullish(),
  newSituation: z.unknown().nullish(),
});
export type LifeWireResponse = z.infer<typeof LifeWireResponseSchema>;

type Loose = Record<string, unknown>;

function str(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(parsed)) return Math.round(parsed);
  }
  return undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Printed DV ladder; anything else is snapped to the nearest printed value. */
const DV_LADDER = [9, 13, 15, 17, 21, 24, 29];

function snapDv(value: number | undefined): number {
  if (value === undefined) return 13;
  let best = DV_LADDER[0] as number;
  for (const dv of DV_LADDER) {
    if (Math.abs(dv - value) < Math.abs(best - value)) best = dv;
  }
  return best;
}

/** Longest single Life action, mirroring the engine's clamp. */
const MAX_MINUTES = 12 * 60;

function normalizeActions(raw: unknown): LifeActionCard[] {
  if (!Array.isArray(raw)) return [];
  const out: LifeActionCard[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const a = item as Loose;
    const label = str(a["label"]) ?? str(a["title"]) ?? str(a["text"]);
    if (!label) continue;
    const cost = num(a["knownCost"] ?? a["known_cost"] ?? a["cost"]);
    out.push({
      label,
      description: str(a["description"]) ?? str(a["detail"]) ?? "",
      timeMinutes: clamp(num(a["timeMinutes"] ?? a["time_minutes"] ?? a["minutes"]) ?? 15, 0, MAX_MINUTES),
      knownCost: cost !== undefined && cost > 0 ? cost : null,
      skillId: str(a["skillId"]) ?? str(a["skill_id"]) ?? str(a["skill"]) ?? null,
    });
    if (out.length === 4) break;
  }
  return out;
}

function normalizeProposed(raw: unknown, warn: (m: string) => void): LifeProposedAction[] {
  if (!Array.isArray(raw)) return [];
  const out: LifeProposedAction[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const a = item as Loose;
    const kindRaw = (str(a["kind"]) ?? str(a["type"]) ?? "").toLowerCase().replace(/[\s-]+/g, "_");
    const skillId = str(a["skillId"]) ?? str(a["skill_id"]) ?? str(a["skill"]);
    const opposingSkillId = str(a["opposingSkillId"]) ?? str(a["opposing_skill_id"]);
    const intent = str(a["intent"]) ?? str(a["description"]) ?? "";

    if (kindRaw === "hook_offer" || kindRaw === "job_offer" || kindRaw === "hook") {
      const title = str(a["title"]) ?? str(a["name"]);
      const patron = str(a["patron"]) ?? str(a["from"]) ?? str(a["npcName"]) ?? "a fixer";
      if (!title) {
        warn("Life model offered a hook with no title, dropped.");
        continue;
      }
      out.push({
        kind: "hook_offer",
        title,
        patron,
        npcKey: str(a["npcKey"]) ?? str(a["npc_key"]) ?? patron.toLowerCase().replace(/\W+/g, "_"),
        payout: clamp(num(a["payout"]) ?? num(a["pay"]) ?? 500, 0, 100000),
        summary: str(a["summary"]) ?? intent,
      });
      continue;
    }
    if (kindRaw === "spend" || (num(a["amount"]) !== undefined && !skillId)) {
      const amount = num(a["amount"]) ?? num(a["cost"]);
      if (amount === undefined || amount <= 0) continue;
      out.push({ kind: "spend", amount, reason: str(a["reason"]) ?? intent });
      continue;
    }
    if (kindRaw === "travel") {
      out.push({
        kind: "travel",
        destination: str(a["destination"]) ?? str(a["to"]) ?? "across town",
        minutes: clamp(num(a["minutes"]) ?? 40, 0, MAX_MINUTES),
      });
      continue;
    }
    if (kindRaw === "rest" || kindRaw === "sleep") {
      out.push({ kind: "rest", hours: clamp(num(a["hours"]) ?? 8, 1, 24) });
      continue;
    }
    if (kindRaw === "opposed_check" || (skillId && opposingSkillId)) {
      const npcName = str(a["npcName"]) ?? str(a["npc_name"]) ?? str(a["opponent"]);
      const npcKey = str(a["npcKey"]) ?? str(a["npc_key"]) ?? npcName;
      if (!skillId || !opposingSkillId || !npcKey || !npcName) {
        warn("Life model proposed an opposed check missing a side, dropped.");
        continue;
      }
      out.push({
        kind: "opposed_check",
        skillId,
        npcKey,
        npcName,
        opposingSkillId,
        opposingSkillLevel: clamp(num(a["opposingSkillLevel"] ?? a["opposing_skill_level"]) ?? 3, 0, 10),
        opposingStatValue: clamp(num(a["opposingStatValue"] ?? a["opposing_stat_value"]) ?? 5, 1, 10),
        intent,
      });
      continue;
    }
    if (kindRaw === "skill_check" || skillId) {
      if (!skillId) continue;
      out.push({ kind: "skill_check", skillId, dv: snapDv(num(a["dv"])), intent });
      continue;
    }
    if (kindRaw === "none") continue;
    // Anything job-shaped (an encounter, an attack, a beat advance) has no
    // vocabulary in Life and is dropped rather than half-understood.
    if (kindRaw) warn(`Life model proposed "${kindRaw}", which Life cannot resolve. Dropped.`);
  }
  return out;
}

function normalizeDeltas(raw: unknown): LifeDelta[] {
  if (!Array.isArray(raw)) return [];
  const out: LifeDelta[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const text = str(item);
      if (text) out.push({ kind: "note", text });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const d = item as Loose;
    const kind = (str(d["kind"]) ?? str(d["type"]) ?? "").toLowerCase();
    const flag = str(d["flag"]);
    const npcKey = str(d["npcKey"]) ?? str(d["npc_key"]) ?? str(d["npc"]);
    const clockKey = str(d["clockKey"]) ?? str(d["clock_key"]) ?? str(d["clock"]);
    if (kind === "clock" || clockKey) {
      if (!clockKey) continue;
      out.push({
        kind: "clock",
        clockKey,
        label: str(d["label"]) ?? clockKey.replace(/_/g, " "),
        delta: clamp(num(d["delta"]) ?? 1, -6, 6),
        segments: clamp(num(d["segments"]) ?? 6, 2, 12),
        hidden: d["hidden"] === true,
      });
      continue;
    }
    if (kind === "npc_disposition" || (npcKey && num(d["delta"]) !== undefined)) {
      if (!npcKey) continue;
      out.push({ kind: "npc_disposition", npcKey, delta: clamp(num(d["delta"]) ?? 0, -3, 3) });
      continue;
    }
    if (kind === "set_flag" || flag) {
      if (!flag) continue;
      out.push({ kind: "set_flag", flag });
      continue;
    }
    const text = str(d["text"]) ?? str(d["note"]) ?? str(d["summary"]);
    if (text) out.push({ kind: "note", text });
  }
  return out;
}

function normalizeNewSituation(raw: unknown): LifeNewSituation | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Loose;
  const title = str(s["title"]);
  if (!title) return null;
  const categoryRaw = (str(s["category"]) ?? "opportunity").toLowerCase();
  const category = (["need", "people", "opportunity", "pressure"] as const).includes(
    categoryRaw as "need",
  )
    ? (categoryRaw as LifeNewSituation["category"])
    : "opportunity";
  const key =
    str(s["key"]) ??
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  return {
    key,
    category,
    title,
    summary: str(s["summary"]) ?? str(s["description"]) ?? "",
    npcKey: str(s["npcKey"]) ?? str(s["npc_key"]) ?? null,
    severity: clamp(num(s["severity"]) ?? 2, 1, 5),
    dueDay: num(s["dueDay"] ?? s["due_day"]) ?? null,
  };
}

export type NormalizeLifeOptions = { onWarn?: (message: string) => void };

export function normalizeLifeResponse(
  wire: LifeWireResponse,
  options: NormalizeLifeOptions = {},
): LifeResponse {
  const warn = options.onWarn ?? ((m: string) => console.warn(m));
  return {
    situation: {
      title: str(wire.situation?.title) ?? "Night City, and you in it",
      description: str(wire.situation?.description) ?? "",
    },
    actions: normalizeActions(wire.actions),
    resolution: str(wire.resolution) ?? null,
    proposedActions: normalizeProposed(wire.proposedActions, warn),
    deltas: normalizeDeltas(wire.deltas),
    newSituation: normalizeNewSituation(wire.newSituation),
  };
}
