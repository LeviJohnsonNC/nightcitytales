/**
 * The cold open — a server function, so the AI key never reaches the browser.
 * Mirrors lifeTurn.server.ts exactly, including how gateway failures are turned
 * into something a player can act on.
 *
 * There is no canned opening behind this. A failure is reported and the player
 * retries, which is the call recorded in the plan: the first three paragraphs
 * are the experience, and a lesser version of them is worse than a retry.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OPENING_SYSTEM_PROMPT } from "./openingPrompt";
import { OpeningWireSchema, normalizeOpening, type Opening } from "./openingResponse";

const DEFAULT_OPENING_MODEL = "google/gemini-3.7-flash";

const OpeningInput = z.object({
  /** The rendered fact slice (see renderOpeningPrompt). */
  userPrompt: z.string().min(1),
});

function openingError(error: unknown, model: string): Error {
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

export const openingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OpeningInput.parse(input))
  .handler(async ({ data }): Promise<Opening> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this app.");

    const model = process.env["OPENING_MODEL"] ?? process.env["GM_MODEL"] ?? DEFAULT_OPENING_MODEL;
    const { generateObject } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");

    const gateway = createLovableAiGatewayProvider(key);
    try {
      const { object } = await generateObject({
        model: gateway(model),
        schema: OpeningWireSchema,
        system: OPENING_SYSTEM_PROMPT,
        prompt: data.userPrompt,
      });
      return normalizeOpening(object);
    } catch (error) {
      throw openingError(error, model);
    }
  });
