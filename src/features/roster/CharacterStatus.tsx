import { cn } from "@/lib/utils";

/**
 * One line of persistent-world context under the vitals.
 *
 * Deliberately data-driven and additive: today the only fact the roster read
 * carries is whether a playthrough is live, so that is all this renders. When
 * location, in-world clock or job state reach the roster query, pass them in
 * as `facts` — no backend behaviour is invented here.
 */
export function CharacterStatus({
  live,
  facts,
  className,
}: {
  live: boolean;
  facts?: (string | null | undefined)[];
  className?: string;
}) {
  const items = [live ? "Adventure in progress" : "No active job", ...(facts ?? [])].filter(
    (f): f is string => Boolean(f),
  );

  return (
    <p
      className={cn(
        "flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em]",
        live ? "text-cool" : "text-text-dim",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block h-1.5 w-1.5 shrink-0",
          live ? "bg-cool shadow-[0_0_8px_var(--color-neon-cyan)]" : "bg-text-dim/60",
        )}
      />
      <span className="truncate">{items.join(" · ")}</span>
    </p>
  );
}
