import type { ReactNode } from "react";

/**
 * The current moment gets the page; earlier events remain available on demand.
 * The collapsed bar sits above the whole scene (its picture, who is here and the
 * prose, passed as `lead`), the way history reads in a log, so opening it never
 * shoves the controls out from under the player's hand and the faces stay
 * directly over the prose they belong to.
 */
export function LifeSceneContent({
  narration,
  controls,
  history,
  lead,
}: {
  narration: ReactNode;
  controls?: ReactNode;
  history: ReactNode;
  lead?: ReactNode;
}) {
  return (
    <>
      {narration && history ? (
        <details className="rounded border border-border bg-card/20 p-3">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            Earlier adventure
          </summary>
          <div className="mt-3">{history}</div>
        </details>
      ) : null}
      {lead}
      {narration}
      {controls}
      {narration ? null : history}
    </>
  );
}
