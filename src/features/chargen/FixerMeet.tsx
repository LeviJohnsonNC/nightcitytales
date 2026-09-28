import { useEffect, useRef } from "react";
import { fixerCandidates, rollJobSeed } from "@/engine";
import { findNpc, npcArtwork } from "@/features/cast/npcDirectory";
import { cn } from "@/lib/utils";
import { uploadedAsset } from "./art";
import { Backdrop } from "./Backdrop";
import { fixerVoice } from "./interview";
import { useChargenStore, type ChargenState } from "./store";
import "./interview.css";

/**
 * The first screen of character creation: three fixers, one chair.
 *
 * It used to open on "Method: Streetrat / Edgerunner / Complete Package", which
 * asks a newcomer how much paperwork they would like before asking who they
 * want to be. This asks nothing about the rules at all. Somebody in Night City
 * is willing to see you tonight, and you choose who.
 *
 * Whoever is picked asks every question after this, and is carried into the
 * campaign as the character's fixer through the cast plan, so the person who
 * sized you up on day zero is the person who calls with work on night one.
 */
export function FixerMeet({ state }: { state: ChargenState }) {
  const patch = useChargenStore((s) => s.patch);
  const plan = state.castPlan;
  const greeting = useRef<HTMLQuoteElement>(null);
  const chosenNow = plan?.picks.fixer ?? null;
  const seen = useRef(chosenNow);

  // The room is dealt once per draft and kept, so a reload shows the same three.
  useEffect(() => {
    if (!plan) patch({ castPlan: { seed: rollJobSeed(), picks: {} } });
  }, [plan, patch]);

  // Picking somebody is answered by them speaking, and the line lands below the
  // cards, off the bottom of a laptop screen. Bring it up, but only for a pick
  // made here: coming back to a step already answered should not scroll.
  useEffect(() => {
    if (chosenNow === seen.current) return;
    seen.current = chosenNow;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    greeting.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
  }, [chosenNow]);

  if (!plan) return null;
  const room = fixerCandidates(plan.seed);
  const chosen = plan.picks.fixer ?? null;
  const voice = fixerVoice(chosen);

  function choose(name: string) {
    if (!plan) return;
    patch({ castPlan: { ...plan, picks: { ...plan.picks, fixer: name } } });
  }

  return (
    <div className="space-y-8">
      {/* The scene is the page's heading. The picture is a view out of a
          rain-streaked window, so the crop keeps the frame and the tops of the
          towers, and the scrim only darkens the part the words sit on. */}
      <section className="relative flex min-h-[22rem] items-center overflow-hidden border border-hairline bg-surface px-6 py-12 sm:min-h-[26rem] sm:px-10">
        <Backdrop
          name="scene-meet"
          focus="58% 32%"
          drift
          scrim="bg-[linear-gradient(90deg,var(--color-background)_0%,color-mix(in_oklab,var(--color-background)_82%,transparent)_42%,color-mix(in_oklab,var(--color-background)_40%,transparent)_66%,transparent_88%)]"
        />
        <div aria-hidden className="cg-rain" />
        <div className="relative max-w-[42rem] space-y-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent">
            Night City · 2045
          </p>
          <h1 className="text-balance text-3xl font-bold leading-[1.1] tracking-tight [text-shadow:0_2px_18px_rgb(0_0_0/0.6)] sm:text-4xl">
            <span className="block">You need work.</span>
            <span className="block">Three fixers will see you tonight.</span>
          </h1>
          <p className="max-w-[26rem] text-pretty text-base leading-relaxed text-foreground/80">
            Pick one. Whoever you sit down with asks the questions, writes down the answers, and is
            the one who calls when there is a job.
          </p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        {room.map((name, i) => {
          const npc = findNpc(name);
          // The meet's own picture of them, in their venue, when one has been
          // made; otherwise the square-on portrait every other screen uses.
          const scene = npc ? uploadedAsset(`meet-${npc.id}`) : null;
          const art = scene ? { src: scene, srcSet: undefined } : npc ? npcArtwork(npc) : null;
          const line = fixerVoice(name);
          const selected = chosen === name;
          return (
            <button
              key={name}
              type="button"
              aria-pressed={selected}
              onClick={() => choose(name)}
              style={{ animationDelay: `${i * 140}ms` }}
              className={cn(
                "cg-arrive group relative flex flex-col overflow-hidden border bg-card text-left transition-colors",
                selected
                  ? "border-ember shadow-[0_0_0_1px_var(--color-ember)]"
                  : chosen
                    ? "border-hairline opacity-60 hover:opacity-100"
                    : "border-hairline hover:border-accent/60",
              )}
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden">
                {art ? (
                  <img
                    src={art.src}
                    srcSet={art.srcSet}
                    sizes="(min-width: 1024px) 22rem, 90vw"
                    alt={name}
                    style={scene ? { objectPosition: "50% 30%" } : undefined}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  />
                ) : null}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
                {selected && (
                  <span className="absolute right-3 top-3 bg-ember px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-background">
                    Your fixer
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 space-y-1 p-4">
                  <h3 className="text-xl font-bold tracking-tight">{name}</h3>
                  {line && <p className="text-sm italic text-text-muted">{line.where}</p>}
                </div>
              </div>
              {line && (
                <p className="border-t border-hairline p-4 text-sm leading-relaxed">{line.pitch}</p>
              )}
            </button>
          );
        })}
      </div>

      {voice && chosen && (
        <blockquote
          ref={greeting}
          key={chosen}
          className="cg-say border-l-2 border-ember bg-ember/5 px-6 py-5 text-lg leading-relaxed"
        >
          “{voice.greeting}”
          <footer className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">
            {chosen}
          </footer>
        </blockquote>
      )}
    </div>
  );
}
