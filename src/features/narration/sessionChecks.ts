/**
 * What only shows over several turns.
 *
 * Every check in `narratorChecks.ts` looks at one turn, so a narrator that is
 * fine each time and wrong across a scene passes all of them: the room described
 * again on the fourth turn, the bartender's line quoted back a second time, the
 * same closing beat on every reply. A session is a scripted run of turns in one
 * scene, each answered by the model and fed into the next turn's RECENT block the
 * way play feeds it. These are the detectors for what that shows.
 *
 * Pure and model-free like the rest: `evals/` runs them on live sessions, and
 * `sessionChecks.test.ts` runs them on hand-written prose in CI. The single-turn
 * checks still run on every turn of a session; these are only the ones that need
 * more than one.
 */
import type { CheckableTurn, Finding } from "./narratorChecks";

export type SessionCheck = {
  id: string;
  title: string;
  /** Where the rule is written down. */
  source: string;
  /** Findings across the whole session; `turn` is the 1-based turn each one was found in. */
  run(turns: CheckableTurn[]): (Finding & { turn: number })[];
};

/**
 * How many words in a row a later turn may share with an earlier one before it
 * counts as saying it again. A name, a place and a verb recur honestly ("the
 * bartender wipes the counter" is four words); a whole clause coming back is not.
 * A guess, held in one place so it can be tuned from real sessions.
 */
export const REPEAT_RUN_WORDS = 7;

/** Lowercase words with their original spans, punctuation dropped. */
function wordsOf(text: string): { word: string; start: number; end: number }[] {
  const out: { word: string; start: number; end: number }[] = [];
  for (const m of text.matchAll(/[\p{L}\p{N}'’]+/gu)) {
    out.push({
      word: m[0].toLowerCase().replace(/’/g, "'"),
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
    });
  }
  return out;
}

/**
 * The longest runs of words `later` shares with `earlier`, at least
 * `REPEAT_RUN_WORDS` long, quoted as they appear in `later`.
 */
export function sharedRuns(earlier: string, later: string, minWords = REPEAT_RUN_WORDS): string[] {
  const a = wordsOf(earlier).map((w) => w.word);
  const b = wordsOf(later);
  const seen = new Set<string>();
  for (let i = 0; i + minWords <= a.length; i += 1) seen.add(a.slice(i, i + minWords).join(" "));
  const runs: string[] = [];
  let i = 0;
  while (i + minWords <= b.length) {
    if (
      !seen.has(
        b
          .slice(i, i + minWords)
          .map((w) => w.word)
          .join(" "),
      )
    ) {
      i += 1;
      continue;
    }
    // Extend while the next window is also shared, so a long echo is one finding.
    let end = i + minWords;
    while (
      end < b.length &&
      seen.has(
        b
          .slice(end - minWords + 1, end + 1)
          .map((w) => w.word)
          .join(" "),
      )
    ) {
      end += 1;
    }
    runs.push(later.slice(b[i]!.start, b[end - 1]!.end));
    i = end;
  }
  return runs;
}

export const doesNotRepeatItself: SessionCheck = {
  id: "does-not-repeat-itself",
  title: "did not say again what an earlier turn already said",
  source:
    'narratorRules.ts ALREADY_HERE_LINE: "DO NOT DESCRIBE IT AGAIN, not the room, not the smell, not the light."',
  run(turns) {
    const findings: (Finding & { turn: number })[] = [];
    for (let t = 1; t < turns.length; t += 1) {
      const said = turns[t]!.narration;
      for (let e = 0; e < t; e += 1) {
        for (const run of sharedRuns(turns[e]!.narration, said)) {
          findings.push({ turn: t + 1, quote: run, note: `already said in turn ${e + 1}` });
        }
      }
    }
    return findings;
  },
};

export const ALL_SESSION_CHECKS: SessionCheck[] = [doesNotRepeatItself];
