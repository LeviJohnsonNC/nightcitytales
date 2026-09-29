/**
 * The narrator's real turns, scored: what the ledger already knows about every
 * turn anyone has played.
 *
 * WHY THIS EXISTS. Every narration event carries the prompt version and model
 * that wrote it (`turnProvenanceData`, `engine/ledger.ts`), added precisely so
 * that "did that revision make the GM worse" would be answerable. Nothing read it
 * back, and the eval asks a model about a few dozen invented scenes at a cost per
 * call. The played turns are free, real, and numerous: the same detectors can run
 * over them and group the result by the version that wrote each turn.
 *
 * WHAT IT CANNOT DO. The ledger stores what the narrator SAID and offered, not
 * what it was HANDED: the packet is not in it, and neither is what the player had
 * asked for. So only a check that needs neither can run here. That is the three
 * prose rules: no way in named, no "What do you do?", no list of smells. The
 * number check needs the packet to know whether the engine said a figure first,
 * so here it is reported apart as an UPPER BOUND on figures stated, never as a
 * failure.
 *
 * "Options only when asked" cannot run, though it looks as if it could. A Life
 * turn stores its `actions` whether the narrator offered them or the engine did:
 * a trip that could not be worked out writes the nearest real places as cards,
 * in the same shape, on an ordinary narration row. Counting those as the
 * narrator offering options nobody asked for would report a failure that is the
 * engine working.
 *
 * It is also not an experiment. Two versions were played by different people, on
 * different nights, at different points in their campaigns. A difference between
 * them is a lead, and the eval (same scenes, same conditions) is what confirms it.
 * The turns of one campaign are also more alike than turns of two, so the counts
 * here are less independent than the significance test assumes.
 *
 * Pure. `evals/replay.ts` fetches the rows.
 */
import { readTurnProvenance, readWalkOnsEventData, type Narrator } from "@/engine";
import { verdictOf } from "./evalReport";
import {
  endsOnTheWorld,
  namesNoWayIn,
  noUnsourcedNumber,
  opensOnSomething,
  type CheckContext,
  type CheckableTurn,
  type Check,
} from "./narratorChecks";

/** The columns of `campaign_events` this reads. */
export type LedgerRow = {
  id: string;
  campaign_id: string;
  type: string;
  summary: string | null;
  data: unknown;
  created_at: string;
};

/** The event types that are a narrator's turn. */
export const NARRATION_TYPES = ["gm_narration", "life_narration", "life_options"] as const;

export type ReplayTurn = {
  id: string;
  campaignId: string;
  at: string;
  narrator: Narrator;
  /** An options answer is a different kind of turn from the scene it stands in. */
  kind: "narration" | "options";
  /** Null for a turn written before provenance existed, or by a stale client. */
  provenance: ReturnType<typeof readTurnProvenance>;
  turn: CheckableTurn;
  words: number;
};

function labelsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") return item.trim() ? [item.trim()] : [];
    if (item && typeof item === "object") {
      const label = (item as Record<string, unknown>)["label"];
      if (typeof label === "string" && label.trim()) return [label.trim()];
    }
    return [];
  });
}

/** Read the narration turns out of ledger rows, in the order they were written. */
export function narrationTurns(rows: LedgerRow[]): ReplayTurn[] {
  const turns: ReplayTurn[] = [];
  for (const row of rows) {
    if (!(NARRATION_TYPES as readonly string[]).includes(row.type)) continue;
    const prose = (row.summary ?? "").trim();
    if (!prose) continue;
    const data =
      row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
    const provenance = readTurnProvenance(data);
    const narrator: Narrator =
      provenance?.narrator ?? (row.type === "gm_narration" ? "gm" : "life");
    turns.push({
      id: row.id,
      campaignId: row.campaign_id,
      at: row.created_at,
      narrator,
      kind: row.type === "life_options" ? "options" : "narration",
      provenance,
      words: prose.split(/\s+/).filter(Boolean).length,
      turn: {
        narration: prose,
        offeredOptions: labelsOf(narrator === "gm" ? data["suggestedActions"] : data["actions"]),
        npcKeys: [],
        observations: [],
        walkOns: readWalkOnsEventData(data).map((w) => w.subject),
        proposedActionCount: 0,
      },
    });
  }
  return turns.sort((a, b) => a.at.localeCompare(b.at));
}

// ---------------------------------------------------------------------------
// What can be scored
// ---------------------------------------------------------------------------

/** No packet, no expectations: a check that needs neither. */
const BLANK: CheckContext = {
  packet: "",
  optionsRequested: false,
  knownNpcKeys: [],
  withheldTruths: [],
  mustStayQuiet: false,
  riskyIntent: false,
};

/** The prose rules, which read only what the narrator wrote. */
export const REPLAY_CHECKS: Check[] = [namesNoWayIn, endsOnTheWorld, opensOnSomething];

/**
 * The words a turn is expected to stay inside, from the eval's own scenarios
 * (`wordBudget` there). Reported as a share of turns over, since a real turn has
 * no budget of its own.
 */
export const REFERENCE_WORD_BUDGET: Record<Narrator, number> = { gm: 260, life: 180 };

/** One measure over a group of turns. */
export type Measure = {
  id: string;
  title: string;
  /** Turns it could be judged on. */
  applicable: number;
  /** Turns that broke it. */
  failed: number;
  examples: { turn: string; quote: string }[];
};

export type GroupStats = {
  narrator: Narrator;
  /** "unstamped" for turns written before provenance existed. */
  promptVersion: string;
  model: string;
  turns: number;
  campaigns: number;
  from: string;
  to: string;
  measures: Measure[];
  words: { median: number; p90: number; overBudget: number };
};

const EXAMPLES_KEPT = 3;

function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
}

function groupKey(t: ReplayTurn): string {
  return `${t.narrator}|${t.provenance?.promptVersion ?? "unstamped"}|${
    t.provenance?.servedModel ?? t.provenance?.model ?? "unknown"
  }`;
}

function measuresFor(turns: ReplayTurn[]): Measure[] {
  const measures: Measure[] = [];
  // Prose checks: every scene turn, not the options answers.
  const scenes = turns.filter((t) => t.kind === "narration");
  for (const check of REPLAY_CHECKS) {
    const m: Measure = {
      id: check.id,
      title: check.title,
      applicable: scenes.length,
      failed: 0,
      examples: [],
    };
    for (const t of scenes) {
      const found = check.run(t.turn, BLANK);
      if (found.length === 0) continue;
      m.failed += 1;
      if (m.examples.length < EXAMPLES_KEPT)
        m.examples.push({ turn: t.id, quote: found[0]!.quote });
    }
    measures.push(m);
  }
  // Figures stated: an upper bound, since the packet that may have sourced them is not here.
  const figures: Measure = {
    id: "states-a-figure",
    title:
      "states a price, distance, DV or long duration (upper bound: the engine may have said it first)",
    applicable: scenes.length,
    failed: 0,
    examples: [],
  };
  for (const t of scenes) {
    const found = noUnsourcedNumber.run(t.turn, BLANK);
    if (found.length === 0) continue;
    figures.failed += 1;
    if (figures.examples.length < EXAMPLES_KEPT)
      figures.examples.push({ turn: t.id, quote: found[0]!.quote });
  }
  measures.push(figures);
  return measures;
}

/** Score real turns, grouped by the narrator, prompt version and model that wrote them. */
export function replay(rows: LedgerRow[]): GroupStats[] {
  const groups = new Map<string, ReplayTurn[]>();
  for (const t of narrationTurns(rows)) {
    const key = groupKey(t);
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const stats: GroupStats[] = [];
  for (const turns of groups.values()) {
    const first = turns[0]!;
    const scenes = turns.filter((t) => t.kind === "narration");
    const words = scenes.map((t) => t.words).sort((a, b) => a - b);
    const budget = REFERENCE_WORD_BUDGET[first.narrator];
    stats.push({
      narrator: first.narrator,
      promptVersion: first.provenance?.promptVersion ?? "unstamped",
      model: first.provenance?.servedModel ?? first.provenance?.model ?? "unknown",
      turns: turns.length,
      campaigns: new Set(turns.map((t) => t.campaignId)).size,
      from: first.at,
      to: turns[turns.length - 1]!.at,
      measures: measuresFor(turns),
      words: {
        median: percentile(words, 0.5),
        p90: percentile(words, 0.9),
        overBudget: words.filter((w) => w > budget).length,
      },
    });
  }
  return stats.sort((a, b) => a.from.localeCompare(b.from));
}

// ---------------------------------------------------------------------------
// Version against version
// ---------------------------------------------------------------------------

export type Step = {
  narrator: Narrator;
  model: string;
  before: string;
  after: string;
  moves: {
    id: string;
    title: string;
    cleanBefore: number;
    runsBefore: number;
    cleanAfter: number;
    runsAfter: number;
    verdict: ReturnType<typeof verdictOf>;
  }[];
};

/**
 * Each version set against the one before it, for the same narrator on the same
 * model. A version that ran on a different model is not compared: the change
 * could be the model, and the report says so rather than guessing.
 */
export function steps(groups: GroupStats[]): Step[] {
  const out: Step[] = [];
  const byLine = new Map<string, GroupStats[]>();
  for (const g of groups)
    byLine.set(`${g.narrator}|${g.model}`, [...(byLine.get(`${g.narrator}|${g.model}`) ?? []), g]);
  for (const line of byLine.values()) {
    for (let i = 1; i < line.length; i += 1) {
      const a = line[i - 1]!;
      const b = line[i]!;
      const moves: Step["moves"] = [];
      for (const m of b.measures) {
        const was = a.measures.find((x) => x.id === m.id);
        if (!was || was.applicable === 0 || m.applicable === 0) continue;
        moves.push({
          id: m.id,
          title: m.title,
          cleanBefore: was.applicable - was.failed,
          runsBefore: was.applicable,
          cleanAfter: m.applicable - m.failed,
          runsAfter: m.applicable,
          verdict: verdictOf(
            was.applicable - was.failed,
            was.applicable,
            m.applicable - m.failed,
            m.applicable,
          ),
        });
      }
      out.push({
        narrator: b.narrator,
        model: b.model,
        before: a.promptVersion,
        after: b.promptVersion,
        moves,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

const day = (iso: string) => iso.slice(0, 10);
const pct = (n: number, of: number) => (of === 0 ? "—" : `${((100 * n) / of).toFixed(1)}%`);

export function formatReplay(groups: GroupStats[]): string {
  if (groups.length === 0) return "No narration turns found in those rows.";
  const lines: string[] = [];
  const total = groups.reduce((n, g) => n + g.turns, 0);
  lines.push(
    `${total} narration turns in ${groups.length} group(s), by narrator, prompt version and model.`,
  );
  lines.push("");
  for (const g of groups) {
    lines.push(
      `${g.narrator.toUpperCase()} ${g.promptVersion} on ${g.model} · ${g.turns} turns · ${g.campaigns} campaign(s) · ${day(g.from)} to ${day(g.to)}`,
    );
    for (const m of g.measures) {
      if (m.applicable === 0) continue;
      lines.push(
        `  ${String(m.failed).padStart(4)}/${String(m.applicable).padEnd(5)} ${pct(m.failed, m.applicable).padStart(6)}  ${m.title}`,
      );
      for (const e of m.examples)
        lines.push(`             ${e.turn.slice(0, 8)}: "${e.quote.slice(0, 150)}"`);
    }
    lines.push(
      `  prose: median ${g.words.median} words, 90th percentile ${g.words.p90}, ${g.words.overBudget} over the eval's ${REFERENCE_WORD_BUDGET[g.narrator]}-word reference`,
    );
    lines.push("");
  }
  const moved = steps(groups);
  if (moved.length > 0) {
    lines.push("Each version against the one before it (same narrator, same model)");
    for (const s of moved) {
      lines.push(`  ${s.narrator.toUpperCase()} ${s.before} -> ${s.after} on ${s.model}`);
      const notable = s.moves.filter((m) => m.verdict !== "same");
      if (notable.length === 0) lines.push("    nothing moved");
      for (const m of notable) {
        lines.push(
          `    ${m.verdict.padEnd(9)} ${m.cleanBefore}/${m.runsBefore} -> ${m.cleanAfter}/${m.runsAfter}  ${m.title}`,
        );
      }
    }
    lines.push("");
  }
  lines.push(
    "Read this as a lead, not a result. The two versions were played by different people on different nights,",
    "the turns of one campaign are more alike than turns of two, and the packet each turn was written from",
    "is not in the ledger. `bun run eval` asks both versions the same questions and is what confirms a move.",
  );
  return lines.join("\n");
}
