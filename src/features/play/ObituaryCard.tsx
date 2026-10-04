/**
 * How a run ends: the file, stamped closed.
 *
 * Replaces the bordered box that said "You died in Night City" and a link. The
 * words are `obituary.ts`'s — every line a fact from the ledger, none written by
 * the model — and this only lays them out: a heart monitor that draws a few
 * beats and then stops, the picture draining of colour, the stamp, and the two
 * receipts (the hit, the save) set down the way a till would print them.
 *
 * It says what happened and nothing about what comes next: what follows a death
 * is open in PRODUCT.md, and this screen does not pre-empt it.
 */
import { useMemo, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { usePortraitUrl } from "@/features/chargen/usePortraitUrl";
import {
  obituary,
  type Mourner,
  type ObituaryTone,
  type Receipt,
} from "@/features/campaign/obituary";
import { THEN_AND_NOW_EVENTS, thenAndNow } from "@/features/campaign/thenAndNow";
import { listCampaignEventsOfTypes } from "@/lib/backend";
import { RapSheetButton } from "@/features/rapsheet/RapSheetButton";
import { sourceFromCampaign } from "@/features/rapsheet/rapSheetModel";
import type { PlayBundle } from "./playOps";
import "./obituary.css";

const TONE: Record<ObituaryTone, string> = {
  good: "text-neon-cyan",
  bad: "text-destructive",
  neutral: "text-muted-foreground",
};

/** Staggers a line in after the monitor has gone flat. */
const after = (seconds: number) => ({ "--d": `${seconds}s` }) as React.CSSProperties;

function Heading({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
      {children}
    </p>
  );
}

/** A heart monitor: three beats, each weaker, and then the line that does not move. */
function Monitor() {
  return (
    <svg
      className="obit-ecg block h-12 w-full"
      viewBox="0 0 600 48"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        pathLength={1}
        d="M0 24 H46 l6 -3 l6 3 H92 l5 7 l8 -26 l8 40 l7 -22 H160 l5 -3 l5 3 H198 l4 6 l6 -20 l6 28 l5 -14 H250 l4 -2 l4 2 H286 l3 4 l5 -10 l4 12 l3 -6 H330 H600"
      />
      <circle className="obit-ecg-dot" cx="597" cy="24" r="2.4" />
    </svg>
  );
}

function ReceiptCard({ receipt, delay }: { receipt: Receipt; delay: number }) {
  return (
    <div className="obit-receipt obit-rise space-y-2 p-3" style={after(delay)}>
      <Heading>{receipt.title}</Heading>
      {receipt.trace && (
        <p className="break-words font-mono text-[11px] leading-relaxed text-foreground/80">
          {receipt.trace}
        </p>
      )}
      {receipt.rows.length > 0 && (
        <dl className="space-y-0.5 border-t border-dashed border-white/15 pt-2">
          {receipt.rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-3 text-xs">
              <dt className="whitespace-nowrap text-muted-foreground">{r.label}</dt>
              <dd className="num min-w-0 break-words text-right font-semibold">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function MournerRow({ mourner }: { mourner: Mourner }) {
  return (
    <li className="flex items-baseline justify-between gap-3 text-sm">
      <span>
        <span className="font-semibold">{mourner.name}</span>{" "}
        <span className="text-xs text-muted-foreground">{mourner.relation}</span>
      </span>
      <span
        className={`shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] ${TONE[mourner.tone]}`}
      >
        {mourner.feeling}
      </span>
    </li>
  );
}

/** Day one beside the day it ended, read only when somebody opens it. */
function HowFar({ bundle }: { bundle: PlayBundle }) {
  const campaignId = bundle.campaign.id;
  const events = useQuery({
    queryKey: ["then-and-now", campaignId, "obituary"],
    queryFn: () => listCampaignEventsOfTypes(campaignId, THEN_AND_NOW_EVENTS),
  });
  if (!events.data) return null;
  const sections = thenAndNow({
    day: bundle.campaign.day,
    character: bundle.character,
    vitals: bundle.vitals,
    inventory: bundle.inventory,
    cyberware: bundle.cyberware,
    npcs: bundle.npcs,
    standings: bundle.factionStandings,
    events: events.data,
  });
  if (sections.length === 0) return null;
  return (
    <details className="obit-rise group" style={after(5.6)}>
      <summary className="cursor-pointer select-none font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground hover:text-foreground">
        How far they got · day 1 to day {bundle.campaign.day}
      </summary>
      <div className="mt-3 space-y-3">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="text-xs text-muted-foreground">{section.title}</p>
            <ul className="mt-1 space-y-0.5">
              {section.lines.map((line) => (
                <li
                  key={line.text}
                  className={`text-sm ${line.tone === "neutral" ? "" : TONE[line.tone]}`}
                >
                  {line.text}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

export function ObituaryCard({ bundle }: { bundle: PlayBundle }) {
  const { character, campaign, vitals } = bundle;
  const portrait = usePortraitUrl(character.character.portrait_path);
  const o = useMemo(
    () =>
      obituary({
        name: character.character.name,
        roleId: character.character.role ?? null,
        day: campaign.day,
        minute: campaign.minute,
        locationKey: campaign.location_key,
        // Died with a job in hand: the one the mission graph still had open.
        unfinishedJob:
          bundle.mission && bundle.runtime && bundle.runtime.status !== "completed"
            ? bundle.mission.title
            : null,
        tally: bundle.tally,
        reputation: bundle.reputation,
        eurobucks: vitals.eurobucks,
        events: bundle.events,
        npcs: bundle.npcs,
        standings: bundle.factionStandings,
      }),
    [bundle, character, campaign, vitals],
  );
  const receipts = [o.lastBlow, o.finalSave, o.lastShot].filter((r): r is Receipt => r !== null);

  return (
    <section
      className="obit border border-destructive/60"
      aria-label={`${o.name}, flatlined`}
      data-testid="obituary"
    >
      <div className="px-4 pt-4">
        <Monitor />
      </div>

      <div className="grid gap-5 p-4 pt-2 sm:grid-cols-[9rem_1fr]">
        <div className="relative mx-auto w-36 sm:mx-0">
          {portrait ? (
            <img
              src={portrait}
              alt=""
              className="obit-portrait aspect-[4/5] w-full border border-white/20 object-cover"
            />
          ) : (
            <div className="obit-portrait grid aspect-[4/5] w-full place-items-center border border-white/20 bg-white/5 font-display text-4xl font-bold text-muted-foreground">
              {o.name.slice(0, 1)}
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <p
              className="obit-stamp border-2 border-destructive bg-black/70 px-2 py-1 font-mono text-sm font-bold uppercase tracking-[0.3em] text-destructive"
              style={{ fontFamily: "Silkscreen, var(--font-mono)" }}
            >
              Flatlined
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="obit-rise space-y-1" style={after(0.3)}>
            <Heading>The file is closed</Heading>
            <h2 className="font-display text-3xl font-extrabold leading-none tracking-tight">
              {o.name}
            </h2>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {[o.role, o.when, o.where].filter(Boolean).join(" · ")}
            </p>
          </div>

          <p className="obit-rise text-lg leading-snug" style={after(3.5)}>
            {o.epitaph}
          </p>

          {o.record.length > 0 && (
            <ul className="obit-rise space-y-0.5" style={after(3.9)}>
              {o.record.map((line) => (
                <li key={line.text} className={`text-sm ${TONE[line.tone]}`}>
                  {line.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {receipts.length > 0 && (
        <div className="grid gap-3 px-4 pb-4 lg:grid-cols-3">
          {receipts.map((r, i) => (
            <ReceiptCard key={r.title} receipt={r} delay={4.3 + i * 0.35} />
          ))}
        </div>
      )}

      <div className="space-y-4 px-4 pb-4">
        {o.lastWords && (
          <blockquote
            className="obit-rise border-l-2 border-destructive/60 pl-3"
            style={after(5.2)}
          >
            <Heading>The last thing you did</Heading>
            <p className="mt-1 text-sm italic">&ldquo;{o.lastWords}&rdquo;</p>
          </blockquote>
        )}

        {o.mourners.length > 0 && (
          <div className="obit-rise space-y-1.5" style={after(5.4)}>
            <Heading>Who is left</Heading>
            <ul className="space-y-1">
              {o.mourners.map((m) => (
                <MournerRow key={`${m.name}-${m.relation}`} mourner={m} />
              ))}
            </ul>
          </div>
        )}

        <HowFar bundle={bundle} />
      </div>

      <div
        className="obit-rise flex flex-wrap gap-2 border-t border-white/10 p-4"
        style={after(5.8)}
      >
        <Button asChild variant="outline" size="sm">
          <Link to="/roster">Back to the roster</Link>
        </Button>
        <RapSheetButton
          variant="ghost"
          size="sm"
          label="Save the card"
          source={sourceFromCampaign({
            character,
            campaign,
            chrome: bundle.cyberware,
            npcs: bundle.npcs,
            standings: bundle.factionStandings,
            tally: bundle.tally,
            reputation: bundle.reputation,
            dead: true,
          })}
        />
        <Button asChild variant="ghost" size="sm">
          <Link to="/create">Start a new file</Link>
        </Button>
      </div>
    </section>
  );
}
