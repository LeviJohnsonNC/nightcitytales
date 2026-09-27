import { castCandidates, type CastRole } from "@/engine";
import { findNpc, npcArtwork } from "@/features/cast/npcDirectory";
import { cn } from "@/lib/utils";
import { castForState, tiesForState } from "./revealModel";
import { useChargenStore, type ChargenState } from "./store";
import "./interview.css";

/** The three people a Lifepath puts in a character's life, and how to say each. */
const SLOTS: { role: CastRole; label: string; empty: string }[] = [
  {
    role: "enemy",
    label: "Wants you dead",
    empty: "Your Lifepath rolled no enemies. Everybody has one. You just have not met yours.",
  },
  {
    role: "friend",
    label: "Has your back",
    empty: "Your Lifepath rolled no friends. Somebody still picks up when you call.",
  },
  {
    role: "old_flame",
    label: "Still thinks about you",
    empty: "Your Lifepath rolled no tragic love. There is still somebody you think about.",
  },
];

/** The first sentence of somebody's bio: enough to choose on, not enough to spoil them. */
function firstSentence(bio: string | null | undefined): string {
  if (!bio) return "";
  const match = /^.*?[.!?](\s|$)/.exec(bio.trim());
  return (match ? match[0] : bio).trim();
}

/**
 * Meeting the people the Lifepath rolled.
 *
 * The Lifepath says you have an enemy, a friend, a love that ended badly. The
 * campaign has a person for each, and until now the player met them in play.
 * Here they are put in front of the player at the moment the dice make them
 * real: two or three people whose bio fits what was rolled (`castCandidates`),
 * one of whom is the dice's own choice. Pick one, or leave it to the dice.
 *
 * The pick rides the cast plan into the campaign. It only stands while it
 * still fits: change the enemy's "who" afterwards and a pick that no longer
 * fits gives way to the dice, which this screen shows by lighting whoever the
 * cast actually holds rather than whoever was clicked.
 */
export function PeoplePicker({ state }: { state: ChargenState }) {
  const patch = useChargenStore((s) => s.patch);
  const plan = state.castPlan;
  if (!plan) {
    return (
      <p className="border border-dashed border-hairline p-4 text-sm text-text-dim">
        Meet your fixer first. The people in your life are dealt from the same file.
      </p>
    );
  }
  const ties = tiesForState(state);
  const cast = castForState(state);

  function choose(role: CastRole, name: string | null) {
    if (!plan) return;
    const picks = { ...plan.picks };
    if (name) picks[role] = name;
    else delete picks[role];
    patch({ castPlan: { ...plan, picks } });
  }

  return (
    <section className="space-y-5">
      <div>
        <h3 className="text-lg font-bold tracking-tight">The people in your life</h3>
        <p className="text-sm text-text-muted">
          These are real people in the city, and they will be there when you arrive. Pick who they
          are, or let the dice decide.
        </p>
      </div>
      {SLOTS.map(({ role, label, empty }) => {
        const holder = cast.find((m) => m.role === role);
        const { drawn, candidates } = castCandidates({ seed: plan.seed, ties, role });
        const picked = plan.picks[role];
        const byDice = !picked || holder?.name !== picked;
        return (
          <div key={role} className="space-y-2">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
                {label}
              </p>
              <p className="text-sm text-text-muted">{holder?.tie ?? empty}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {candidates.map((name) => {
                const npc = findNpc(name);
                const art = npc ? npcArtwork(npc) : null;
                const selected = holder?.name === name;
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => choose(role, name)}
                    className={cn(
                      "cg-arrive flex overflow-hidden border text-left transition-colors",
                      selected
                        ? "border-ember bg-ember/10"
                        : "border-hairline bg-surface hover:border-accent/60",
                    )}
                  >
                    {art && (
                      <img
                        src={art.srcSet.split(" ")[0]}
                        alt={name}
                        className="h-28 w-24 shrink-0 object-cover object-top"
                      />
                    )}
                    <span className="min-w-0 space-y-1 p-3">
                      <span className="block text-sm font-bold leading-tight">{name}</span>
                      <span className="line-clamp-3 block text-xs leading-snug text-text-muted">
                        {firstSentence(npc?.bio)}
                      </span>
                      {selected && (
                        <span className="block font-mono text-[9px] uppercase tracking-[0.18em] text-ember">
                          {byDice && name === drawn ? "The dice chose" : "Your choice"}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            {candidates.length === 1 && (
              <p className="text-xs text-text-dim">
                Only one person in the city fits what your Lifepath says.
              </p>
            )}
            {picked && !byDice && candidates.length > 1 && (
              <button
                type="button"
                onClick={() => choose(role, null)}
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-dim hover:text-text"
              >
                Let the dice decide instead
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}
