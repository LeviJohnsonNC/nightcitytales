/**
 * How a job ends, as one frame; and how the next stretch of Life opens.
 *
 * Both are the same moment, read from the same stored frame (`ClosingFrame`),
 * so what Aftermath showed is exactly what "Previously" reminds you of. The
 * words are `engine/closingFrame.ts`'s templates over what the ledger recorded —
 * a Death Save, a hit, a die — with the engine's own trace of the roll beneath
 * them, verbatim. Nothing here is written by a model, and nothing here ticks,
 * counts down or asks the player to come back: the open thread is a fact the
 * world is holding, stated once.
 */
import type { ClosingFrame } from "@/engine";
import { Button } from "@/components/ui/button";
import "./closingFrame.css";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
      {children}
    </p>
  );
}

function Thread({ frame }: { frame: ClosingFrame }) {
  if (!frame.thread) return null;
  return (
    <div className="cframe-thread space-y-1 border-l-2 border-neon-pink/70 pl-3">
      <Eyebrow>Still open</Eyebrow>
      <p className="text-sm leading-snug text-foreground">{frame.thread.text}</p>
    </div>
  );
}

/** The job's last frame, at the top of the wrap-up. */
export function ClosingFrameCard({ frame }: { frame: ClosingFrame }) {
  return (
    <section
      className="cframe space-y-3 border border-border/70 px-4 py-4"
      aria-label="How the job ended"
      data-testid="closing-frame"
    >
      <Eyebrow>
        The last frame
        {frame.title ? <span className="text-foreground/70"> · {frame.title}</span> : null}
      </Eyebrow>
      {frame.peak ? (
        <div className="cframe-rise space-y-1.5">
          <p className="text-lg leading-snug">{frame.peak.headline}</p>
          {frame.peak.trace && (
            <p className="break-words font-mono text-[11px] leading-relaxed text-muted-foreground">
              {frame.peak.trace}
            </p>
          )}
        </div>
      ) : null}
      <div className="cframe-rise" style={{ animationDelay: "0.35s" }}>
        <Thread frame={frame} />
      </div>
    </section>
  );
}

/** The same frame, at the top of Life, until it is no longer news. */
export function PreviouslyCard({
  frame,
  onDismiss,
}: {
  frame: ClosingFrame;
  onDismiss: () => void;
}) {
  return (
    <section
      className="cframe space-y-2.5 border-l-2 border-accent bg-accent/5 px-3 py-2.5"
      aria-label="Previously"
      data-testid="previously"
    >
      <Eyebrow>
        <span className="text-accent">Previously</span>
        {frame.title ? <span className="text-foreground/70"> · {frame.title}</span> : null}
      </Eyebrow>
      {frame.peak && <p className="cframe-rise text-sm leading-snug">{frame.peak.headline}</p>}
      <Thread frame={frame} />
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={onDismiss}
        >
          Got it
        </Button>
      </div>
    </section>
  );
}
