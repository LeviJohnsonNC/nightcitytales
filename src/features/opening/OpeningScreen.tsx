/**
 * The first screen of a campaign.
 *
 * The player has just spent an hour on a character sheet. This is the first
 * thing that happens to that person, and the first choice they make as them —
 * so it gets the whole viewport, no rail, no chrome, and it arrives at reading
 * pace rather than all at once.
 *
 * The four doors are the engine's; only their wording is the model's. Every one
 * of them leads somewhere genuinely different, which is the difference between
 * a choice and a menu.
 */
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { OpeningChoice } from "@/engine";
import { useOpening } from "./useOpening";
import type { OpeningDoor } from "./openingResponse";
import "./opening.css";

/** Paragraphs land first, then the prompt, then the doors. */
const PROSE_STEP_MS = 260;
const AFTER_PROSE_MS = 420;

function Standfirst({ character }: { character: ReturnType<typeof useOpening>["character"] }) {
  if (!character) return null;
  const handle = character.character.handle?.trim();
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
      {handle ? `"${handle}"` : character.character.name}
      {character.character.role ? ` · ${character.character.role}` : ""}
      {" · night one"}
    </p>
  );
}

/** No spinner. The city is deciding what kind of night this is. */
function Writing() {
  return (
    <div className="flex min-h-[60vh] flex-col justify-center gap-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-accent">Night City</p>
      <p className="open-breathe text-lg text-muted-foreground">
        Somewhere in seven million people, one of them is you.
      </p>
    </div>
  );
}

function Failed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col justify-center gap-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-destructive">
        The night did not come through
      </p>
      <p className="max-w-prose text-sm text-muted-foreground">{message}</p>
      <p className="max-w-prose text-sm text-muted-foreground">
        This one is worth waiting for, so there is no stand-in version of it. Try again.
      </p>
      <div>
        <Button onClick={onRetry} variant="outline">
          Try again
        </Button>
      </div>
    </div>
  );
}

function Door({
  door,
  index,
  delayMs,
  taken,
  busy,
  onChoose,
}: {
  door: OpeningDoor;
  index: number;
  delayMs: number;
  taken: OpeningChoice | null;
  busy: boolean;
  onChoose: (choice: OpeningChoice) => void;
}) {
  const isTaken = taken === door.choice;
  const passed = taken !== null && !isTaken;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onChoose(door.choice)}
      className={`open-door open-rise flex min-h-24 w-full flex-col items-start gap-1 border border-border bg-card p-4 text-left disabled:cursor-default ${
        isTaken ? "open-door-taken" : ""
      } ${passed ? "open-door-passed" : ""}`}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <span className="flex w-full items-baseline gap-2">
        <span className="num font-mono text-[10px] text-muted-foreground">{index + 1}</span>
        <span className="text-base font-bold leading-snug">{door.label}</span>
      </span>
      <span className="text-sm text-muted-foreground">{door.line}</span>
    </button>
  );
}

export function OpeningScreen({ campaignId }: { campaignId: string }) {
  const open = useOpening(campaignId);
  const { opening, choose, choosing } = open;
  /** The door being applied, so it can stay lit while the writes land. */
  const takenRef = useRef<OpeningChoice | null>(null);

  // 1-4 take a door. The screen has nothing else on it, so the digits are free
  // and a player who is reading rather than pointing should not have to reach
  // for the mouse.
  useEffect(() => {
    if (!opening || choosing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const index = Number(event.key) - 1;
      const door = opening.doors[index];
      if (!door) return;
      takenRef.current = door.choice;
      choose(door.choice);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opening, choosing, choose]);

  const body = () => {
    if (open.error) return <Failed message={open.error.message} onRetry={open.retry} />;
    if (open.writing || !opening) return <Writing />;

    const doorsDelay = opening.paragraphs.length * PROSE_STEP_MS + AFTER_PROSE_MS;
    const taken = choosing ? takenRef.current : null;

    return (
      <>
        <header className="space-y-3">
          <Standfirst character={open.character} />
          <h1
            className="open-rise text-3xl font-bold leading-tight tracking-tight text-glow-pink sm:text-4xl"
            style={{ animationDelay: "80ms" }}
          >
            {opening.title}
          </h1>
          <div
            className="open-rule h-px bg-accent/60"
            style={{ animationDelay: "200ms" }}
            aria-hidden
          />
        </header>

        <article className="space-y-5">
          {opening.paragraphs.map((paragraph, i) => (
            <p
              key={i}
              className="open-rise max-w-[62ch] text-base leading-relaxed sm:text-lg"
              style={{ animationDelay: `${360 + i * PROSE_STEP_MS}ms` }}
            >
              {paragraph}
            </p>
          ))}
        </article>

        <section className="space-y-3">
          <p
            className="open-rise font-mono text-[11px] uppercase tracking-[0.28em] text-accent"
            style={{ animationDelay: `${doorsDelay}ms` }}
          >
            What do you do first?
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {opening.doors.map((door, i) => (
              <Door
                key={door.choice}
                door={door}
                index={i}
                delayMs={doorsDelay + 120 + i * 90}
                taken={taken}
                busy={choosing}
                onChoose={(choice) => {
                  takenRef.current = choice;
                  choose(choice);
                }}
              />
            ))}
          </div>
          {open.chooseError && (
            <p className="text-sm text-destructive">{open.chooseError.message}</p>
          )}
          <p
            className="open-rise text-xs text-muted-foreground"
            style={{ animationDelay: `${doorsDelay + 500}ms` }}
          >
            Nothing here is locked in. Night City will keep offering.
          </p>
        </section>
      </>
    );
  };

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-5 py-12 sm:py-16">{body()}</div>
    </div>
  );
}
