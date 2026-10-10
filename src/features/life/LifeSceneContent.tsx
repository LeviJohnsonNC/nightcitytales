import type { ReactNode } from "react";

/**
 * The current moment gets the page; earlier events remain available on demand.
 * The collapsed bar sits above the scene, the way history reads in a log, so
 * opening it never shoves the controls out from under the player's hand.
 */
export function LifeSceneContent({
  narration,
  controls,
  history,
}: {
  narration: ReactNode;
  controls?: ReactNode;
  history: ReactNode;
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
      {narration}
      {controls}
      {narration ? null : history}
    </>
  );
}
