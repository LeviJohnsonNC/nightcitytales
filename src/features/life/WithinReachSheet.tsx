/**
 * Within reach: what each currency buys next, how far away it is, and what the
 * player has chosen to aim at.
 *
 * Everything on it is priced by the engine (`reachList`, `goalProgress`) and
 * nothing is offered: it is a price list the player reads and pins from, never
 * a list of jobs to do. Up to three pins; the Growth chip follows the first, and
 * a pin coming within reach or arriving is a receipt under the log.
 *
 * It also carries the spend card, because a week of life now earns I.P. and the
 * only other places to spend it were Aftermath and the roster.
 */
import { useState } from "react";
import { Crosshair, Pin, PinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MAX_PINNED_GOALS, type GoalProgress } from "@/engine";
import { SpendIpCard } from "@/features/roster/SpendIpCard";
import { goalFill, goalGapLabel } from "@/features/status/goalsModel";
import { formatMoney } from "@/features/status/statusModel";
import { ClimbPanel } from "./ClimbPanel";
import { DockTile } from "./hud/DockTile";
import type { useLife } from "./useLife";

type Life = ReturnType<typeof useLife>;

/** How many chrome rows show before "show all": the next few, not the catalogue. */
const CHROME_SHOWN = 6;

const TONE: Record<GoalProgress["status"], string> = {
  ready: "text-accent",
  done: "text-accent",
  far: "text-muted-foreground",
  blocked: "text-destructive",
};

function GoalRow({ progress, life }: { progress: GoalProgress; life: Life }) {
  const pinned = life.isPinned(progress.goal);
  const full = life.pinned.length >= MAX_PINNED_GOALS;
  const fill = goalFill(progress);
  return (
    <li className="space-y-1 border-b border-border/50 py-2 last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{progress.label}</span>
          {progress.note && (
            <span className="block truncate font-mono text-[10px] text-muted-foreground">
              {progress.note}
            </span>
          )}
        </span>
        <span className={`num shrink-0 font-mono text-xs ${TONE[progress.status]}`}>
          {goalGapLabel(progress)}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 shrink-0"
          aria-label={pinned ? `Unpin ${progress.label}` : `Pin ${progress.label}`}
          title={
            pinned
              ? "Unpin"
              : full
                ? `Unpin something first: ${MAX_PINNED_GOALS} at most`
                : "Pin — the Growth chip follows your first pin"
          }
          disabled={life.pinsBusy || (!pinned && full)}
          onClick={() => (pinned ? life.unpin(progress.key) : life.pin(progress.goal))}
        >
          {pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
        </Button>
      </div>
      {fill !== null && progress.status === "far" && (
        <span className="block h-1 w-full bg-border" aria-hidden>
          <span
            className="block h-full bg-accent"
            style={{ width: `${Math.round(fill * 100)}%` }}
          />
        </span>
      )}
    </li>
  );
}

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {title}
        </p>
        {aside && <p className="num font-mono text-[10px] text-muted-foreground">{aside}</p>}
      </div>
      <ul className="mt-1">{children}</ul>
    </section>
  );
}

export function WithinReachSheet({
  life,
  open,
  onOpenChange,
  trigger = true,
}: {
  life: Life;
  /** False for a copy opened only from elsewhere, with no dock tile of its own. */
  trigger?: boolean;
  /** Controlled from outside when something else opens it (the day-one pointer). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [allChrome, setAllChrome] = useState(false);
  const bundle = life.bundle;
  const reach = life.reach;
  if (!bundle || !reach) return null;

  const ip = bundle.character.finance?.improvement_points ?? 0;
  const chrome = allChrome ? reach.chrome : reach.chrome.slice(0, CHROME_SHOWN);
  const ready = life.pinned.filter((p) => p.status === "ready").length;

  return (
    <Sheet {...(open !== undefined ? { open } : {})} {...(onOpenChange ? { onOpenChange } : {})}>
      {trigger && (
        <SheetTrigger asChild>
          <DockTile
            icon={<Crosshair className="size-6" />}
            label="Within reach"
            {...(ready > 0 ? { badge: "ready" } : {})}
          />
        </SheetTrigger>
      )}
      <SheetContent
        side="right"
        className="w-full overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle>Within reach</SheetTitle>
        </SheetHeader>
        <p className="mt-1 text-xs text-muted-foreground">
          What each thing you earn buys next, and how far away it is. Pin up to {MAX_PINNED_GOALS};
          the Growth chip follows the first.
        </p>

        <div className="mt-4 space-y-5">
          {life.pinned.length > 0 && (
            <Section title="Working toward">
              {life.pinned.map((progress) => (
                <GoalRow key={progress.key} progress={progress} life={life} />
              ))}
            </Section>
          )}

          <Section title="Improvement Points" aside={`${ip} IP banked`}>
            {reach.rank && <GoalRow progress={reach.rank} life={life} />}
            {reach.skills.map((progress) => (
              <GoalRow key={progress.key} progress={progress} life={life} />
            ))}
          </Section>

          <SpendIpCard
            character={bundle.character}
            improvementPoints={ip}
            campaignId={bundle.campaign.id}
          />

          {reach.chrome.length > 0 && (
            <Section title="Chrome" aside={`${formatMoney(bundle.vitals.eurobucks)} on hand`}>
              {chrome.map((progress) => (
                <GoalRow key={progress.key} progress={progress} life={life} />
              ))}
              {reach.chrome.length > CHROME_SHOWN && (
                <li className="pt-1">
                  <Button size="sm" variant="ghost" onClick={() => setAllChrome((v) => !v)}>
                    {allChrome ? "Show the next few" : `Show all ${reach.chrome.length}`}
                  </Button>
                </li>
              )}
            </Section>
          )}

          <ClimbPanel bundle={bundle} />

          {reach.standing.length > 0 && (
            <Section title="Standing">
              {reach.standing.map((progress) => (
                <GoalRow key={progress.key} progress={progress} life={life} />
              ))}
            </Section>
          )}

          {life.pinsError && <p className="text-sm text-destructive">{life.pinsError.message}</p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
