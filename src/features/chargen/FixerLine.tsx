import { findNpc, npcArtwork } from "@/features/cast/npcDirectory";
import { fixerSays } from "./interview";
import type { ChargenStep } from "./steps";
import "./interview.css";

/**
 * The fixer, asking this step's question.
 *
 * Sits where the step title used to be the loudest thing on the page. The
 * title is still there, small, because a player coming back to a half-built
 * character wants to know where they are; but what the page is FOR is now
 * somebody across the table waiting for an answer.
 *
 * Re-keyed on the line, so a new question — or the reaction that replaces the
 * Role question once a Role is picked — arrives rather than just appearing.
 */
export function FixerLine({
  fixer,
  step,
  roleId,
  lead,
}: {
  fixer: string | null | undefined;
  step: ChargenStep;
  roleId: string | null;
  /** A line said first — the reaction to the answer the player just gave. */
  lead?: string | null;
}) {
  const line = fixerSays(fixer, step, roleId);
  if (!fixer || !line) return null;
  const npc = findNpc(fixer);
  const art = npc ? npcArtwork(npc) : null;
  return (
    <div className="flex items-start gap-4">
      {art && (
        <img
          src={art.srcSet.split(" ")[0]}
          alt={fixer}
          className="h-16 w-16 shrink-0 border border-hairline object-cover object-top sm:h-20 sm:w-20"
        />
      )}
      <div className="min-w-0 space-y-1">
        {lead && (
          <p key={lead} className="cg-say text-base leading-snug text-text-muted sm:text-lg">
            “{lead}”
          </p>
        )}
        <p key={line} className="cg-say text-xl leading-snug tracking-tight sm:text-2xl">
          “{line}”
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">{fixer}</p>
      </div>
    </div>
  );
}
