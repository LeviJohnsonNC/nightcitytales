import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRollEntries } from "./rollLogStore";

/**
 * Every die this character was built with, oldest last. This is the trust
 * artifact: a player can check that the row they rolled is the row they kept.
 */
export function BuildLog() {
  const entries = useRollEntries();
  const [open, setOpen] = useState(false);

  return (
    <section className="border border-hairline bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-baseline justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="font-display text-[13px] font-bold uppercase tracking-[0.18em] text-text">
          Build log — {entries.length} {entries.length === 1 ? "roll" : "rolls"}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ember">
          {open ? "Hide" : "Show every roll"}
        </span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-hairline px-4 py-3">
          {entries.length === 0 ? (
            <p className="text-sm italic text-text-dim">
              No dice were rolled for this character.
            </p>
          ) : (
            <ol className="space-y-2">
              {[...entries].reverse().map((entry, i) => (
                <li key={entry.id} className="border-b border-hairline/60 pb-2 last:border-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-dim">
                    {String(i + 1).padStart(2, "0")} · {entry.label} ·{" "}
                    {new Date(entry.result.timestamp).toLocaleString()}
                  </p>
                  <p className="num text-sm text-text">{entry.result.formula}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}

export function PrintButton() {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      Print sheet
    </Button>
  );
}
