/**
 * Server-side prose generation for the chargen steps that use the model.
 *
 * The model call and the API key stay on the server. So does the SYSTEM prompt:
 * the browser names a job from the closed list in background.jobs.ts and
 * sends only the facts, because an endpoint that accepts a caller-supplied
 * system prompt is not a background generator, it is whatever the caller wants
 * it to be. See background.prompts.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BACKGROUND_JOBS } from "./background.jobs";

const MODEL = "google/gemini-3.7-flash";

/**
 * The facts payload is JSON the wizard assembled, so it has a real ceiling. The
 * cap is generous enough for a fully answered Lifepath and small enough that
 * this cannot be used to push an essay through the gateway.
 */
const MAX_USER_CHARS = 20_000;

const PromptInput = z.object({
  job: z.enum(BACKGROUND_JOBS),
  user: z.string().min(1).max(MAX_USER_CHARS),
});

export const generateBackgroundFn = createServerFn({ method: "POST" })
  // Spends AI credits — see gmTurn.server.ts.
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PromptInput.parse(input))
  .handler(async ({ data }): Promise<{ text: string }> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this app.");

    const { streamText } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const { systemPromptFor } = await import("./background.prompts");

    const gateway = createLovableAiGatewayProvider(key);
    const result = streamText({
      model: gateway(MODEL),
      system: systemPromptFor(data.job),
      prompt: data.user,
    });

    // Streaming keeps bytes flowing; we only need the finished prose.
    const text = (await result.text).trim();
    if (!text) throw new Error("The model returned an empty background.");
    return { text };
  });
