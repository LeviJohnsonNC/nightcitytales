/**
 * The end-of-session I.P. judgement, run server-side so the AI key stays there.
 * Thin wrapper: the schema, prompts and normalization live in ipJudgement.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  IP_JUDGEMENT_SYSTEM_PROMPT,
  IpJudgementWireSchema,
  normalizeIpJudgement,
  type IpJudgement,
} from "./ipJudgement";

const IpJudgementInput = z.object({ userPrompt: z.string().min(1) });

export const ipJudgementFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => IpJudgementInput.parse(input))
  .handler(async ({ data }): Promise<IpJudgement> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this app.");
    const model = process.env["GM_MODEL"] ?? "google/gemini-3.7-flash";
    const { generateObject } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);
    const { object } = await generateObject({
      model: gateway(model),
      schema: IpJudgementWireSchema,
      system: IP_JUDGEMENT_SYSTEM_PROMPT,
      prompt: data.userPrompt,
    });
    return normalizeIpJudgement(object);
  });
