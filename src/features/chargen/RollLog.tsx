import { useState } from "react";
import { Button } from "@/components/ui/button";
import { clearRollLog, useRollEntries } from "./rollLogStore";

/** Expandable, auditable list of every roll this session. */
export function RollLog() {
  const entries = useRollEntries();
  const [open, setOpen] = useState(false);

  return (
    <section className="border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between p-3 text-left"
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Roll log — {entries.length} {entries.length === 1 ? "roll" : "rolls"} so far
        </span>
        <span className="font-mono text-[11px] text-accent">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="border-t border-border">
          {entries.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              Nothing rolled yet. Every die this app rolls lands here, with its arithmetic.
            </p>
          ) : (
            <>
              <ul className="max-h-72 divide-y divide-border overflow-y-auto">
                {entries.map((entry) => (
                  <li key={entry.id} className="p-3">
                    <p className="font-mono text-[11px] uppercase tracking-wider text-accent">
                      {entry.label}
                    </p>
                    <p className="num mt-1 font-mono text-sm text-foreground">
                      {entry.result.formula}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {entry.result.timestamp}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="border-t border-border p-3">
                <Button variant="outline" size="sm" onClick={clearRollLog}>
                  Clear log
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
