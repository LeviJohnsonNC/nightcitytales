/**
 * The structured contract the GM model must return. Validated with Zod so a
 * malformed model response is rejected rather than silently trusted. The engine
 * resolves proposedActions; nothing here changes state on its own.
 */
import { z } from "zod";

/** A mechanical action the engine should resolve from the player's intent. */
export const GmProposedActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("skill_check"),
    skillId: z.string(),
    dv: z.number().int(),
    intent: z.string(),
  }),
  z.object({ kind: z.literal("attack"), targetId: z.string(), intent: z.string() }),
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

/** Narrow the loose model output into the typed GM response the engine uses. */
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
      if (targetId) proposedActions.push({ kind: "attack", targetId, intent });
    } else if (kind === "advance_beat") {
      const to = str(a["to"]) ?? str(a["beatId"]);
      if (to) proposedActions.push({ kind: "advance_beat", to });
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
