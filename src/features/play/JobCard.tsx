/**
 * The job briefing: who hired the Edgerunner, what they're being paid, and what
 * this beat is about. Everything here comes straight from the authored mission
 * data — no invented rules or facts.
 */
import { useState } from "react";
import type { Beat, Mission } from "@/engine";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </p>
  );
}

export function JobCard({ mission, beat }: { mission: Mission; beat: Beat }) {
  const [open, setOpen] = useState(true);
  const reward = mission.reward;
  return (
    <section className="border border-border bg-card p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-baseline justify-between gap-2 text-left"
      >
        <span>
          <Label>The Job</Label>
          <span className="block text-base font-bold">{mission.title}</span>
        </span>
        <span className="font-mono text-xs text-muted-foreground">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3 text-sm">
          {mission.subtitle && <p className="italic text-muted-foreground">{mission.subtitle}</p>}
          {mission.patron && (
            <div>
              <Label>Patron</Label>
              <p className="text-muted-foreground">{mission.patron}</p>
            </div>
          )}
          {reward && (
            <div>
              <Label>Pay</Label>
              <p className="text-muted-foreground">
                <span className="num font-semibold text-foreground">
                  {reward.eurobucksPerHead}eb
                </span>{" "}
                per head
                {reward.upfront !== undefined ? ` · ${reward.upfront}eb up front` : ""}
              </p>
              {reward.notes && <p className="mt-1 text-xs text-muted-foreground">{reward.notes}</p>}
            </div>
          )}
          {known && (
            <div>
              <Label>What you know</Label>
              <p className="text-muted-foreground">{known}</p>
            </div>
          )}

          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
            {mission.source}
          </p>
        </div>
      )}
    </section>
  );
}
