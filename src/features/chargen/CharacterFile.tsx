import rolesData from "@/data/rules/roles.json";
import { fixerShortName } from "./interview";
import { sentenceFor } from "./lifepathNarrative";
import { readGeneralLifepath } from "./lifepathState";
import type { ChargenState } from "./store";
import { usePortraitUrl } from "./usePortraitUrl";
import { PORTRAIT_STAGES, firstPictureNeeds, type PortraitStage } from "./portraitStages";
import type { DevelopingPortrait } from "./useDevelopingPortrait";
import { cn } from "@/lib/utils";
import "./interview.css";

const ROLE_NAMES = rolesData.roles as unknown as Record<string, { name: string }>;

/** The answers that say most about somebody at a glance, in the order a file would list them. */
const AT_A_GLANCE = ["personality", "value_most", "life_goals"] as const;

/** How each stage of the picture is shown: a grainy still, then better light, then clean. */
const STAGE_LOOK: Record<PortraitStage, string> = {
  1: "grayscale contrast-125 brightness-90 blur-[0.6px]",
  2: "saturate-[0.55] contrast-110",
  3: "",
};

/**
 * The file the fixer is keeping on you, filling in as you answer.
 *
 * Replaces the top of the step rail as the thing that tells a player how far
 * they have come. A list of eleven steps with "in progress" beside them is
 * progress through a form; a face arriving, a handle being typed, a Role and a
 * few lines of who this person is — that is progress toward somebody you want
 * to play.
 */
export function CharacterFile({
  state,
  developing,
}: {
  state: ChargenState;
  developing?: DevelopingPortrait;
}) {
  const stored = usePortraitUrl(state.portraitPath);
  const inFlight = developing?.developing ?? null;
  const portrait = (inFlight && developing?.preview) || stored;
  const stage = Math.min(3, Math.max(1, inFlight ?? state.portraitStage)) as PortraitStage;
  const needs = firstPictureNeeds(state);
  const fixer = state.castPlan?.picks.fixer ?? null;
  const role = state.roleId ? ROLE_NAMES[state.roleId]?.name : null;
  const handle = state.handle.trim();
  const name = state.name.trim();
  const entries = readGeneralLifepath(state.lifepath.general).entries;
  const glance = AT_A_GLANCE.map((id) => entries[id])
    .filter((entry) => entry !== undefined)
    .map((entry) => sentenceFor(entry));

  return (
    <section aria-label="Your file" className="border border-hairline bg-surface">
      <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent">File</span>
        {fixer && (
          <span className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-text-dim">
            Kept by {fixerShortName(fixer)}
          </span>
        )}
      </div>

      <div className="relative aspect-[4/5] w-full overflow-hidden bg-background/60">
        {portrait ? (
          <>
            <img
              src={portrait}
              alt={handle || name || "Your portrait"}
              className={cn(
                "h-full w-full object-cover transition-[filter] duration-1000",
                STAGE_LOOK[stage],
              )}
            />
            {stage === 1 && <div aria-hidden className="cg-still absolute inset-0" />}
          </>
        ) : (
          <Silhouette />
        )}
        {inFlight && (
          <p className="cg-breathe absolute inset-x-0 bottom-0 bg-background/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
            Developing · {PORTRAIT_STAGES[inFlight].name}
          </p>
        )}
      </div>
      <div className="border-b border-hairline px-3 py-2 text-[11px] leading-snug text-text-dim">
        {inFlight ? (
          PORTRAIT_STAGES[inFlight].caption
        ) : developing?.failed ? (
          <button type="button" onClick={developing.retry} className="hover:text-text">
            The picture did not come out. Try again.
          </button>
        ) : state.portraitPath && state.portraitStage > 0 ? (
          `${PORTRAIT_STAGES[Math.min(3, state.portraitStage) as PortraitStage].name}. ${PORTRAIT_STAGES[Math.min(3, state.portraitStage) as PortraitStage].caption}`
        ) : needs.length > 0 ? (
          `A picture develops once the file has ${needs.join(", ")}.`
        ) : (
          "A picture is on its way."
        )}
      </div>

      <div className="space-y-2 p-3">
        <div>
          <p
            key={handle}
            className="cg-glitch truncate font-display text-lg font-bold uppercase tracking-[0.08em]"
          >
            {handle ? `"${handle}"` : "Unknown"}
          </p>
          <p className="truncate text-sm text-text-muted">
            {[name, role].filter(Boolean).join(" · ") || "No name on file yet"}
          </p>
        </div>
        {glance.length > 0 && (
          <ul className="space-y-1 border-t border-hairline pt-2 text-[13px] leading-snug text-text-muted">
            {glance.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Nobody has taken a picture yet. A shape, and a note saying so. */
function Silhouette() {
  return (
    <div className="flex h-full flex-col items-center justify-end">
      <svg viewBox="0 0 100 110" aria-hidden className="h-4/5 w-4/5 text-hairline">
        <circle cx="50" cy="38" r="20" fill="currentColor" />
        <path d="M10 110c2-26 19-40 40-40s38 14 40 40z" fill="currentColor" />
      </svg>
      <p className="absolute top-3 font-mono text-[10px] uppercase tracking-[0.25em] text-text-dim">
        No photo on file
      </p>
    </div>
  );
}
