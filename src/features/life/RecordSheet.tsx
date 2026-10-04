/**
 * What the world remembers about you.
 *
 * The same lines the model is given as long-run memory, shown to the player.
 * The engine's memory of a campaign should be legible to the person playing it,
 * not only to the prompt — and since the chronicle is assembled rather than
 * written, what you read here is exactly what the GM is working from.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NpcName } from "@/features/cast/NpcName";
import { THEN_AND_NOW_EVENTS, thenAndNow, type ClimbSection } from "@/features/campaign/thenAndNow";
import { listCampaignEventsOfTypes } from "@/lib/backend";
import { DockTile } from "./hud/DockTile";
import { ScrollText } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { getFaction, isFactionId, standingBand } from "@/engine";
import { chronicleFor } from "@/features/campaign/chronicleModel";
import { pressureLines } from "@/features/campaign/pressure";
import type { LifeBundle } from "./lifeOps";
import { ClimbPanel } from "./ClimbPanel";
import { RapSheetButton } from "@/features/rapsheet/RapSheetButton";
import { sourceFromCampaign } from "@/features/rapsheet/rapSheetModel";

function Row({
  label,
  value,
  tone,
}: {
  label: React.ReactNode;
  value: string;
  tone?: "bad" | "good";
}) {
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

const CLIMB_TONE: Record<ClimbSection["lines"][number]["tone"], string> = {
  good: "text-accent",
  bad: "text-destructive",
  neutral: "text-muted-foreground",
};

/**
 * Day one beside today, from `thenAndNow`. Losses sit with gains; a climb that
 * only goes up is a score. Read only when the sheet is open, because it needs
 * the whole campaign's raises and awards rather than a turn's window.
 */
function ThenAndNow({ bundle, open }: { bundle: LifeBundle; open: boolean }) {
  const campaignId = bundle.campaign.id;
  const events = useQuery({
    queryKey: ["then-and-now", campaignId, bundle.events.at(-1)?.seq ?? 0],
    queryFn: () => listCampaignEventsOfTypes(campaignId, THEN_AND_NOW_EVENTS),
    enabled: open,
  });
  if (!events.data) return null;
  const sections = thenAndNow({
    day: bundle.clock.day,
    character: bundle.character,
    vitals: bundle.vitals,
    inventory: bundle.inventory,
    cyberware: bundle.cyberware,
    npcs: bundle.npcs,
    standings: bundle.standings,
    events: events.data,
  });
  return (
    <section className="border border-hairline p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Then and now · day 1 to day {bundle.clock.day}
      </p>
      {sections.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          The same person who walked in on day one. Give it time.
        </p>
      ) : (
        <div className="mt-2 space-y-3">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="text-xs text-muted-foreground">{section.title}</p>
              <ul className="mt-1 space-y-0.5">
                {section.lines.map((line) => (
                  <li key={line.text} className={`text-sm ${CLIMB_TONE[line.tone]}`}>
                    {line.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
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
  const [open, setOpen] = useState(false);
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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <DockTile icon={<ScrollText className="size-6" />} label="Record" />
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle>The record · day {bundle.clock.day}</SheetTitle>
        </SheetHeader>

        {/* Your file as a card: made here, from this campaign, posted only if you choose. */}
        <div className="mt-3">
          <RapSheetButton
            size="sm"
            label="Your rap sheet"
            source={sourceFromCampaign({
              character: bundle.character,
              campaign: bundle.campaign,
              chrome: bundle.cyberware,
              npcs: bundle.npcs,
              standings: bundle.standings,
              tally: bundle.tally,
              reputation: bundle.climb.reputation,
              dead: false,
            })}
          />
        </div>

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
          <ClimbPanel bundle={bundle} />
          <ThenAndNow bundle={bundle} open={open} />

          {people.length > 0 && (
            <Section title="People">
              {people.map((npc) => (
                <Row
                  key={npc.id}
                  label={<NpcName name={npc.name} />}
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
