/**
 * Server-side background generation for the Lifepath step.
 * The model call and the API key stay on the server; the browser only sends
 * the system/user prompt pair produced by buildBackgroundPrompt().
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PromptInput = z.object({
  system: z.string().min(1),
  user: z.string().min(1),
});

const MODEL = "google/gemini-3.7-flash";

export const generateBackgroundFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => PromptInput.parse(input))
  .handler(async ({ data }): Promise<{ text: string }> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this app.");

    const { streamText } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");

    const gateway = createLovableAiGatewayProvider(key);
    const result = streamText({
      model: gateway(MODEL),
      system: data.system,
      prompt: data.user,
    });

    // Streaming keeps bytes flowing; we only need the finished prose.
    const text = (await result.text).trim();
    if (!text) throw new Error("The model returned an empty background.");
    return { text };
  });
