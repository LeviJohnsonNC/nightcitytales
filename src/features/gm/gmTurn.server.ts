/**
 * The GM turn — a server function that asks the model (via the Lovable AI
 * gateway) to narrate the current beat and parse the player's intent into
 * structured, engine-resolvable actions. The API key never leaves the server,
 * mirroring generateBackgroundFn.
 *
 * GM_MODEL must be an Anthropic model slug the Lovable gateway exposes; override
 * it with the GM_MODEL env var. The GM system prompt is tuned for Claude.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { GM_SYSTEM_PROMPT } from "./gmSystemPrompt";
import { GmResponseSchema, type GmResponse } from "./gmResponse";

const DEFAULT_GM_MODEL = "anthropic/claude-sonnet-4";

const GmTurnInput = z.object({
  /** The rendered context slice + player input (see renderGmUserPrompt). */
  userPrompt: z.string().min(1),
});

export const gmTurnFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => GmTurnInput.parse(input))
  .handler(async ({ data }): Promise<GmResponse> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this app.");

    const model = process.env["GM_MODEL"] ?? DEFAULT_GM_MODEL;
    const { generateObject } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");

    const gateway = createLovableAiGatewayProvider(key);
    const { object } = await generateObject({
      model: gateway(model),
      schema: GmResponseSchema,
      system: GM_SYSTEM_PROMPT,
      prompt: data.userPrompt,
    });
    return object;
  });
