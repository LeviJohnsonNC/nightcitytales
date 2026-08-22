/**
 * Portrait image generation. A server route rather than a server function:
 * the gateway answers with a streaming SSE Response, which typed RPC cannot
 * return. The prompt is assembled here from the facts the client sends, and
 * LOVABLE_API_KEY never leaves the server.
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
  facts: z.array(z.object({ label: z.string().max(60), value: z.string().max(300) })).max(12),
  selfDescription: z.string().max(400).default(""),
  stream: z.boolean().optional(),
});

const MODEL = "openai/gpt-image-1-mini";

export const Route = createFileRoute("/api/generate-portrait")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("AI is not configured for this app.", { status: 500 });

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
