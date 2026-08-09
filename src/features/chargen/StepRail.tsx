import { cn } from "@/lib/utils";
import { CHARGEN_STEPS, type ChargenStep } from "./steps";
import type { StepStatus } from "./validation";

const STATUS_STYLES: Record<StepStatus, string> = {
  locked: "border-border/60 text-muted-foreground/60",
  "in progress": "border-border text-foreground",
  valid: "border-accent/70 text-foreground",
  "has errors": "border-destructive/80 text-foreground",
};

const STATUS_DOT: Record<StepStatus, string> = {
  locked: "bg-muted-foreground/40",
  "in progress": "bg-muted-foreground",
  valid: "bg-accent",
  "has errors": "bg-destructive",
};

export function StepRail({
  current,
  statuses,
  onSelect,
}: {
  current: ChargenStep;
  statuses: Record<ChargenStep, StepStatus>;
  onSelect: (step: ChargenStep) => void;
}) {
  return (
    <nav aria-label="Character creation steps" className="space-y-1">
      <p className="px-2 pb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        Build sequence
      </p>
      <ol className="space-y-1">
        {CHARGEN_STEPS.map((step) => {
          const status = statuses[step.id];
          const active = step.id === current;
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onSelect(step.id)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex w-full items-start gap-3 border-l-2 px-3 py-2 text-left transition-colors hover:bg-card",
                  STATUS_STYLES[status],
                  active && "bg-card",
                )}
              >
                <span className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                  {String(step.index).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold tracking-tight">
                      {step.title}
                    </span>
                    <span
                      aria-hidden
                      className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[status])}
                    />
                  </span>
                  <span className="block truncate font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    {status}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}