import type { ReactNode } from "react";

/** The present turn in reading order. The Journal owns the campaign history. */
export function LifeSceneContent({
  lead,
  narration,
  outcome,
  controls,
}: {
  lead: ReactNode;
  narration: ReactNode;
  outcome?: ReactNode;
  controls?: ReactNode;
}) {
  return (
    <section className="life-scene" aria-label="Current scene">
      {lead}
      {narration}
      {outcome}
      {controls}
    </section>
  );
}
