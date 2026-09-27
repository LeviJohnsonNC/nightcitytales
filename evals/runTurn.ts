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
import {
  normalizeGmResponse,
  salvageGmResponse,
  GmWireResponseSchema,
  type GmResponse,
} from "@/features/gm/gmResponse";
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

/**
 * Who answers the eval's calls.
 *
 * Play goes through the Lovable gateway, and LOVABLE_API_KEY cannot leave
 * Lovable Cloud: it is provisioned for the project's own runtime and there is
 * no way to export it. So outside Lovable the eval talks to the same model
 * through a key you own, over the OpenAI-compatible API every one of these
 * speaks. The model slug is the one play uses ("google/gemini-3.7-flash"),
 * which OpenRouter takes as written and Google's own endpoint takes without
 * the "google/" in front.
 *
 * First key found wins, in this order, so a machine with several set is
 * predictable:
 *   OPENROUTER_API_KEY   — openrouter.ai; same slugs as the gateway
 *   GEMINI_API_KEY       — Google AI Studio; has a free tier
 *   EVAL_API_KEY + EVAL_BASE_URL — any other OpenAI-compatible endpoint
 *   LOVABLE_API_KEY      — inside Lovable's own sandbox, the real gateway
 */
export type EvalProvider = {
  name: string;
  baseURL: string;
  apiKey: string;
  /** The slug this provider expects for the model play would have asked for. */
  modelId(model: string): string;
};

export function evalProvider(env: Record<string, string | undefined> = process.env): EvalProvider {
  const openrouter = env["OPENROUTER_API_KEY"];
  if (openrouter) {
    return {
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: openrouter,
      modelId: (m) => m,
    };
  }
  const gemini = env["GEMINI_API_KEY"];
  if (gemini) {
    return {
      name: "google",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: gemini,
      modelId: (m) => m.replace(/^google\//, ""),
    };
  }
  const own = env["EVAL_API_KEY"];
  const ownUrl = env["EVAL_BASE_URL"];
  if (own && ownUrl) return { name: "custom", baseURL: ownUrl, apiKey: own, modelId: (m) => m };
  const lovable = env["LOVABLE_API_KEY"];
  if (lovable) {
    return {
      name: "lovable",
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: lovable,
      modelId: (m) => m,
    };
  }
  throw new Error(
    "No eval key. Set OPENROUTER_API_KEY or GEMINI_API_KEY (see evals/README.md), " +
      "or run inside Lovable where LOVABLE_API_KEY already exists.",
  );
}

export async function runTurn(scenario: Scenario, model: string): Promise<TurnResult> {
  const provider = evalProvider();
  const { generateObject } = await import("ai");
  const gateway = await providerFor(provider);
  model = provider.modelId(model);

  if (scenario.narrator === "gm") {
    // Play salvages a reply that was prose instead of the object
    // (gmTurn.server.ts), so the eval does too: otherwise one of those turns
    // fails the whole scenario and every check in it goes unmeasured.
    let gm: GmResponse;
    let servedModel: string | null = null;
    try {
      const { object, response } = await generateObject({
        model: gateway(model),
        schema: GmWireResponseSchema,
        system: scenario.system,
        prompt: scenario.packet,
      });
      gm = normalizeGmResponse(object);
      servedModel = response.modelId ?? null;
    } catch (error) {
      const text = (error as { text?: unknown })?.text;
      const salvaged = salvageGmResponse(typeof text === "string" ? text : null);
      if (!salvaged) throw error;
      gm = salvaged;
    }
    return {
      servedModel,
      turn: {
        narration: gm.narration,
        offeredOptions: gm.suggestedActions.map((a) => a.label),
        npcKeys: gm.proposedActions.flatMap((a) => ("npcKey" in a && a.npcKey ? [a.npcKey] : [])),
        observations: gm.observations.map((o) => o.observation),
        walkOns: gm.walkOns.map((w) => w.subject),
        proposedActionCount: gm.proposedActions.length,
        checks: gm.proposedActions.flatMap((a) =>
          a.kind === "skill_check"
            ? [{ skillId: a.skillId, dv: a.dv, lowStakes: a.stakes === "low" }]
            : [],
        ),
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
      trips: life.proposedActions.flatMap((a) =>
        a.kind === "travel"
          ? [
              {
                ...(a.destination ? { destination: a.destination } : {}),
                ...(a.seek ? { seek: a.seek } : {}),
                ...(a.direction ? { direction: a.direction } : {}),
              },
            ]
          : [],
      ),
      spends: life.proposedActions.filter((a) => a.kind === "spend").length,
      checks: life.proposedActions.flatMap((a) =>
        a.kind === "skill_check"
          ? [{ skillId: a.skillId, dv: a.dv, lowStakes: a.stakes === "low" }]
          : [],
      ),
    },
  };
}

/**
 * The model factory for a provider. Lovable goes through the app's own gateway
 * module so the eval sends exactly the headers play sends; everything else is
 * a plain OpenAI-compatible client.
 */
async function providerFor(provider: EvalProvider) {
  if (provider.name === "lovable") {
    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    return createLovableAiGatewayProvider(provider.apiKey);
  }
  const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
  return createOpenAICompatible({
    name: provider.name,
    baseURL: provider.baseURL,
    apiKey: provider.apiKey,
    // Not supportsStructuredOutputs: play's provider (ai-gateway.server.ts)
    // leaves it off, and with it on the model wrote every proposed action as a
    // JSON string, so the eval measured a failure play never has.
  });
}
