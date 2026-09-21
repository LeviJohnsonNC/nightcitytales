/**
 * One eval turn: ask the model, normalize it the way play does, reduce it to
 * something the checks can read.
 *
 * The four fields of the gateway call — model, schema, system, prompt — are the
 * only thing here that restates what `gmTurn.server.ts` and `lifeTurn.server.ts`
 * do, because those are server functions behind auth middleware and cannot be
 * called from a script. Everything else is imported from them: the same system
 * prompts, the same wire schemas, the same normalizers. If the real call ever
 * grows a temperature or a maxTokens, it has to be added here too, and that is
 * the one drift this file can suffer.
 *
 * The gateway module is reached by `await import(...)` rather than a static
 * import, matching how the server functions reach it. It is server internals by
 * the rule in boundaries.test.ts, and while nothing in `evals/` ships to a
 * browser, using the established pattern means the question never comes up.
 */
import { normalizeGmResponse, GmWireResponseSchema } from "@/features/gm/gmResponse";
import { normalizeLifeResponse, LifeWireResponseSchema } from "@/features/life/lifeResponse";
import type { CheckableTurn } from "@/features/narration/narratorChecks";
import type { Scenario } from "./scenarios";

const DEFAULT_MODEL = "google/gemini-3.7-flash";

/** What one call came back with, plus who answered. */
export type TurnResult = {
  turn: CheckableTurn;
  /** What the gateway says actually replied, which is not always what was asked. */
  servedModel: string | null;
};

export function modelFor(narrator: "gm" | "life"): string {
  const override = narrator === "life" ? process.env["LIFE_MODEL"] : undefined;
  return override ?? process.env["GM_MODEL"] ?? DEFAULT_MODEL;
}

export async function runTurn(scenario: Scenario, model: string): Promise<TurnResult> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key)
    throw new Error("LOVABLE_API_KEY is not set. Copy .env.example to .env and fill it in.");

  const { generateObject } = await import("ai");
  const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
  const gateway = createLovableAiGatewayProvider(key);

  if (scenario.narrator === "gm") {
    const { object, response } = await generateObject({
      model: gateway(model),
      schema: GmWireResponseSchema,
      system: scenario.system,
      prompt: scenario.packet,
    });
    const gm = normalizeGmResponse(object);
    return {
      servedModel: response.modelId ?? null,
      turn: {
        narration: gm.narration,
        offeredOptions: gm.suggestedActions.map((a) => a.label),
        npcKeys: gm.proposedActions.flatMap((a) => ("npcKey" in a && a.npcKey ? [a.npcKey] : [])),
        observations: gm.observations.map((o) => o.observation),
        walkOns: gm.walkOns.map((w) => w.subject),
        proposedActionCount: gm.proposedActions.length,
      },
    };
  }

  const { object, response } = await generateObject({
    model: gateway(model),
    schema: LifeWireResponseSchema,
    system: scenario.system,
    prompt: scenario.packet,
  });
  const life = normalizeLifeResponse(object);
  return {
    servedModel: response.modelId ?? null,
    turn: {
      // Life's prose is the situation's description, or the resolution when the
      // turn was a follow-up. Both are what the player reads.
      narration: life.resolution ?? life.situation.description,
      offeredOptions: life.actions.map((a) => a.label),
      npcKeys: life.proposedActions.flatMap((a) => ("npcKey" in a && a.npcKey ? [a.npcKey] : [])),
      observations: life.observations.map((o) => o.observation),
      walkOns: life.walkOns.map((w) => w.subject),
      proposedActionCount: life.proposedActions.filter((a) => a.kind !== "none").length,
    },
  };
}
