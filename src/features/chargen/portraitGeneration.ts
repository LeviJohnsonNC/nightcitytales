/**
 * Client half of portrait generation: stream the image from the server route,
 * hand each frame to the caller for progressive display, then upload the final
 * PNG to storage and return its path.
 */
import { createParser } from "eventsource-parser";
import { flushSync } from "react-dom";
import { uploadPortrait } from "@/lib/backend";
import type { PortraitFacts } from "./portraitPrompt";

const ENDPOINT = "/api/generate-portrait";

type Frame = { b64_json?: string; error?: { message?: string }; type?: string };

function dataUrl(b64: string): string {
  return `data:image/png;base64,${b64}`;
}

function blobFromBase64(b64: string): Blob {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: "image/png" });
}

/**
 * Streams one portrait. `onFrame` fires for every preview and for the final
 * image; `isFinal` says which. Resolves with the storage path of the upload.
 */
export async function generatePortrait(
  facts: PortraitFacts,
  userId: string,
  draftId: string | null,
  onFrame: (dataUrl: string, isFinal: boolean) => void,
): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(facts),
  });
  if (!res.ok || !res.body) {
    throw new Error((await res.text().catch(() => "")) || `Portrait generation failed (${res.status}).`);
  }

  let finalB64: string | null = null;
  let sawAnyEvent = false;
  let streamError: string | undefined;

  const parser = createParser({
    onEvent(event) {
      let payload: Frame | undefined;
      try {
        payload = JSON.parse(event.data) as Frame;
      } catch {
        return;
      }
      if (event.event === "error" || payload?.type === "error") {
        sawAnyEvent = true;
        streamError = payload?.error?.message ?? "Portrait generation failed.";
        return;
      }
      const known =
        event.event === "image_generation.partial_image" ||
        event.event === "image_generation.completed";
      if (!known || !payload?.b64_json) return;
      sawAnyEvent = true;
      const isFinal = event.event === "image_generation.completed";
      if (isFinal) finalB64 = payload.b64_json;
      const b64 = payload.b64_json;
      flushSync(() => onFrame(dataUrl(b64), isFinal));
    },
  });

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      parser.feed(value);
    }
  } finally {
    reader.cancel().catch(() => {});
  }

  if (streamError) throw new Error(streamError);

  if (!sawAnyEvent) {
    // Zero events is a transport hiccup: replay once, non-streamed.
    const replay = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...facts, stream: false }),
    });
    if (!replay.ok) {
      throw new Error(
        (await replay.text().catch(() => "")) || `Portrait generation failed (${replay.status}).`,
      );
    }
    const json = (await replay.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("The model returned no portrait.");
    finalB64 = b64;
    onFrame(dataUrl(b64), true);
  }

  if (!finalB64) throw new Error("The portrait stream ended before the image was finished.");
  return uploadPortrait(userId, draftId, blobFromBase64(finalB64));
}
