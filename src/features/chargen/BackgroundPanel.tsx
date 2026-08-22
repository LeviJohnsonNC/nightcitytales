import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { generateBackground, type BackgroundInput } from "./lifepathBackground";

type Status = "idle" | "loading" | "error";

/**
 * The payoff panel. Shows nothing narrative until the player asks for it, then
 * generates a natural-language background (from structured Lifepath facts) into
 * an editable field. Generation is gated on the required tables being answered.
 */
export function BackgroundPanel({
  ready,
  missing,
  buildInput,
  value,
  onChange,
}: {
  ready: boolean;
  missing: string[];
  buildInput: () => BackgroundInput;
  value: string;
  onChange: (text: string) => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function weave() {
    setStatus("loading");
    setErrorMessage(null);
    try {
      const text = await generateBackground(buildInput());
      onChange(text);
      setStatus("idle");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }


  const hasStory = value.trim().length > 0;

  return (
    <section className="border border-hairline bg-surface p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-base font-bold uppercase tracking-[0.14em] text-text">
          Your Story
        </h2>
        {hasStory && (
          <Button size="sm" variant="outline" disabled={status === "loading"} onClick={weave}>
            {status === "loading" ? "Weaving…" : "Regenerate"}
          </Button>
        )}
      </header>

      {!hasStory && status !== "loading" && (
        <div className="mt-4 flex flex-col items-start gap-3">
          {!ready && (
            <p className="text-sm leading-relaxed text-text-dim">
              Pull your threads on the Lifepath first. Then weave them into a background in your
              character's own voice, the kind of story a Night City local would actually tell. Every
              word stays yours to rewrite.
            </p>
          )}

          <Button disabled={!ready} onClick={weave}>
            Weave my story
          </Button>
          {!ready && (
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-dim">
              {missing.length === 1
                ? missing[0]
                : `${missing.length} things left before you can weave: ${missing[0]}`}
            </p>
          )}
        </div>
      )}

      {status === "loading" && !hasStory && (
        <div className="mt-4 flex items-center gap-3 text-sm text-text-muted">
          <span
            aria-hidden
            className="size-4 animate-spin rounded-full border-2 border-ember/40 border-t-ember"
          />
          Weaving your story from the threads you pulled…
        </div>
      )}

      {status === "error" && (
        <p className="mt-3 text-sm text-danger">
          Something went wrong weaving your story. Try again.
        </p>
      )}

      {hasStory && (
        <div className="mt-4">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={9}
            className={cn(
              "w-full resize-y border border-hairline bg-ground px-3 py-2.5 text-[0.95rem] leading-relaxed text-text",
              "focus:border-ember focus:outline-none",
            )}
          />
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-text-dim">
            AI draft from your Lifepath. Edit freely; this is your character's words.
          </p>
        </div>
      )}
    </section>
  );
}
