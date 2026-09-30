import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  CREATION_METHODS,
  STAT_ORDER,
  statRerollsLeft,
  statRollCost,
  adjustCompletePackageStat,
  normalizeCompletePackageStats,
  defaultRng,
  deriveStats,
  rollEdgerunnerStat,
  rollStreetratStats,
  startingCompletePackageStats,
  validateCompletePackageStats,
} from "@/engine";
import type { StatBlock, StatKey } from "@/engine";
import { DiceRoll } from "./DiceRoll";
import { StatTemplateTable } from "./StatTemplateTable";
import { StatCard } from "./StatCard";
import { statHighlights } from "./statBands";
import { DERIVED_KEYS, DERIVED_TITLES, derivedBriefing, type DerivedKey } from "./derivedFlavor";
import { StatInfoModal } from "./SheetInfo";
import { appendRoll } from "./rollLogStore";
import { useChargenStore, type ChargenState } from "./store";
import { STAT_GLANCE } from "./statFlavor";
import "./interview.css";

const COMPLETE = CREATION_METHODS.completePackage;

/**
 * A STAT card that explains itself: the label and the number open the STAT's
 * briefing, the same one the character sheet opens.
 */
function InfoStatCard({
  stat,
  value,
  roleId,
  children,
}: {
  stat: StatKey;
  value: number | undefined;
  roleId: string | null;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <StatCard stat={stat} value={value} onInfo={() => setOpen(true)}>
        {children}
      </StatCard>
      <StatInfoModal
        stat={stat}
        value={value ?? null}
        roleId={roleId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

/** How far a number has just moved, for the second or so after it does. */
function useRecentChange(value: number | undefined): number | null {
  const previous = useRef(value);
  const [change, setChange] = useState<number | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = value;
    if (typeof value !== "number" || typeof before !== "number" || value === before) return;
    setChange(value - before);
    const timer = window.setTimeout(() => setChange(null), 1600);
    return () => window.clearTimeout(timer);
  }, [value]);
  return change;
}

function DerivedTile({
  dkey,
  value,
  math,
  stats,
}: {
  dkey: DerivedKey;
  value: number | undefined;
  math: string;
  stats: Partial<StatBlock>;
}) {
  const [open, setOpen] = useState(false);
  const change = useRecentChange(value);
  const complete = STAT_ORDER.every((s) => typeof stats[s] === "number");
  const briefing = complete ? derivedBriefing(dkey, stats as StatBlock) : null;
  return (
    <>
      <button
        type="button"
        disabled={!briefing}
        onClick={() => setOpen(true)}
        aria-label={`What is ${DERIVED_TITLES[dkey]}?`}
        className="relative border border-border bg-card p-3 text-left transition-colors enabled:cursor-pointer enabled:hover:border-primary/60 enabled:hover:bg-surface/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground underline decoration-dotted underline-offset-4">
          {DERIVED_TITLES[dkey]}
        </p>
        <p className="num mt-1 font-mono text-3xl font-bold tabular-nums text-foreground">
          {value ?? "—"}
        </p>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">{math}</p>
        {change !== null && (
          <span
            aria-hidden
            className={cn(
              "num absolute right-3 top-3 font-mono text-sm font-bold",
              change > 0 ? "text-success" : "text-danger",
            )}
          >
            {change > 0 ? "+" : "−"}
            {Math.abs(change)}
          </span>
        )}
      </button>
      {briefing && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display tracking-tight">{briefing.title}</DialogTitle>
              <DialogDescription className="font-mono text-[11px] uppercase tracking-[0.18em]">
                {briefing.yours}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {briefing.body.map((paragraph, i) => (
                <p
                  key={paragraph}
                  className={cn(
                    "text-[0.95rem] leading-relaxed",
                    i === 0 ? "text-text" : "text-text-muted",
                  )}
                >
                  {paragraph}
                </p>
              ))}
              <p className="border-l-2 border-hairline pl-3 text-sm text-text-muted">
                {briefing.movedBy}
              </p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function DerivedPreview({ stats }: { stats: Partial<StatBlock> }) {
  const complete = STAT_ORDER.every((s) => typeof stats[s] === "number");
  const derived = complete ? deriveStats(stats as StatBlock) : null;
  const rows: { key: DerivedKey; value: number | undefined; math: string }[] = [
    { key: "hp", value: derived?.hpMax, math: "10 + 5 × ⌈(BODY + WILL) / 2⌉" },
    { key: "seriously", value: derived?.seriouslyWoundedThreshold, math: "⌈HP / 2⌉" },
    { key: "death", value: derived?.deathSave, math: "BODY" },
    { key: "humanity", value: derived?.humanityMax, math: "EMP × 10" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {DERIVED_KEYS.map((key) => {
        const row = rows.find((r) => r.key === key)!;
        return <DerivedTile key={key} dkey={key} value={row.value} math={row.math} stats={stats} />;
      })}
    </div>
  );
}

/**
 * The ten numbers, on the same cards the character sheet shows them on.
 *
 * Creation and the sheet used to draw a STAT two different ways, so a player
 * met the cards for the first time after they had finished choosing. The band
 * legend that sat above this grid is gone with the difference: the cards carry
 * a continuous ramp now, and a five-step key teaches a coarser model than the
 * thing it is a key to.
 */
function StatReadout({
  stats,
  rows,
  roleId,
}: {
  stats: Partial<StatBlock>;
  rows?: Partial<Record<StatKey, number>>;
  roleId: string | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {STAT_ORDER.map((stat) => (
        <InfoStatCard key={stat} stat={stat} value={stats[stat]} roleId={roleId}>
          {rows?.[stat] !== undefined && (
            <p className="font-mono text-[10px] text-text-dim">row {rows[stat]}</p>
          )}
        </InfoStatCard>
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

/** How many rerolls are left, said plainly: the first roll stands. */
function RerollNote({ used, what }: { used: number; what: string }) {
  const left = statRerollsLeft(used);
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-dim">
      {left > 0
        ? `First roll stands · ${left} reroll${left === 1 ? "" : "s"} left, for ${what}`
        : "First roll stands · no rerolls left"}
    </p>
  );
}

function StreetratBranch({ state }: { state: ChargenState }) {
  const patch = useChargenStore((s) => s.patch);
  const append = appendRoll;
  const roleId = state.roleId!;
  const rowCost = statRollCost({
    alreadyRolled: state.statRolls.row !== null,
    used: state.statRerollsUsed,
  });

  return (
    <div className="space-y-4">
      <Notice>
        Streetrat takes the whole row exactly as printed. STATs here cannot be rearranged, swapped,
        or edited — that is the trade you made for a character in five minutes. The table below is
        the same one the die reads, so you can check the row yourself.
      </Notice>
      <RerollNote used={state.statRerollsUsed} what="the whole row" />
      <div className="flex items-center gap-4">
        <DiceRoll
          sides={10}
          size={52}
          value={state.statRolls.row}
          disabled={!rowCost.allowed}
          label={
            state.statRolls.row
              ? rowCost.allowed
                ? "Spend your reroll on the STAT template row"
                : "The row stands"
              : "Roll the STAT template row"
          }
          roll={() => {
            const result = rollStreetratStats(roleId, defaultRng);
            return {
              face: result.row,
              commit: () => {
                append(`Streetrat STAT template row (${roleId})`, result.roll);
                const s = useChargenStore.getState();
                patch({
                  stats: result.stats,
                  statRolls: { row: result.row, rows: {} },
                  statRerollsUsed: s.statRerollsUsed + (rowCost.spends ? 1 : 0),
                });
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
      <StatReadout stats={state.stats} roleId={roleId} />
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

  function costOf(stat: StatKey) {
    return statRollCost({
      alreadyRolled: state.stats[stat] !== undefined,
      used: state.statRerollsUsed,
    });
  }

  function rollStat(stat: StatKey) {
    const result = rollEdgerunnerStat(roleId, stat, defaultRng);
    const spends = costOf(stat).spends;
    return {
      face: result.row,
      commit: () => {
        append(`Edgerunner ${stat.toUpperCase()} column (${roleId})`, result.roll);
        const s = useChargenStore.getState();
        patch({
          stats: { ...s.stats, [stat]: result.value },
          statRolls: { row: null, rows: { ...s.statRolls.rows, [stat]: result.row } },
          statRerollsUsed: s.statRerollsUsed + (spends ? 1 : 0),
        });
      },
    };
  }

  const unrolled = STAT_ORDER.filter((stat) => state.stats[stat] === undefined);

  /** Fire each unrolled card's own die in sequence so they all animate. Never spends a reroll. */
  function rollAll() {
    const grid = gridRef.current;
    if (!grid || bursting) return;
    const buttons = Array.from(
      grid.querySelectorAll<HTMLButtonElement>("button[data-stat-die]"),
    ).filter((b) => unrolled.includes(b.dataset["statDie"] as StatKey));
    setBursting(true);
    buttons.forEach((button, i) => {
      window.setTimeout(() => button.click(), i * 110);
    });
    window.setTimeout(() => setBursting(false), buttons.length * 110 + 1000);
  }

  return (
    <div className="space-y-4">
      <Notice>
        Ten separate 1d10s, each read against that STAT's own column of the same Role table. Once a
        STAT lands it stays where it landed — no rearranging, no swapping between STATs.
      </Notice>
      <RerollNote used={state.statRerollsUsed} what="one STAT" />
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={rollAll} disabled={bursting || unrolled.length === 0}>
          {bursting
            ? "Rolling…"
            : unrolled.length === STAT_ORDER.length
              ? "Roll all ten"
              : unrolled.length > 0
                ? `Roll the other ${unrolled.length}`
                : "All ten rolled"}
        </Button>
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          or roll them one at a time below
        </span>
      </div>
      <div ref={gridRef} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {STAT_ORDER.map((stat) => (
          <InfoStatCard key={stat} stat={stat} value={state.stats[stat]} roleId={roleId}>
            <div className="flex justify-start" data-stat-die-wrap={stat}>
              <DiceRoll
                sides={10}
                value={state.statRolls.rows[stat] ?? null}
                disabled={!costOf(stat).allowed}
                label={
                  state.stats[stat] === undefined
                    ? `Roll 1d10 for ${stat.toUpperCase()}`
                    : costOf(stat).allowed
                      ? `Spend your reroll on ${stat.toUpperCase()}`
                      : `${stat.toUpperCase()} stands`
                }
                buttonProps={{ "data-stat-die": stat }}
                roll={() => rollStat(stat)}
              />
            </div>
          </InfoStatCard>
        ))}
      </div>
      <StatTemplateTable roleId={roleId} highlightCells={state.statRolls.rows} />
    </div>
  );
}

/**
 * A − or + that keeps going while it is held. The first press acts at once, so
 * a tap is one point; a hold waits a beat and then repeats. Keyboard presses
 * arrive as clicks with no pointer (`detail` 0) and act once, since the pointer
 * handlers never saw them.
 */
function StepButton({
  label,
  disabled,
  onStep,
  children,
}: {
  label: string;
  disabled: boolean;
  onStep: () => void;
  children: React.ReactNode;
}) {
  const delay = useRef<number | undefined>(undefined);
  const repeat = useRef<number | undefined>(undefined);
  const stop = () => {
    window.clearTimeout(delay.current);
    window.clearInterval(repeat.current);
  };
  useEffect(() => stop, []);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={label}
      disabled={disabled}
      className="size-9 p-0 font-mono text-base"
      onPointerDown={() => {
        if (disabled) return;
        onStep();
        stop();
        delay.current = window.setTimeout(() => {
          repeat.current = window.setInterval(onStep, 90);
        }, 380);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onBlur={stop}
      onClick={(e) => {
        if (e.detail === 0) onStep();
      }}
    >
      {children}
    </Button>
  );
}

function CompletePackageBranch({ state }: { state: ChargenState }) {
  const patch = useChargenStore((s) => s.patch);
  const result = validateCompletePackageStats(state.stats);
  const remaining = result.pointsRemaining;
  const roleId = state.roleId;

  // Every STAT starts at the floor, so a "+" always adds one to a real number
  // and the pool is simply what is left. A draft saved before the controls
  // stopped taking typed numbers is brought inside the rules the same way.
  const complete = STAT_ORDER.every((stat) => typeof state.stats[stat] === "number");
  const legal =
    complete &&
    validateCompletePackageStats(state.stats).violations.every((v) => v.includes("unspent"));
  useEffect(() => {
    if (Object.keys(state.stats).length === 0) {
      patch({ stats: startingCompletePackageStats() });
    } else if (!legal) {
      patch({ stats: normalizeCompletePackageStats(state.stats) });
    }
  }, [state.stats, legal, patch]);

  /** Read fresh each time: a held button fires faster than React re-renders. */
  function move(stat: StatKey, delta: number) {
    const current = useChargenStore.getState().stats;
    const next = adjustCompletePackageStat(current, stat, delta);
    if (next !== current) patch({ stats: next });
  }

  function spreadEvenly() {
    const even = Math.floor(COMPLETE.statPoints / STAT_ORDER.length);
    const stats = {} as StatBlock;
    for (const stat of STAT_ORDER) stats[stat] = even;
    patch({ stats });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card p-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Points remaining
          </p>
          <p className="num font-mono text-4xl font-bold tabular-nums text-foreground">
            {remaining}
          </p>
          {remaining === 0 && (
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-success">
              All spent
            </p>
          )}
        </div>
        <Button variant="outline" onClick={spreadEvenly}>
          Spread evenly
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {STAT_ORDER.map((stat) => {
          const value = state.stats[stat];
          const at = typeof value === "number" ? value : COMPLETE.statMin;
          return (
            <InfoStatCard key={stat} stat={stat} value={value} roleId={roleId}>
              <div className="flex items-center gap-2">
                <StepButton
                  label={`Lower ${stat.toUpperCase()}`}
                  disabled={at <= COMPLETE.statMin}
                  onStep={() => move(stat, -1)}
                >
                  −
                </StepButton>
                <StepButton
                  label={`Raise ${stat.toUpperCase()}`}
                  disabled={at >= COMPLETE.statMax || remaining <= 0}
                  onStep={() => move(stat, 1)}
                >
                  +
                </StepButton>
              </div>
            </InfoStatCard>
          );
        })}
      </div>
    </div>
  );
}

/**
 * What the ten numbers make you, said the way the street would say it: the STAT
 * you are best at and the one you are worst at, but only when either is worth
 * naming. Ten sixes have no weak spot, and a strip that invents one teaches the
 * wrong thing (`statHighlights` holds the line).
 */
function AtAGlance({ stats }: { stats: Partial<StatBlock> }) {
  const { edge, weak } = statHighlights(stats, STAT_ORDER);
  if (!edge && !weak) return null;
  return (
    <div className={cn("cg-say grid gap-3", edge && weak && "sm:grid-cols-2")}>
      {edge && (
        <div className="border-l-2 border-success bg-success/5 p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">
            Your edge · {edge.toUpperCase()} {stats[edge]}
          </p>
          <p className="mt-1 text-base">{STAT_GLANCE[edge].high}</p>
        </div>
      )}
      {weak && (
        <div className="border-l-2 border-danger bg-danger/5 p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">
            Your weak spot · {weak.toUpperCase()} {stats[weak]}
          </p>
          <p className="mt-1 text-base">{STAT_GLANCE[weak].low}</p>
        </div>
      )}
    </div>
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

      <AtAGlance stats={state.stats} />

      <div className="space-y-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent">
          Derived STATs — live preview
        </h2>
        <DerivedPreview stats={state.stats} />
      </div>
    </div>
  );
}
