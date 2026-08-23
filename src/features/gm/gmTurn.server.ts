/**
 * The GM turn — a server function that asks the model (via the Lovable AI
 * gateway) to narrate the current beat and parse the player's intent into
 * structured, engine-resolvable actions. The API key never leaves the server,
 * mirroring generateBackgroundFn.
 *
 * GM_MODEL must be a model slug the Lovable gateway exposes; override it with
 * the GM_MODEL env var.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { GM_SYSTEM_PROMPT } from "./gmSystemPrompt";
import { GmWireResponseSchema, normalizeGmResponse, type GmResponse } from "./gmResponse";

const DEFAULT_GM_MODEL = "google/gemini-3.7-flash";

const GmTurnInput = z.object({
  /** The rendered context slice + player input (see renderGmUserPrompt). */
  userPrompt: z.string().min(1),
});

/** Turn a raw gateway failure into something a player can act on. */
function gmError(error: unknown, model: string): Error {
  const status =
    (error as { statusCode?: number; status?: number })?.statusCode ??
    (error as { status?: number })?.status;
  const detail = error instanceof Error ? error.message : String(error);
  if (status === 400) return new Error(`The GM model "${model}" is unavailable. (${detail})`);
  if (status === 401) return new Error("The GM is not configured: the AI key was rejected.");
  if (status === 402) return new Error("The GM is out of AI credits. Top up to keep playing.");
  if (status === 403) return new Error("AI access is blocked for this workspace.");
  if (status === 429) return new Error("The GM is being rate limited. Try again in a moment.");
  if (status && status >= 500) return new Error("The GM stumbled upstream. Try again.");
  return error instanceof Error ? error : new Error(detail);
}

export const gmTurnFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => GmTurnInput.parse(input))
  .handler(async ({ data }): Promise<GmResponse> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this app.");

    const model = process.env["GM_MODEL"] ?? DEFAULT_GM_MODEL;
    const { generateObject } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");

    const gateway = createLovableAiGatewayProvider(key);
    try {
      const { object } = await generateObject({
        model: gateway(model),
        schema: GmWireResponseSchema,
        system: GM_SYSTEM_PROMPT,
        prompt: data.userPrompt,
      });
      return normalizeGmResponse(object);
    } catch (error) {
      throw gmError(error, model);
    }
  });
