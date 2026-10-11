/**
 * Portrait image generation. A server route rather than a server function:
 * the gateway answers with a streaming SSE Response, which typed RPC cannot
 * return. The prompt is assembled here from the facts the client sends, and
 * LOVABLE_API_KEY never leaves the server.
 *
 * Being a route rather than a server function is also why this needs its auth
 * written out: `requireSupabaseAuth` is function middleware and never runs
 * here, and neither does the CSRF middleware in src/start.ts, which filters on
 * `handlerType === "serverFn"`. Every call bills an image, so the check is the
 * difference between a feature and an open tab on somebody's account.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PORTRAIT_SIZE, buildPortraitPrompt } from "@/features/chargen/portraitPrompt";

const Facts = z.object({
  handle: z.string().max(120).default(""),
  pronouns: z.string().max(60).default(""),
  gender: z.enum(["female", "male", "non-binary", "unspecified"]),
  age: z.number().int().min(10).max(120).nullable().default(null),
  role: z.string().max(60).nullable(),
  roleAbility: z.string().max(60).nullable(),
  facts: z.array(z.object({ label: z.string().max(60), value: z.string().max(300) })).max(20),
  build: z.string().max(80).nullable().default(null),
  wardrobe: z.array(z.string().max(160)).max(20).default([]),
  chrome: z.array(z.string().max(80)).max(20).default([]),
  armor: z.array(z.string().max(120)).max(6).default([]),
  weapon: z.string().max(80).nullable().default(null),
  humanity: z.string().max(160).nullable().default(null),
  home: z.string().max(160).nullable().default(null),
  setting: z
    .array(z.object({ label: z.string().max(60), value: z.string().max(300) }))
    .max(8)
    .default([]),
  selfDescription: z.string().max(400).default(""),
  stream: z.boolean().optional(),
});

const MODEL = "openai/gpt-image-1-mini";

/**
 * Portraits are re-rolled a few times in a sitting and then not again for
 * hours, so a generous burst is the honest shape. See rate-limit.server.ts for
 * what this does and does not promise.
 */
/** What a player is told when the image gateway refuses. */
function portraitFailure(status: number): string {
  if (status === 402) return "Out of AI credits for portraits. Top up to keep developing.";
  if (status === 429) return "The darkroom is busy. Try again in a moment.";
  if (status === 401 || status === 403) return "Portraits are not configured for this app.";
  if (status >= 500) return "The darkroom stumbled upstream. Try again.";
  return `Portrait generation failed (${status}).`;
}

const PORTRAIT_LIMIT = { limit: 12, windowMs: 5 * 60_000 };

export const Route = createFileRoute("/api/generate-portrait")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("AI is not configured for this app.", { status: 500 });

        // Authenticate BEFORE parsing or spending anything.
        const { requireUserId, UnauthorizedError } =
          await import("@/integrations/supabase/requestAuth.server");
        let userId: string;
        try {
          userId = await requireUserId(request);
        } catch (error) {
          if (error instanceof UnauthorizedError) {
            return new Response("Sign in to generate a portrait.", { status: 401 });
          }
          throw error;
        }

        const { takeToken } = await import("@/lib/rate-limit.server");
        const verdict = takeToken(`portrait:${userId}`, PORTRAIT_LIMIT);
        if (!verdict.allowed) {
          return new Response("That is a lot of portraits. Try again shortly.", {
            status: 429,
            headers: { "Retry-After": String(verdict.retryAfterSeconds) },
          });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid portrait request.", { status: 400 });
        }
        const parsed = Facts.safeParse(body);
        if (!parsed.success) return new Response("Invalid portrait request.", { status: 400 });
        const { stream = true, ...facts } = parsed.data;

        let upstream: Response;
        try {
          upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: MODEL,
              prompt: buildPortraitPrompt(facts),
              size: `${PORTRAIT_SIZE.width}x${PORTRAIT_SIZE.height}`,
              quality: "low",
              n: 1,
              ...(stream ? { stream: true, partial_images: 1 } : {}),
            }),
          });
        } catch {
          return new Response("The darkroom is unreachable. Try again.", { status: 502 });
        }

        if (!upstream.ok || !upstream.body) {
          // The gateway's own body can carry account and billing detail meant
          // for the operator, so the player gets a sentence instead.
          await upstream.body?.cancel().catch(() => undefined);
          return new Response(portraitFailure(upstream.status), {
            status: upstream.status >= 500 ? 502 : upstream.status,
          });
        }
        if (!stream) {
          return new Response(upstream.body, { headers: { "Content-Type": "application/json" } });
        }
        return new Response(upstream.body, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});
