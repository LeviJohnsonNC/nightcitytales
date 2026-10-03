import type { ReactNode } from "react";

/** The current moment gets the page; earlier events remain available on demand. */
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
      {narration}
      {controls}
      {narration && history ? (
        <details className="rounded border border-border bg-card/20 p-3">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            Earlier adventure
          </summary>
          <div className="mt-3">{history}</div>
        </details>
      ) : (
        history
      )}
    </>
  );
}
