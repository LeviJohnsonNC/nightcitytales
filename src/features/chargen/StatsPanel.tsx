import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  CREATION_METHODS,
  STAT_ORDER,
  STAT_DESCRIPTIONS,
  defaultRng,
  deriveStats,
  rollEdgerunnerStat,
  rollStreetratStats,
  validateCompletePackageStats,
} from "@/engine";
import type { StatBlock, StatKey } from "@/engine";
import { DiceRoll } from "./DiceRoll";
import { StatTemplateTable } from "./StatTemplateTable";
import { appendRoll } from "./rollLogStore";
import { useChargenStore, type ChargenState } from "./store";

const COMPLETE = CREATION_METHODS.completePackage;

/** Per-STAT meaning comes from creation-rules.json → statDescriptions. */
function StatMeaning({ stat }: { stat: StatKey }) {
  const info = STAT_DESCRIPTIONS[stat];
  if (!info) {
    return (
      <span>
        No entry for {stat.toUpperCase()} in src/data/rules/creation-rules.json →
        statDescriptions.stats.
      </span>
    );
  }
  return (
    <span className="block space-y-1">
      <span className="block font-semibold">
        {info.stat} — {info.name}
      </span>
      <span className="block">{info.description}</span>
      <span className="block text-text-muted">Drives: {info.drives}</span>
    </span>
  );
}

function DerivedPreview({ stats }: { stats: Partial<StatBlock> }) {
  const complete = STAT_ORDER.every((s) => typeof stats[s] === "number");
  const derived = complete ? deriveStats(stats as StatBlock) : null;
  const rows = [
    { label: "Hit Points", value: derived?.hpMax, math: "10 + 5 × ⌈(BODY + WILL) / 2⌉" },
    {
      label: "Seriously Wounded",
      value: derived?.seriouslyWoundedThreshold,
      math: "⌈HP / 2⌉",
    },
    { label: "Death Save", value: derived?.deathSave, math: "BODY" },
    { label: "Humanity", value: derived?.humanityMax, math: "EMP × 10" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {rows.map((row) => (
        <div key={row.label} className="border border-border bg-card p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {row.label}
          </p>
          <p className="num mt-1 font-mono text-3xl font-bold tabular-nums text-foreground">
            {row.value ?? "—"}
          </p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">{row.math}</p>
        </div>
      ))}
    </div>
  );
}

function StatReadout({
  stats,
  rows,
}: {
  stats: Partial<StatBlock>;
  rows?: Partial<Record<StatKey, number>>;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {STAT_ORDER.map((stat) => (
        <div key={stat} className="border border-border bg-card p-3 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {stat.toUpperCase()}
          </p>
          <p className="num font-mono text-2xl font-bold tabular-nums text-foreground">
            {stats[stat] ?? "—"}
          </p>
          {rows?.[stat] !== undefined && (
            <p className="font-mono text-[10px] text-muted-foreground">row {rows[stat]}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-l-2 border-primary/70 bg-primary/5 p-3 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function StreetratBranch({ state }: { state: ChargenState }) {
  const patch = useChargenStore((s) => s.patch);
  const append = appendRoll;
  const roleId = state.roleId!;

  return (
    <div className="space-y-4">
      <Notice>
        Streetrat takes the whole row exactly as printed. STATs here cannot be rearranged,
        swapped, or edited — that is the trade you made for a character in five minutes. The
        table below is the same one the die reads, so you can check the row yourself.
      </Notice>
      <div className="flex items-center gap-4">
        <DiceRoll
          sides={10}
          size={52}
          value={state.statRolls.row}
          label={state.statRolls.row ? "Re-roll the STAT template row" : "Roll the STAT template row"}
          roll={() => {
            const result = rollStreetratStats(roleId, defaultRng);
            return {
              face: result.row,
              commit: () => {
                append(`Streetrat STAT template row (${roleId})`, result.roll);
                patch({ stats: result.stats, statRolls: { row: result.row, rows: {} } });
              },
            };
          }}
        />
        <p className="font-mono text-sm text-muted-foreground">
          {state.statRolls.row
            ? `Row ${state.statRolls.row} taken as written.`
            : "Click the die to roll your row."}
        </p>
      </div>
      <StatReadout stats={state.stats} />
      <StatTemplateTable roleId={roleId} highlightRow={state.statRolls.row} />
    </div>
  );
}

function EdgerunnerBranch({ state }: { state: ChargenState }) {
  const patch = useChargenStore((s) => s.patch);
  const append = appendRoll;
  const roleId = state.roleId!;
  const gridRef = useRef<HTMLDivElement>(null);
  const [bursting, setBursting] = useState(false);

  function rollStat(stat: StatKey) {
    const result = rollEdgerunnerStat(roleId, stat, defaultRng);
    return {
      face: result.row,
      commit: () => {
        append(`Edgerunner ${stat.toUpperCase()} column (${roleId})`, result.roll);
        const s = useChargenStore.getState();
        patch({
          stats: { ...s.stats, [stat]: result.value },
          statRolls: { row: null, rows: { ...s.statRolls.rows, [stat]: result.row } },
        });
      },
    };
  }

  /** Fire each card's own die in sequence so all ten animate. */
  function rollAll() {
    const grid = gridRef.current;
    if (!grid || bursting) return;
    const buttons = Array.from(grid.querySelectorAll<HTMLButtonElement>("button[data-stat-die]"));
    setBursting(true);
    buttons.forEach((button, i) => {
      window.setTimeout(() => button.click(), i * 110);
    });
    window.setTimeout(() => setBursting(false), buttons.length * 110 + 1000);
  }

  return (
    <div className="space-y-4">
      <Notice>
        Ten separate 1d10s, each read against that STAT's own column of the same Role table.
        Once a STAT lands it stays where it landed — no rearranging, no swapping between STATs.
      </Notice>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={rollAll} disabled={bursting}>
          {bursting ? "Rolling ten dice…" : "Roll all ten"}
        </Button>
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          or roll them one at a time below
        </span>
      </div>
      <div ref={gridRef} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {STAT_ORDER.map((stat) => (
          <div key={stat} className="border border-border bg-card p-3 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {stat.toUpperCase()}
            </p>
            <p className="num font-mono text-2xl font-bold tabular-nums text-foreground">
              {state.stats[stat] ?? "—"}
            </p>
            <div className="mt-2 flex justify-center" data-stat-die-wrap={stat}>
              <DiceRoll
                sides={10}
                value={state.statRolls.rows[stat] ?? null}
                label={`${state.stats[stat] === undefined ? "Roll" : "Re-roll"} 1d10 for ${stat.toUpperCase()}`}
                buttonProps={{ "data-stat-die": stat }}
                roll={() => rollStat(stat)}
              />
            </div>
          </div>
        ))}
      </div>
      <StatTemplateTable roleId={roleId} highlightCells={state.statRolls.rows} />
    </div>
  );
}

function CompletePackageBranch({ state }: { state: ChargenState }) {
  const patch = useChargenStore((s) => s.patch);
  const result = validateCompletePackageStats(state.stats);
  const remaining = result.pointsRemaining;

  function setStat(stat: StatKey, raw: string) {
    if (raw === "") {
      const { [stat]: _drop, ...rest } = state.stats;
      patch({ stats: rest });
      return;
    }
    const value = Number.parseInt(raw, 10);
    if (Number.isNaN(value)) return;
    patch({ stats: { ...state.stats, [stat]: value } });
  }

  function step(stat: StatKey, delta: number) {
    const current = state.stats[stat] ?? COMPLETE.statMin;
    patch({ stats: { ...state.stats, [stat]: current + delta } });
  }

  function spreadEvenly() {
    const even = Math.floor(COMPLETE.statPoints / STAT_ORDER.length);
    const stats = {} as StatBlock;
    for (const stat of STAT_ORDER) stats[stat] = even;
    patch({ stats });
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card p-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Points remaining
            </p>
            <p
              className={cn(
                "num font-mono text-4xl font-bold tabular-nums",
                remaining < 0 ? "text-destructive" : "text-foreground",
              )}
            >
              {remaining}
            </p>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              {result.pointsSpent} of {COMPLETE.statPoints} spent · min {COMPLETE.statMin} · max{" "}
              {COMPLETE.statMax}
            </p>
          </div>
          <Button variant="outline" onClick={spreadEvenly}>
            Spread evenly
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {STAT_ORDER.map((stat) => {
            const value = state.stats[stat];
            const outOfRange =
              typeof value === "number" &&
              (value > COMPLETE.statMax || value < COMPLETE.statMin);
            return (
              <div
                key={stat}
                className={cn(
                  "flex items-center gap-3 border border-border bg-card p-3",
                  outOfRange && "border-destructive",
                )}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="w-16 cursor-help font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground underline decoration-dotted underline-offset-4">
                      {stat.toUpperCase()}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-sm">
                    <StatMeaning stat={stat} />
                  </TooltipContent>
                </Tooltip>
                <Button variant="outline" size="sm" onClick={() => step(stat, -1)}>
                  −
                </Button>
                <Input
                  inputMode="numeric"
                  aria-label={`${stat.toUpperCase()} value`}
                  className="num w-16 text-center font-mono tabular-nums"
                  value={value === undefined ? "" : String(value)}
                  onChange={(e) => setStat(stat, e.target.value)}
                />
                <Button variant="outline" size="sm" onClick={() => step(stat, 1)}>
                  +
                </Button>
              </div>
            );
          })}
        </div>

        <Notice>
          You can go over budget while you shuffle numbers around — nothing is blocked
          mid-edit. You just can't leave this step until the total is exactly{" "}
          {COMPLETE.statPoints} and every STAT sits between {COMPLETE.statMin} and{" "}
          {COMPLETE.statMax}. Watch the Hit Points and Death Save below as you move BODY and
          WILL: that is your survivability being bought.
        </Notice>
      </div>
    </TooltipProvider>
  );
}

export function StatsPanel({ state }: { state: ChargenState }) {
  if (!state.method) {
    return <p className="text-sm text-muted-foreground">Choose a creation method first.</p>;
  }
  if (state.method !== "complete_package" && !state.roleId) {
    return (
      <p className="text-sm text-muted-foreground">
        Pick a Role first — rolled STATs are read from that Role's template table.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {state.method === "streetrat" && <StreetratBranch state={state} />}
      {state.method === "edgerunner" && <EdgerunnerBranch state={state} />}
      {state.method === "complete_package" && <CompletePackageBranch state={state} />}

      <div className="space-y-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent">
          Derived STATs — live preview
        </h2>
        <DerivedPreview stats={state.stats} />
      </div>
    </div>
  );
}
