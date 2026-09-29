/**
 * One call to the judge model. The logic around it is
 * `src/features/narration/judge.ts`, which CI tests; this is the network.
 *
 * `generateText` and a tolerant parse rather than `generateObject`: the judge
 * is a different family from the narrator on purpose, and providers differ in
 * how they honour a schema. A reply that is not a verdict is retried once by
 * the caller and otherwise counted as unparseable, not guessed at.
 */
import { parseJudgement, renderJudgePrompt, type Judgement } from "@/features/narration/judge";
import { withRetry } from "./pacing";
import { evalProvider, providerFor } from "./runTurn";

/**
 * A different family from the narrator's default (`google/gemini-3.7-flash`):
 * a model tends to prefer prose that sounds like itself. `JUDGE_MODEL`
 * overrides it.
 */
export const JUDGE_MODEL = process.env["JUDGE_MODEL"] ?? "anthropic/claude-haiku-4.5";

export async function judgePair(input: {
  scene: string;
  a: string;
  b: string;
  intent?: string;
}): Promise<Judgement | null> {
  const provider = evalProvider();
  const { generateText } = await import("ai");
  const gateway = await providerFor(provider);
  const { system, prompt } = renderJudgePrompt(input);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { text } = await withRetry(() =>
      generateText({
        model: gateway(provider.modelId(JUDGE_MODEL)),
        system,
        prompt,
        temperature: 0,
        maxOutputTokens: 600,
      }),
    );
    const judgement = parseJudgement(text);
    if (judgement) return judgement;
  }
  return null;
}
