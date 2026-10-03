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
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { OpeningChoice } from "@/engine";
import { leaveDescentAudio, liveDescentAudio } from "./descent/descentAudio";
import { Descent } from "./descent/Descent";
import { prefersReducedMotion } from "./descent/descentDevice";
import { buildDescentFacts } from "./descent/descentFacts";
import { LandingBackdrop } from "./LandingBackdrop";
import { TYPE_CPS, isRevealed, revealed, typingDuration } from "./landingText";
import { useOpening } from "./useOpening";
import type { OpeningDoor } from "./openingResponse";
import "./opening.css";

/** The signs come on one after another, once the prose has been read to the end. */
const SIGN_START_MS = 160;
const SIGN_STEP_MS = 150;
/** Door hues, in the order the engine lists the doors: cyan, pink, violet, amber. */
const SIGN_HUES = ["cyan", "pink", "violet", "amber"] as const;

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
  lit,
  taken,
  busy,
  onChoose,
}: {
  door: OpeningDoor;
  index: number;
  /** The sign has come on. Until then it is dark and cannot be taken. */
  lit: boolean;
  taken: OpeningChoice | null;
  busy: boolean;
  onChoose: (choice: OpeningChoice) => void;
}) {
  const isTaken = taken === door.choice;
  const passed = taken !== null && !isTaken;
  return (
    <button
      type="button"
      disabled={busy || !lit}
      tabIndex={lit ? 0 : -1}
      onClick={() => onChoose(door.choice)}
      data-hue={SIGN_HUES[index % SIGN_HUES.length]}
      data-lit={lit ? "yes" : "no"}
      className={`open-sign flex min-h-24 w-full flex-col items-start gap-1 p-4 text-left disabled:cursor-default ${
        isTaken ? "open-sign-taken" : ""
      } ${passed ? "open-sign-passed" : ""}`}
      style={{ animationDelay: `${SIGN_START_MS + index * SIGN_STEP_MS}ms` }}
    >
      <span className="flex w-full items-baseline gap-2.5">
        <kbd className="open-key num">{index + 1}</kbd>
        <span className="text-base font-bold leading-snug">{door.label}</span>
      </span>
      <span className="text-sm text-muted-foreground">{door.line}</span>
    </button>
  );
}

/**
 * The night, typed.
 *
 * The prose arrives at the pace it is read, a paragraph at a time, with a soft
 * key for each; a click or a key at any point shows the rest at once, and a
 * player who has asked for less motion gets it all immediately. The doors do not
 * come on until it has been read to the end, and then they come on like signs.
 */
function useTyping(paragraphs: string[], reduced: boolean) {
  const [elapsed, setElapsed] = useState(reduced ? Number.POSITIVE_INFINITY : 0);
  const skipped = useRef(reduced);
  const text = paragraphs.join("\n");

  useEffect(() => {
    if (reduced) {
      setElapsed(Number.POSITIVE_INFINITY);
      return;
    }
    skipped.current = false;
    setElapsed(0);
    const total = typingDuration(paragraphs);
    let clock = 0;
    let last = performance.now();
    let lastChars = 0;
    let lastSound = 0;
    let raf = 0;
    const frame = (now: number) => {
      clock += Math.min(64, now - last);
      last = now;
      if (skipped.current) clock = total + 1;
      const counts = revealed(paragraphs, clock);
      const chars = counts.reduce((sum, c) => sum + c, 0);
      if (chars !== lastChars) {
        if (chars - lastChars >= 2 && now - lastSound > 42 && !skipped.current) {
          lastSound = now;
          liveDescentAudio()?.type();
        }
        lastChars = chars;
        setElapsed(clock);
      }
      if (clock <= total) raf = requestAnimationFrame(frame);
      else setElapsed(Number.POSITIVE_INFINITY);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // The text is the trigger: a new opening types again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, reduced]);

  const counts = revealed(paragraphs, elapsed);
  return {
    counts,
    done: isRevealed(paragraphs, counts),
    skip: () => {
      skipped.current = true;
    },
  };
}

/** The prose and the doors: the screen the descent lands on. */
export function OpeningStage({ open }: { open: ReturnType<typeof useOpening> }) {
  const { opening, choose, choosing } = open;
  /** The door being applied, so it can stay lit while the writes land. */
  const takenRef = useRef<OpeningChoice | null>(null);
  const reduced = useMemo(prefersReducedMotion, []);
  const facts = useMemo(() => (open.bundle ? buildDescentFacts(open.bundle) : null), [open.bundle]);
  const paragraphs = opening?.paragraphs ?? [];
  const typing = useTyping(paragraphs, reduced);
  const lit = typing.done;

  // Each sign catches with a small buzz as it comes on.
  useEffect(() => {
    if (!lit || reduced || !opening) return;
    const timers = opening.doors.map((_, i) =>
      window.setTimeout(() => liveDescentAudio()?.sign(), SIGN_START_MS + i * SIGN_STEP_MS),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [lit, reduced, opening]);

  // Taking a door: a breath of rain, then the storm and the scene go together.
  // Latched, so the storm cannot come back in the moment between the door being
  // written and the next screen arriving; only a failed door brings it back.
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (choosing) {
      setLeaving(true);
      liveDescentAudio()?.door();
    }
  }, [choosing]);
  useEffect(() => {
    if (open.chooseError) setLeaving(false);
  }, [open.chooseError]);
  // Whatever comes next, the rain does not follow the player into it.
  useEffect(() => () => leaveDescentAudio(), []);

  // Space, Enter and a click show the rest of the prose. 1-4 take a door, once
  // the signs are on — the screen has nothing else on it, so the digits are
  // free, and a player who is reading rather than pointing should not have to
  // reach for the mouse.
  useEffect(() => {
    if (!opening || choosing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === " " || event.key === "Enter") {
        typing.skip();
        return;
      }
      const index = Number(event.key) - 1;
      const door = opening.doors[index];
      if (!door) return;
      if (!lit) {
        typing.skip();
        return;
      }
      takenRef.current = door.choice;
      choose(door.choice);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opening, choosing, choose, lit]);

  const body = () => {
    if (open.error) return <Failed message={open.error.message} onRetry={open.retry} />;
    if (!opening) return null;
    const taken = choosing ? takenRef.current : null;

    return (
      <>
        <header className="space-y-3">
          <Standfirst character={open.character} />
          <h1 className="open-slam text-3xl font-bold leading-tight tracking-tight text-glow-pink sm:text-5xl">
            {opening.title}
          </h1>
          <div
            className="open-rule h-px bg-accent/60"
            style={{ animationDelay: "700ms" }}
            aria-hidden
          />
        </header>

        <article
          className="open-glass space-y-5 p-5 sm:p-7"
          onClick={typing.skip}
          title={lit ? undefined : "Click to show it all"}
        >
          {opening.paragraphs.map((paragraph, i) => {
            const shown = typing.counts[i] ?? 0;
            return (
              <p key={i} className="max-w-[62ch] text-base leading-relaxed sm:text-lg">
                {/* Screen readers get the whole paragraph; the typing is for eyes. */}
                <span className="sr-only">{paragraph}</span>
                <span aria-hidden>
                  {paragraph.slice(0, shown)}
                  <span className="opacity-0">{paragraph.slice(shown)}</span>
                </span>
              </p>
            );
          })}
        </article>

        <section className={`space-y-3 open-doors ${lit ? "open-doors-on" : ""}`}>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-accent">
            What do you do first?
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {opening.doors.map((door, i) => (
              <Door
                key={door.choice}
                door={door}
                index={i}
                lit={lit}
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
          <p className="text-xs text-muted-foreground">
            Nothing here is locked in. Night City will keep offering.
          </p>
        </section>
      </>
    );
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#06040f]">
      <LandingBackdrop facts={facts} leaving={leaving} />
      <div
        className={`open-arrive relative mx-auto flex max-w-3xl flex-col gap-8 px-5 py-12 sm:py-16 ${choosing ? "open-exit" : ""}`}
      >
        {body()}
      </div>
    </div>
  );
}

/**
 * The first screen of a campaign: the descent while the night is written, then
 * the night itself.
 */
export function OpeningScreen({ campaignId }: { campaignId: string }) {
  const open = useOpening(campaignId);
  /** The descent has handed over: from here on the screen is the prose. */
  const [landed, setLanded] = useState(false);
  const descentFacts = useMemo(
    () => (open.bundle ? buildDescentFacts(open.bundle) : null),
    [open.bundle],
  );

  // The ten seconds the night takes to write belong to the descent. An error
  // ends it at once, because there is nothing left to wait for.
  if (!open.error && !landed) {
    return (
      <Descent
        facts={descentFacts}
        ready={!open.writing && open.opening !== null}
        onDone={() => setLanded(true)}
      />
    );
  }
  return <OpeningStage open={open} />;
}
