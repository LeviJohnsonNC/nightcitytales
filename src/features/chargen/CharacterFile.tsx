import rolesData from "@/data/rules/roles.json";
import { fixerShortName } from "./interview";
import { sentenceFor } from "./lifepathNarrative";
import { readGeneralLifepath } from "./lifepathState";
import type { ChargenState } from "./store";
import { usePortraitUrl } from "./usePortraitUrl";
import "./interview.css";

const ROLE_NAMES = rolesData.roles as unknown as Record<string, { name: string }>;

/** The answers that say most about somebody at a glance, in the order a file would list them. */
const AT_A_GLANCE = ["personality", "value_most", "life_goals"] as const;

/**
 * The file the fixer is keeping on you, filling in as you answer.
 *
 * Replaces the top of the step rail as the thing that tells a player how far
 * they have come. A list of eleven steps with "in progress" beside them is
 * progress through a form; a face arriving, a handle being typed, a Role and a
 * few lines of who this person is — that is progress toward somebody you want
 * to play.
 */
export function CharacterFile({ state }: { state: ChargenState }) {
  const portrait = usePortraitUrl(state.portraitPath);
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
          <img
            src={portrait}
            alt={handle || name || "Your portrait"}
            className="h-full w-full object-cover"
          />
        ) : (
          <Silhouette />
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
