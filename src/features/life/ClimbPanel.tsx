/**
 * Who has heard of you, and the work that brings.
 *
 * Reputation is the printed ladder (p.193), earned from what settled jobs left
 * behind (`engine/reputation.ts`); the tier is the work a crew of that standing
 * is offered. Neither is bought, so neither is pinnable: this says where the
 * character stands and what moves it.
 */
import type { LifeBundle } from "./lifeOps";

export function ClimbPanel({ bundle }: { bundle: LifeBundle }) {
  const { reputation, tier } = bundle.climb;
  const jobs = bundle.tally.jobsFinished;
  const next = tier.next;
  return (
    <section className="space-y-1.5 border border-hairline p-3 text-sm">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Reputation and work
      </p>
      <p>
        <span className="num font-bold">Reputation {reputation.level}</span>
        <span className="text-muted-foreground">
          {" · "}
          {reputation.whoKnows ?? "Nobody has heard of you yet."}
        </span>
      </p>
      <p>
        Fixers offer you <span className="font-bold">{tier.tier.name.toLowerCase()}</span>.
        {tier.heldBack && (
          <span className="text-destructive"> Your fixer has gone cold, and it shows.</span>
        )}
      </p>
      {next && (
        <p className="text-xs text-muted-foreground">
          {next.name} at Reputation {next.minReputation} and {next.minJobsFinished} jobs done (you
          have {reputation.level} and {jobs}).
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        A job people saw, heard or paid well for raises it. A clean one keeps your name out of the
        story, and off the pressure.
      </p>
    </section>
  );
}
