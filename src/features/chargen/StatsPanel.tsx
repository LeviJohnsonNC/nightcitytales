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
  statRollVerdict,
  validateCompletePackageStats,
} from "@/engine";
import type { StatBlock, StatKey, StatRollVerdict } from "@/engine";
import { DiceRoll, type DieTone } from "./DiceRoll";
import { StatTemplateTable } from "./StatTemplateTable";
import { PointBuyCard } from "./PointBuyCard";
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
  verdict,
  children,
}: {
  stat: StatKey;
  value: number | undefined;
  roleId: string | null;
  /** How good the roll was for this Role. Rolled methods only. */
  verdict?: StatRollVerdict | null;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const change = useRecentChange(value);
  return (
    <>
      {/* The flare plays for the moment after a die lands, and only then: a
          card read back from a saved draft just sits there. A class rather
          than a key, so the die inside is not remounted mid-landing. */}
      <div className={cn("relative", change !== null && verdict && `cg-roll-${verdict}`)}>
        <StatCard stat={stat} value={value} onInfo={() => setOpen(true)}>
          {(children || verdict) && (
            <div className="flex items-center gap-2">
              {children}
              {verdict && <VerdictChip verdict={verdict} />}
            </div>
          )}
        </StatCard>
      </div>
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

/** What each verdict says on its card. */
const VERDICT_LABEL: Record<StatRollVerdict, string> = {
  best: "Top roll",
  good: "Good roll",
  fair: "Fair",
  poor: "Low roll",
  worst: "Floor",
};

/** How the die lights for each verdict, from the tones it already knows. */
const VERDICT_TONE: Record<StatRollVerdict, DieTone> = {
  best: "crit",
  good: "win",
  fair: null,
  poor: "lose",
  worst: "fumble",
};

function VerdictChip({ verdict }: { verdict: StatRollVerdict }) {
  if (verdict === "fair") return null;
  return (
    <span
      className={cn(
        "relative shrink-0 border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em]",
        verdict === "best" &&
          "border-success bg-success/20 text-success shadow-[0_0_14px_-4px_var(--color-success)]",
        verdict === "good" && "border-success/50 text-success",
        verdict === "poor" && "border-amber/50 text-amber",
        verdict === "worst" && "border-danger bg-danger/15 text-danger",
      )}
    >
      {VERDICT_LABEL[verdict]}
    </span>
  );
}

/** Every rolled STAT's verdict for this Role. */
function verdictsFor(
  roleId: string,
  stats: Partial<StatBlock>,
): Partial<Record<StatKey, StatRollVerdict>> {
  const out: Partial<Record<StatKey, StatRollVerdict>> = {};
  for (const stat of STAT_ORDER) {
    const value = stats[stat];
    if (typeof value === "number") out[stat] = statRollVerdict(roleId, stat, value);
  }
  return out;
}

/**
 * The rolls, summed up once all ten have landed: how many came up top and how
 * many hit the floor, and — while a reroll is still unspent — a button that
 * spends it on the worst one.
 */
function RollReport({
  verdicts,
  stats,
  onReroll,
}: {
  verdicts: Partial<Record<StatKey, StatRollVerdict>>;
  stats: Partial<StatBlock>;
  onReroll: ((stat: StatKey) => void) | null;
}) {
  const rolled = STAT_ORDER.filter((s) => verdicts[s]);
  if (rolled.length < STAT_ORDER.length) return null;
  const top = rolled.filter((s) => verdicts[s] === "best" || verdicts[s] === "good");
  const low = rolled.filter((s) => verdicts[s] === "worst" || verdicts[s] === "poor");
  const rank: Record<StatRollVerdict, number> = { worst: 0, poor: 1, fair: 2, good: 3, best: 4 };
  const weakest = [...low].sort((a, b) => rank[verdicts[a]!] - rank[verdicts[b]!])[0];
  const headline =
    top.length >= low.length + 3
      ? "Hot dice. The city just dealt you a good hand."
      : low.length >= top.length + 3
        ? "Rough night at the table. Make it count."
        : "A mixed hand, like most people's.";
  return (
    <div className="cg-say flex flex-wrap items-center gap-x-6 gap-y-3 border border-border bg-card p-4">
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-base font-semibold">{headline}</p>
        <p className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.16em]">
          <span className="text-success">
            {top.length} above the middle
            {top.length ? `: ${top.map((s) => s.toUpperCase()).join(" ")}` : ""}
          </span>
          <span className="text-danger">
            {low.length} below{low.length ? `: ${low.map((s) => s.toUpperCase()).join(" ")}` : ""}
          </span>
        </p>
      </div>
      {onReroll && weakest && (
        <Button variant="outline" onClick={() => onReroll(weakest)}>
          Reroll {weakest.toUpperCase()} ({stats[weakest]})
        </Button>
      )}
    </div>
  );
}

/** The printed table, for somebody who wants to check the die against it. Closed by default. */
function TableDisclosure({ children }: { children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none font-mono text-[10px] uppercase tracking-[0.18em] text-text-dim hover:text-text">
        <span className="group-open:hidden">Check the rolls against the printed table</span>
        <span className="hidden group-open:inline">Hide the printed table</span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function DerivedTile({
  dkey,
  value,
  stats,
}: {
  dkey: DerivedKey;
  value: number | undefined;
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
  const rows: { key: DerivedKey; value: number | undefined }[] = [
    { key: "hp", value: derived?.hpMax },
    { key: "seriously", value: derived?.seriouslyWoundedThreshold },
    { key: "death", value: derived?.deathSave },
    { key: "humanity", value: derived?.humanityMax },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {DERIVED_KEYS.map((key) => {
        const row = rows.find((r) => r.key === key)!;
        return <DerivedTile key={key} dkey={key} value={row.value} stats={stats} />;
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
  const verdicts = roleId ? verdictsFor(roleId, stats) : {};
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {STAT_ORDER.map((stat) => (
        <InfoStatCard
          key={stat}
          stat={stat}
          value={stats[stat]}
          roleId={roleId}
          verdict={verdicts[stat] ?? null}
        >
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
        One die, all ten STATs. Streetrat takes the whole row as it lands: nothing rearranged,
        swapped or edited — that is the trade for a character in five minutes. Green is the best
        your Role can roll, red the worst.
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
      <TableDisclosure>
        <StatTemplateTable roleId={roleId} highlightRow={state.statRolls.row} />
      </TableDisclosure>
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
      tone: VERDICT_TONE[statRollVerdict(roleId, stat, result.value)],
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
  const verdicts = verdictsFor(roleId, state.stats);

  /** Spend the reroll through the STAT's own die, so it tumbles like any other roll. */
  function rerollViaDie(stat: StatKey) {
    gridRef.current?.querySelector<HTMLButtonElement>(`button[data-stat-die="${stat}"]`)?.click();
  }

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
        Ten dice, one per STAT. Each lands somewhere between the worst and the best your Role can
        roll: green is the top of that range, red the floor. Once a STAT lands it stays — no
        rearranging, no swapping.
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
          <InfoStatCard
            key={stat}
            stat={stat}
            value={state.stats[stat]}
            roleId={roleId}
            verdict={verdicts[stat] ?? null}
          >
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
                tone={verdicts[stat] ? VERDICT_TONE[verdicts[stat]!] : null}
                roll={() => rollStat(stat)}
              />
            </div>
          </InfoStatCard>
        ))}
      </div>
      <RollReport
        verdicts={verdicts}
        stats={state.stats}
        onReroll={statRerollsLeft(state.statRerollsUsed) > 0 ? rerollViaDie : null}
      />
      <TableDisclosure>
        <StatTemplateTable roleId={roleId} highlightCells={state.statRolls.rows} />
      </TableDisclosure>
    </div>
  );
}

function CompletePackageBranch({ state }: { state: ChargenState }) {
  const patch = useChargenStore((s) => s.patch);
  const result = validateCompletePackageStats(state.stats);
  const remaining = result.pointsRemaining;
  const roleId = state.roleId;
  // Named once the points are all spent: mid-build the extremes are whichever
  // STAT happens to come first among the ones not yet raised, which says nothing.
  const { edges, weak } =
    remaining === 0 ? statHighlights(state.stats, STAT_ORDER) : { edges: [], weak: [] };

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
      <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card p-4 max-sm:px-4 max-sm:py-2.5 max-sm:sticky max-sm:top-14 max-sm:z-10 max-sm:bg-card/95 max-sm:backdrop-blur">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Points remaining
          </p>
          {/* The number and the confirmation share a line, so the bar does not
              grow, and shove the cards down, the moment the last point is spent. */}
          <div className="flex items-baseline gap-3">
            <p className="num font-mono text-4xl font-bold tabular-nums text-foreground max-sm:text-3xl">
              {remaining}
            </p>
            {remaining === 0 && (
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-success">
                All spent
              </p>
            )}
          </div>
        </div>
        <Button variant="outline" onClick={spreadEvenly}>
          Spread evenly
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {STAT_ORDER.map((stat) => {
          const at = state.stats[stat] ?? COMPLETE.statMin;
          return (
            <PointBuyCard
              key={stat}
              stat={stat}
              value={at}
              roleId={roleId}
              canLower={at > COMPLETE.statMin}
              canRaise={at < COMPLETE.statMax && remaining > 0}
              onStep={(delta) => move(stat, delta)}
              mark={edges.includes(stat) ? "edge" : weak.includes(stat) ? "weak" : null}
            />
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
function AtAGlance({ stats, settled }: { stats: Partial<StatBlock>; settled: boolean }) {
  const { edges, weak } = settled ? statHighlights(stats, STAT_ORDER) : { edges: [], weak: [] };
  if (edges.length === 0 && weak.length === 0) return null;
  return (
    <div
      className={cn(
        "cg-say grid items-start gap-3",
        edges.length > 0 && weak.length > 0 && "sm:grid-cols-2",
      )}
    >
      <GlanceList kind="edge" stats={stats} which={edges} />
      <GlanceList kind="weak" stats={stats} which={weak} />
    </div>
  );
}

/** One side of the strip: a line per STAT, since there can be several. */
function GlanceList({
  kind,
  stats,
  which,
}: {
  kind: "edge" | "weak";
  stats: Partial<StatBlock>;
  which: StatKey[];
}) {
  if (which.length === 0) return null;
  const edge = kind === "edge";
  return (
    <div
      className={cn(
        "border-l-2 p-3",
        edge ? "border-success bg-success/5" : "border-danger bg-danger/5",
      )}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">
        {edge
          ? which.length === 1
            ? "Your edge"
            : "Your edges"
          : which.length === 1
            ? "Your weak spot"
            : "Your weak spots"}
      </p>
      <ul className="mt-1 space-y-1.5">
        {which.map((stat) => (
          <li key={stat} className="flex items-baseline gap-3 text-base">
            <span className="w-14 shrink-0 font-mono text-[11px] uppercase tracking-[0.16em] text-text-dim">
              {stat.toUpperCase()} {stats[stat]}
            </span>
            <span>{edge ? STAT_GLANCE[stat].high : STAT_GLANCE[stat].low}</span>
          </li>
        ))}
      </ul>
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

      <AtAGlance
        stats={state.stats}
        settled={
          state.method !== "complete_package" ||
          validateCompletePackageStats(state.stats).pointsRemaining === 0
        }
      />

      <div className="space-y-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent">
          Derived STATs
        </h2>
        <DerivedPreview stats={state.stats} />
      </div>
    </div>
  );
}
