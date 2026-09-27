import { useEffect } from "react";
import { fixerCandidates, rollJobSeed } from "@/engine";
import { findNpc, npcArtwork } from "@/features/cast/npcDirectory";
import { cn } from "@/lib/utils";
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

  // The room is dealt once per draft and kept, so a reload shows the same three.
  useEffect(() => {
    if (!plan) patch({ castPlan: { seed: rollJobSeed(), picks: {} } });
  }, [plan, patch]);

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
      <section className="relative overflow-hidden border border-hairline bg-surface px-6 py-10 sm:px-10">
        <div aria-hidden className="cg-rain" />
        <div className="relative space-y-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent">
            Night City · 2045
          </p>
          <h2 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            You need work. Three fixers will see you tonight.
          </h2>
          <p className="max-w-2xl text-base leading-relaxed text-text-muted">
            Pick one. Whoever you sit down with asks the questions, writes down the answers, and is
            the one who calls when there is a job.
          </p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        {room.map((name, i) => {
          const npc = findNpc(name);
          const art = npc ? npcArtwork(npc) : null;
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
