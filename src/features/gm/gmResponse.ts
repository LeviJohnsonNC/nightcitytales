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
 * and defaults are unreliable across providers' structured-output modes, so the
 * model fills one flat shape and we narrow it back to GmResponse below.
 */
const FlatProposedAction = z.object({
  kind: z.enum(["skill_check", "attack", "advance_beat", "none"]),
  skillId: z.string().nullable(),
  dv: z.number().nullable(),
  intent: z.string().nullable(),
  targetId: z.string().nullable(),
  to: z.string().nullable(),
});

const FlatStateDelta = z.object({
  kind: z.enum(["set_flag", "npc_disposition", "note"]),
  flag: z.string().nullable(),
  npcKey: z.string().nullable(),
  delta: z.number().nullable(),
  text: z.string().nullable(),
});

export const GmWireResponseSchema = z.object({
  narration: z.string(),
  proposedActions: z.array(FlatProposedAction),
  suggestedActions: z.array(z.object({ label: z.string(), skill: z.string().nullable() })),
  stateDeltas: z.array(FlatStateDelta),
  endsWithDecision: z.boolean(),
});
export type GmWireResponse = z.infer<typeof GmWireResponseSchema>;

/** Narrow the flat model output into the typed GM response the engine uses. */
export function normalizeGmResponse(wire: GmWireResponse): GmResponse {
  const proposedActions: GmProposedAction[] = [];
  for (const a of wire.proposedActions) {
    if (a.kind === "skill_check" && a.skillId) {
      proposedActions.push({
        kind: "skill_check",
        skillId: a.skillId,
        dv: Math.round(a.dv ?? 13),
        intent: a.intent ?? "",
      });
    } else if (a.kind === "attack" && a.targetId) {
      proposedActions.push({ kind: "attack", targetId: a.targetId, intent: a.intent ?? "" });
    } else if (a.kind === "advance_beat" && a.to) {
      proposedActions.push({ kind: "advance_beat", to: a.to });
    }
  }

  const stateDeltas: GmStateDelta[] = [];
  for (const d of wire.stateDeltas) {
    if (d.kind === "set_flag" && d.flag) stateDeltas.push({ kind: "set_flag", flag: d.flag });
    else if (d.kind === "npc_disposition" && d.npcKey)
      stateDeltas.push({
        kind: "npc_disposition",
        npcKey: d.npcKey,
        delta: Math.round(d.delta ?? 0),
      });
    else if (d.kind === "note" && d.text) stateDeltas.push({ kind: "note", text: d.text });
  }

  return {
    narration: wire.narration,
    proposedActions,
    suggestedActions: wire.suggestedActions.map((s) => ({ label: s.label, skill: s.skill })),
    stateDeltas,
    endsWithDecision: wire.endsWithDecision,
  };
}
