/**
 * Two turns that differ in ONE input, and what must and must not change.
 *
 * WHY THIS EXISTS. The single-turn checks ask whether one turn broke a rule.
 * They cannot ask the question a rule like "sex and age colour a stranger's
 * first assumption and never a difficulty" is really about, because that is a
 * statement about a DIFFERENCE: give the narrator the same scene twice, once
 * with a 71-year-old man and once with a 22-year-old woman, and the dice must
 * come out the same while the fiction does not. Neither half can be seen in
 * one turn. A prompt that ignores the line passes every single-turn check; a
 * prompt that lets it move the numbers passes them too.
 *
 * The same shape measures the Role rule: the same alley for a Solo and a
 * Netrunner, where the options are supposed to diverge.
 *
 * A model is nondeterministic, so every comparison is between the runs of one
 * variant and the runs of the other, and a difference only counts when it is
 * larger than the model differing from itself. Pure, so CI tests it against
 * hand-written turns.
 */
import type { CheckableTurn, Finding } from "./narratorChecks";

export type PairedContext = {
  /** What each variant is called in a report. */
  labels: [string, string];
  /**
   * Words that would show the narrator used what the variant changed, one list
   * per variant: an old man's grey hair, a young woman's age. Authored, like a
   * withheld truth's tells, because only the scenario's author knows the words.
   */
  cues?: [string[], string[]];
  /** The dice must not depend on the difference. */
  sameDice?: boolean;
  /** The offered options must differ by more than the model's own variation. */
  optionsDiffer?: boolean;
};

export type PairedCheck = {
  id: string;
  title: string;
  source: string;
  applies(ctx: PairedContext): boolean;
  run(a: CheckableTurn[], b: CheckableTurn[], ctx: PairedContext): Finding[];
};

const range = (values: number[]) => `${Math.min(...values)}–${Math.max(...values)}`;

/**
 * The difference did not change the dice.
 *
 * Flags a skill whose difficulties in one variant are ALL above the other's, so
 * one lucky spread of the model's own variation cannot trip it, and flags one
 * side always being sent to the dice while the other never is.
 */
export const readingDoesNotMoveTheDice: PairedCheck = {
  id: "reading-does-not-move-the-dice",
  title: "the difference moved no difficulty and skipped no roll",
  source:
    'APPEARANCE_RULE: "It never changes a difficulty, a price, a roll or an outcome. Those belong to the engine."',
  applies: (ctx) => ctx.sameDice === true,
  run(a, b, ctx) {
    const findings: Finding[] = [];
    const rolled = (turns: CheckableTurn[]) =>
      turns.map((t) => (t.checks?.length ?? 0) + (t.opposed?.length ?? 0));
    const ra = rolled(a);
    const rb = rolled(b);
    const [la, lb] = ctx.labels;
    if (ra.every((n) => n > 0) && rb.every((n) => n === 0)) {
      findings.push({
        quote: `${la}: rolled every run; ${lb}: never`,
        note: "whether to roll changed",
      });
    } else if (rb.every((n) => n > 0) && ra.every((n) => n === 0)) {
      findings.push({
        quote: `${lb}: rolled every run; ${la}: never`,
        note: "whether to roll changed",
      });
    }
    const dvs = (turns: CheckableTurn[]) => {
      const bySkill = new Map<string, number[]>();
      for (const t of turns) {
        for (const c of t.checks ?? [])
          bySkill.set(c.skillId, [...(bySkill.get(c.skillId) ?? []), c.dv]);
      }
      return bySkill;
    };
    const da = dvs(a);
    const db = dvs(b);
    for (const [skill, x] of da) {
      const y = db.get(skill);
      if (!y) continue;
      if (Math.min(...x) > Math.max(...y) || Math.min(...y) > Math.max(...x)) {
        findings.push({
          quote: `${skill}: ${la} DV ${range(x)}, ${lb} DV ${range(y)}`,
          note: "every run of one variant was harder than every run of the other",
        });
      }
    }
    // The opposition the narrator chose: the porter's skill plus his STAT. This is
    // where a reading of who is asking could quietly become a harder fight.
    const strength = (turns: CheckableTurn[]) =>
      turns.flatMap((t) => (t.opposed ?? []).map((o) => o.opposingTotal));
    const sa = strength(a);
    const sb = strength(b);
    if (sa.length > 0 && sb.length > 0) {
      if (Math.min(...sa) > Math.max(...sb) || Math.min(...sb) > Math.max(...sa)) {
        findings.push({
          quote: `opposition: ${la} ${range(sa)}, ${lb} ${range(sb)}`,
          note: "every run of one variant faced stronger opposition than every run of the other",
        });
      }
    }
    return findings;
  },
};

const prose = (t: CheckableTurn) => [t.narration, ...t.offeredOptions].join(" ").toLowerCase();

/**
 * A cue is a whole word ("kid" is not "kidnap", "miss" is not "missing"), or a
 * stem when it ends in `*` ("seventy*" is "seventy-one" and "seventy-odd").
 */
export function mentions(text: string, cue: string): boolean {
  const stem = cue.endsWith("*");
  const escaped = (stem ? cue.slice(0, -1) : cue).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}${stem ? "" : "\\b"}`, "i").test(text);
}

/**
 * The narrator used what it was told.
 *
 * At least half the runs of a variant must reach for one of its cues. This is
 * the uptake half of the rule: a line the model ignores in every run is dead
 * weight in the packet, and no single-turn check can see that.
 */
export const usesTheReading: PairedCheck = {
  id: "uses-the-reading",
  title: "the narrator used the difference it was given",
  source:
    'APPEARANCE_RULE: "Let it colour the FIRST beat of a meeting"; ROLE_MOVE_RULE: "answer this scene the way that person would look at it."',
  applies: (ctx) => ctx.cues !== undefined,
  run(a, b, ctx) {
    const findings: Finding[] = [];
    const variants: [CheckableTurn[], string, string[]][] = [
      [a, ctx.labels[0], ctx.cues?.[0] ?? []],
      [b, ctx.labels[1], ctx.cues?.[1] ?? []],
    ];
    for (const [turns, label, cues] of variants) {
      if (cues.length === 0) continue;
      const hits = turns.filter((t) => cues.some((cue) => mentions(prose(t), cue))).length;
      if (hits < Math.ceil(turns.length / 2)) {
        findings.push({
          quote: `${label}: ${hits}/${turns.length} runs used any of ${cues.slice(0, 6).join(", ")}${cues.length > 6 ? "…" : ""}`,
          note: "the line was in the packet and the prose did not show it",
        });
      }
    }
    return findings;
  },
};

const words = (t: CheckableTurn) =>
  new Set(
    t.offeredOptions
      .join(" ")
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 3),
  );

export function jaccard(x: Set<string>, y: Set<string>): number {
  if (x.size === 0 && y.size === 0) return 1;
  let both = 0;
  for (const w of x) if (y.has(w)) both += 1;
  return both / (x.size + y.size - both);
}

const mean = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length;

function within(turns: CheckableTurn[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < turns.length; i += 1) {
    for (let j = i + 1; j < turns.length; j += 1)
      out.push(jaccard(words(turns[i]!), words(turns[j]!)));
  }
  return out;
}

/**
 * The options differ more between the variants than the model differs from
 * itself.
 *
 * Compares how alike two runs of the SAME variant are with how alike a run of
 * one and a run of the other are. If the cross-variant options are no less
 * alike than a variant's own runs, the difference changed nothing beyond
 * ordinary variation. Needs two runs of each to have a variation to compare
 * with, and says nothing with fewer.
 */
export const optionsDiverge: PairedCheck = {
  id: "options-diverge",
  title: "the options differ more between the two than the model differs from itself",
  source:
    'ROLE_MOVE_RULE: "A Fixer, a Nomad and a Lawman standing in the same alley do not see the same three options."',
  applies: (ctx) => ctx.optionsDiffer === true,
  run(a, b, ctx) {
    const own = [...within(a), ...within(b)];
    if (own.length === 0) return [];
    const across = a.flatMap((x) => b.map((y) => jaccard(words(x), words(y))));
    const alikeWithin = mean(own);
    const alikeAcross = mean(across);
    if (alikeAcross <= alikeWithin - 0.05) return [];
    return [
      {
        quote: `options overlap ${(alikeAcross * 100).toFixed(0)}% across ${ctx.labels.join(" / ")}, ${(alikeWithin * 100).toFixed(0)}% between runs of one`,
        note: "the difference changed no more than the model's own variation",
      },
    ];
  },
};

export const ALL_PAIRED_CHECKS: PairedCheck[] = [
  readingDoesNotMoveTheDice,
  usesTheReading,
  optionsDiverge,
];
