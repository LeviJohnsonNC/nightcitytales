/**
 * What the world remembers about you.
 *
 * The same lines the model is given as long-run memory, shown to the player.
 * The engine's memory of a campaign should be legible to the person playing it,
 * not only to the prompt — and since the chronicle is assembled rather than
 * written, what you read here is exactly what the GM is working from.
 */
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { getFaction, isFactionId, standingBand } from "@/engine";
import { chronicleFor } from "@/features/campaign/chronicleModel";
import { pressureLines } from "@/features/campaign/pressure";
import type { LifeBundle } from "./useLife";

function Row({ label, value, tone }: { label: string; value: string; tone?: "bad" | "good" }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 text-sm">
      <span className="truncate">{label}</span>
      <span
        className={`num shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] ${
          tone === "bad"
            ? "text-destructive"
            : tone === "good"
              ? "text-accent"
              : "text-muted-foreground"
        }`}
      >
        {value}
      </span>
    </li>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </p>
      <ul className="mt-1.5 space-y-1">{children}</ul>
    </section>
  );
}

export function RecordSheet({ bundle }: { bundle: LifeBundle }) {
  const lines = chronicleFor({
    day: bundle.clock.day,
    events: bundle.events,
    standings: bundle.standings,
    pressure: pressureLines(bundle.pressure),
    npcs: bundle.npcs,
    situationKeys: bundle.situations.map((s) => s.key),
    tally: bundle.tally,
  });

  const people = bundle.npcs.filter((n) => n.status !== "dead");
  const opinions = bundle.standings.filter((s) => s.standing !== 0 && isFactionId(s.factionId));
  const clocks = bundle.pressure.filter((p) => !p.clock.hidden && p.clock.filled > 0);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          The record
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle>The record · day {bundle.clock.day}</SheetTitle>
        </SheetHeader>

        {lines.length > 0 && (
          <div className="mt-4 border-l-2 border-accent bg-accent/5 py-2 pl-3">
            {lines.map((line) => (
              <p key={line} className="text-sm leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        )}

        <div className="mt-5 space-y-5">
          {people.length > 0 && (
            <Section title="People">
              {people.map((npc) => (
                <Row
                  key={npc.id}
                  label={npc.name}
                  value={npc.disposition > 0 ? `+${npc.disposition}` : `${npc.disposition}`}
                  {...(npc.disposition <= -2
                    ? { tone: "bad" as const }
                    : npc.disposition >= 2
                      ? { tone: "good" as const }
                      : {})}
                />
              ))}
            </Section>
          )}

          {opinions.length > 0 && (
            <Section title="Who has an opinion">
              {opinions.map((s) => (
                <Row
                  key={s.factionId}
                  label={getFaction(s.factionId).name}
                  value={`${standingBand(s.standing).label} (${s.standing})`}
                  {...(s.standing < 0 ? { tone: "bad" as const } : { tone: "good" as const })}
                />
              ))}
            </Section>
          )}

          {clocks.length > 0 && (
            <Section title="Pressure">
              {clocks.map((p) => (
                <Row
                  key={p.clock.key}
                  label={p.clock.label}
                  value={`${p.clock.filled}/${p.clock.segments}`}
                  tone="bad"
                />
              ))}
            </Section>
          )}

          {lines.length === 0 && people.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing has happened yet. Night City has no opinion of you.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
