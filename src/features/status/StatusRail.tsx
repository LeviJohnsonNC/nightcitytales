/**
 * The status rail: money, growth, commitments.
 *
 * Three chips that answer "where do I stand" without opening a menu. Each one
 * shows a pressure rather than a score — what is coming, how far away it is,
 * what is still owed — and expands to the detail behind it on demand, which is
 * `PRODUCT.md`'s "default to concise, reveal on demand".
 *
 * Presentational only. Every number arrives already derived from statusModel.ts;
 * nothing here computes a price, a date or a count.
 */
import type { ReactNode } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import {
  dueLabel,
  type Commitment,
  type CommitmentsStatus,
  type GrowthStatus,
  type Lead,
  type MoneyStatus,
  type MoneyTone,
  type StatusView,
} from "./statusModel";

const TONE_CLASS: Record<MoneyTone, string> = {
  ok: "text-foreground",
  soon: "text-amber-500",
  due: "text-destructive",
};

function money(value: number): string {
  return `€$${value.toLocaleString()}`;
}

/** One chip: a label, the line that matters, and the detail behind it. */
function Chip({
  label,
  line,
  tone,
  children,
}: {
  label: string;
  line: string;
  tone?: string;
  children: ReactNode;
}) {
  return (
    <Collapsible className="border-b border-border/50 last:border-b-0">
      <CollapsibleTrigger className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left">
        <span className="min-w-0">
          <Label>{label}</Label>
          <span className={`num block truncate text-sm font-bold ${tone ?? "text-foreground"}`}>
            {line}
          </span>
        </span>
        <span aria-hidden className="shrink-0 font-mono text-[10px] text-muted-foreground">
          ▾
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function Row({ left, right }: { left: string; right: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="min-w-0 truncate text-muted-foreground">{left}</span>
      <span className="num shrink-0">{right}</span>
    </div>
  );
}

/** Where the money actually goes, once a month, whether or not the job pays. */
function MoneyDetail({ status }: { status: MoneyStatus }) {
  const { rates } = status;
  return (
    <div className="space-y-1">
      <Row left="On hand" right={money(status.eurobucks)} />
      {rates.granted ? (
        <Row left={`${rates.housingName} (Role ability)`} right="—" />
      ) : (
        <Row left={`Rent · ${rates.housingName}`} right={`${money(rates.rent)}/mo`} />
      )}
      <Row left={`Lifestyle · ${rates.lifestyleName}`} right={`${money(rates.lifestyleCost)}/mo`} />
      {status.owed > 0 ? (
        <Row left="Owed now" right={money(status.owed)} />
      ) : (
        <Row left="Next due" right={`day ${status.daysToNextBill} from now`} />
      )}
      {status.short > 0 && (
        <p className="pt-1 text-xs text-destructive">
          Short {money(status.short)} of what is coming.
        </p>
      )}
    </div>
  );
}

/** What the banked points are actually close to buying. */
function GrowthDetail({ status }: { status: GrowthStatus }) {
  if (!status.next) {
    return (
      <p className="text-xs text-muted-foreground">
        Every Skill is at the in-play ceiling. Points keep banking.
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <Row left="Banked" right={`${status.ip} IP`} />
      <Row
        left={`${status.next.skillName} ${status.next.currentLevel} → ${status.next.nextLevel}`}
        right={`${status.next.cost} IP`}
      />
      <Row left={status.ready ? "Ready to spend" : "Still needed"} right={`${status.gap} IP`} />
      <p className="pt-1 text-xs text-muted-foreground">
        Spend it in Downtime or on the character sheet.
      </p>
    </div>
  );
}

const KIND_MARK: Record<Commitment["kind"], string> = {
  job: "▣",
  need: "●",
  people: "◆",
  pressure: "▲",
  clock: "◱",
};

function Severity({ level }: { level: number }) {
  return (
    <span
      aria-label={`urgency ${level} of 5`}
      className="shrink-0 font-mono text-[10px] text-accent"
    >
      {"·".repeat(Math.max(0, 5 - level))}
      {"|".repeat(Math.max(0, level))}
    </span>
  );
}

function CommitmentRow({ item }: { item: Commitment }) {
  const due = dueLabel(item.dueInDays);
  const closed = item.status !== "active";
  return (
    <li className={`py-1.5 ${closed ? "opacity-50" : ""}`}>
      <div className="flex items-baseline gap-2">
        <span aria-hidden className="shrink-0 font-mono text-[10px] text-muted-foreground">
          {item.status === "done" ? "✓" : item.status === "failed" ? "✕" : KIND_MARK[item.kind]}
        </span>
        <span
          className={`min-w-0 flex-1 text-sm ${
            closed ? "line-through" : item.current ? "font-semibold text-accent" : "font-medium"
          }`}
        >
          {item.title}
        </span>
        {item.meter ? (
          <span className="num shrink-0 font-mono text-[10px] text-muted-foreground">
            {item.meter.filled}/{item.meter.segments}
          </span>
        ) : (
          !closed && <Severity level={item.severity} />
        )}
      </div>
      {item.meter && (
        <div className="mt-1 flex gap-1 pl-5" aria-hidden>
          {Array.from({ length: item.meter.segments }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 ${
                i < (item.meter?.filled ?? 0) ? "bg-destructive" : "bg-border"
              }`}
            />
          ))}
        </div>
      )}
      {(item.detail || due) && (
        <p className="pl-5 text-xs text-muted-foreground">
          {due && (
            <span
              className={
                item.dueInDays !== null && item.dueInDays <= 0 ? "text-destructive" : "text-accent"
              }
            >
              {due}
              {item.detail ? " · " : ""}
            </span>
          )}
          {item.detail}
        </p>
      )}
    </li>
  );
}

function LeadRow({ item }: { item: Lead }) {
  return (
    <li className="py-1">
      <span className="text-sm text-muted-foreground">{item.title}</span>
      {item.detail && <p className="text-xs text-muted-foreground/70">{item.detail}</p>}
    </li>
  );
}

/**
 * What the player has taken on, and separately what the world is offering.
 *
 * The split is the whole point. A commitment is something they caused; a lead is
 * something dangled at them. Merging the two is how a status panel becomes a
 * quest board, so they are drawn apart and only the commitments are counted.
 */
export function CommitmentsPanel({ status }: { status: CommitmentsStatus }) {
  return (
    <div className="space-y-3">
      {status.commitments.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nothing owed, nobody waiting. That will not last.
        </p>
      ) : (
        <ul className="divide-y divide-border/40">
          {status.commitments.map((item) => (
            <CommitmentRow key={item.key} item={item} />
          ))}
        </ul>
      )}
      {status.leads.length > 0 && (
        <div className="space-y-1 border-t border-border/50 pt-2">
          <Label>Going around</Label>
          <ul>
            {status.leads.map((item) => (
              <LeadRow key={item.key} item={item} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** The full rail. Life shows this standing; Play reaches it through the strip. */
export function StatusRail({ status }: { status: StatusView }) {
  return (
    <section className="border border-border bg-card px-4 py-1">
      <Chip label="Money" line={status.money.line} tone={TONE_CLASS[status.money.tone]}>
        <MoneyDetail status={status.money} />
      </Chip>
      <Chip label="Growth" line={status.growth.line}>
        <GrowthDetail status={status.growth} />
      </Chip>
      <Chip label="Commitments" line={status.commitments.line}>
        <CommitmentsPanel status={status.commitments} />
      </Chip>
    </section>
  );
}

/**
 * The same three facts as one line, for a screen that cannot spare three.
 *
 * Play already carries vitals, the scene, prompts and the combat board; on a
 * phone it cannot afford the standing rail, so this collapses to a strip and
 * opens on demand.
 */
export function StatusStrip({ status }: { status: StatusView }) {
  return (
    <Collapsible className="border border-border bg-card">
      <CollapsibleTrigger className="flex min-h-11 w-full items-center gap-3 overflow-x-auto px-3 py-2 text-left">
        <span className={`num shrink-0 text-xs font-bold ${TONE_CLASS[status.money.tone]}`}>
          {status.money.line}
        </span>
        <span className="num shrink-0 text-xs text-muted-foreground">{status.growth.ip} IP</span>
        <span className="num shrink-0 text-xs text-muted-foreground">
          {status.commitments.line}
        </span>
        <span aria-hidden className="ml-auto shrink-0 font-mono text-[10px] text-accent">
          ▾
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border/50 px-3 py-3">
        <div className="space-y-3">
          <MoneyDetail status={status.money} />
          <div className="border-t border-border/50 pt-2">
            <GrowthDetail status={status.growth} />
          </div>
          <div className="border-t border-border/50 pt-2">
            <CommitmentsPanel status={status.commitments} />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
