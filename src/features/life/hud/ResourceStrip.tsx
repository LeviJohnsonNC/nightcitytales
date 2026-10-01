/**
 * Money, growth and commitments as three icon chips in one row.
 *
 * Each chip shows only the figure that matters and opens the detail behind it
 * in a popover, so the rail stays small and the sentences wait until asked for.
 * The numbers are statusModel's; nothing here computes one.
 */
import type { ReactNode } from "react";
import { Coins, ListChecks, TrendingUp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CommitmentsPanel, GrowthDetail, MoneyDetail } from "@/features/status/StatusRail";
import type { MoneyTone, StatusView } from "@/features/status/statusModel";
import { fillFraction } from "./hudModel";

const MONEY_TONE: Record<MoneyTone, string> = {
  ok: "text-foreground",
  soon: "text-amber-500",
  due: "text-destructive",
};

function Chip({
  label,
  icon,
  figure,
  tone,
  alert,
  meter,
  children,
}: {
  label: string;
  icon: ReactNode;
  figure: string;
  tone?: string;
  /** A red dot: something is due. */
  alert?: boolean;
  /** 0 to 1, drawn along the foot of the chip. */
  meter?: number;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={label}
        className="group relative flex min-h-14 flex-col items-center justify-center gap-0.5 overflow-hidden border border-hairline bg-surface/60 px-1 py-2 transition-colors hover:border-accent/60 focus-visible:outline-2 focus-visible:outline-accent data-[state=open]:border-accent"
      >
        <span aria-hidden className="text-accent">
          {icon}
        </span>
        <span className={cn("num font-mono text-xs font-bold", tone)}>{figure}</span>
        {alert && (
          <span
            aria-label="due"
            className="absolute right-1 top-1 size-2 rounded-full bg-destructive shadow-[0_0_6px_var(--color-destructive)]"
          />
        )}
        {meter !== undefined && (
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-hairline">
            <span
              className="block h-full bg-accent"
              style={{ width: `${Math.round(meter * 100)}%` }}
            />
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)]">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">
          {label}
        </p>
        {children}
      </PopoverContent>
    </Popover>
  );
}

export function ResourceStrip({ status }: { status: StatusView }) {
  const { money, growth, commitments } = status;
  return (
    <section className="grid grid-cols-3 gap-2">
      <Chip
        label="Money"
        icon={<Coins className="size-4" />}
        figure={money.line}
        tone={MONEY_TONE[money.tone]}
        alert={money.tone === "due"}
      >
        <MoneyDetail status={money} />
      </Chip>
      <Chip
        label="Growth"
        icon={<TrendingUp className="size-4" />}
        figure={`${growth.ip} IP`}
        meter={growth.next ? fillFraction(growth.ip, growth.next.cost) : 1}
      >
        <GrowthDetail status={growth} />
      </Chip>
      <Chip
        label="Commitments"
        icon={<ListChecks className="size-4" />}
        figure={String(commitments.open)}
        alert={commitments.dueToday > 0 || commitments.overdue > 0}
      >
        <CommitmentsPanel status={commitments} />
      </Chip>
    </section>
  );
}
