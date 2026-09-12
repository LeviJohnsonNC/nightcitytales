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
import { buildPortraitPrompt } from "@/features/chargen/portraitPrompt";

const Facts = z.object({
  handle: z.string().max(120).default(""),
  pronouns: z.string().max(60).default(""),
  gender: z.enum(["female", "male", "non-binary", "unspecified"]),
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
  selfDescription: z.string().max(400).default(""),
  stream: z.boolean().optional(),
});

const MODEL = "openai/gpt-image-1-mini";

/**
 * Portraits are re-rolled a few times in a sitting and then not again for
 * hours, so a generous burst is the honest shape. See rate-limit.server.ts for
 * what this does and does not promise.
 */
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

        const parsed = Facts.safeParse(await request.json());
        if (!parsed.success) return new Response("Invalid portrait request.", { status: 400 });
        const { stream = true, ...facts } = parsed.data;

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: MODEL,
            prompt: buildPortraitPrompt(facts),
            size: "1024x1536",
            quality: "low",
            n: 1,
            ...(stream ? { stream: true, partial_images: 1 } : {}),
          }),
        });

        if (!upstream.ok || !upstream.body) {
          return new Response(await upstream.text(), { status: upstream.status });
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
