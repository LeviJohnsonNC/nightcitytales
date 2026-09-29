import { describe, expect, it } from "vitest";
import {
  compareRecords,
  fisherExact,
  formatComparison,
  formatSummary,
  median,
  passRate,
  summarize,
  type CheckRecord,
  type EvalRecord,
} from "../evalReport";

const check = (id: string, runs: number, failed: number[], quote = "5eb"): CheckRecord => ({
  id,
  title: `title of ${id}`,
  runs,
  failures: failed.map((run) => ({ run, findings: [{ quote }] })),
});

const record = (repeats: number, cells: Record<string, CheckRecord[]>): EvalRecord => ({
  version: 1,
  startedAt: "2026-09-29T00:00:00Z",
  provider: "test",
  prompts: { gm: "2.14.0", life: "2.22.0" },
  repeats,
  scenarios: Object.entries(cells).map(([id, checks]) => ({
    id,
    kind: "single",
    narrator: "life",
    about: "",
    model: "m",
    servedModels: ["m"],
    runs: [
      {
        seconds: 4,
        turn: {
          narration: "",
          offeredOptions: [],
          npcKeys: [],
          observations: [],
          walkOns: [],
          proposedActionCount: 0,
        },
      },
    ],
    checks,
  })),
});

describe("summarising a run", () => {
  it("counts cells and clean runs, and lists what broke worst first", () => {
    const r = record(3, {
      s1: [check("a", 3, []), check("b", 3, [0, 1, 2])],
      s2: [check("c", 3, [1])],
    });
    const s = summarize(r);
    expect(s.cells).toBe(3);
    expect(s.cleanRuns).toBe(3 + 0 + 2);
    expect(s.totalRuns).toBe(9);
    expect(s.failing.map((f) => f.check)).toEqual(["b", "c"]);
    expect(formatSummary(r)).toContain("0/3  s1 > title of b");
  });

  it("median handles even, odd and empty", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
    expect(passRate(check("a", 0, []))).toBe(1);
  });
});

describe("Fisher's exact test", () => {
  it("cannot call even the biggest swing at three runs a side, and can at five", () => {
    expect(fisherExact(3, 3, 0, 3)).toBeCloseTo(0.1, 6);
    expect(fisherExact(5, 5, 0, 5)).toBeCloseTo(0.00794, 4);
    expect(fisherExact(5, 5, 1, 5)).toBeCloseTo(0.0476, 3);
    expect(fisherExact(4, 5, 1, 5)).toBeGreaterThan(0.05);
  });

  it("is symmetric, and 1 when the counts match", () => {
    expect(fisherExact(5, 5, 1, 5)).toBeCloseTo(fisherExact(1, 5, 5, 5), 10);
    expect(fisherExact(4, 5, 4, 5)).toBeCloseTo(1, 10);
  });
});

describe("comparing two runs", () => {
  const before = record(5, {
    s1: [check("a", 5, []), check("b", 5, []), check("c", 5, [0]), check("gone", 5, [])],
    s2: [check("d", 5, [0, 1, 2, 3])],
  });
  const after = record(5, {
    s1: [
      check("a", 5, [0, 1, 2, 3]),
      check("b", 5, []),
      check("c", 5, [0, 1]),
      check("fresh", 5, []),
    ],
    s2: [check("d", 5, [])],
  });
  const verdicts = Object.fromEntries(
    compareRecords(before, after).changes.map((c) => [c.check, c.verdict]),
  );

  it("calls a swing a change only when chance is an unlikely explanation", () => {
    expect(verdicts["a"]).toBe("regressed"); // 5/5 -> 1/5
    expect(verdicts["d"]).toBe("improved"); // 1/5 -> 5/5
    expect(verdicts["c"]).toBe("unclear"); // 4/5 -> 3/5
    expect(verdicts["b"]).toBe("same");
  });

  it("does not call 3/3 against 0/3 a regression: two identical prompts once produced exactly that", () => {
    const x = compareRecords(
      record(3, { s: [check("a", 3, [])] }),
      record(3, { s: [check("a", 3, [0, 1, 2])] }),
    );
    expect(x.changes[0]!.verdict).toBe("unclear");
    expect(x.thin).toBe(true);
  });

  it("notices checks that only one run had", () => {
    expect(verdicts["fresh"]).toBe("new");
    expect(verdicts["gone"]).toBe("gone");
  });

  it("prints regressions first, with what the new run actually said", () => {
    const text = formatComparison(compareRecords(before, after));
    expect(text.indexOf("Got worse")).toBeLessThan(text.indexOf("Got better"));
    expect(text).toContain('run 1: "5eb"');
    expect(text).toContain("5/5 -> 1/5  s1 > title of a");
    expect(text).not.toContain("Fewer than 5 runs");
  });

  it("warns that too few runs cannot tell a worse prompt from an off day", () => {
    const thin = compareRecords(
      record(1, { s1: [check("a", 1, [])] }),
      record(1, { s1: [check("a", 1, [0])] }),
    );
    expect(thin.thin).toBe(true);
    expect(formatComparison(thin)).toContain("Fewer than 5 runs");
  });

  it("leaves out every side of a pair that failed under the pair's own name", () => {
    const a = record(3, { "p [x]": [check("a", 3, [])], "p [compared]": [check("b", 3, [])] });
    const b = record(3, { p: [] });
    b.scenarios[0]!.error = "no credit";
    const cmp = compareRecords(a, b);
    expect(cmp.changes).toEqual([]);
    expect(cmp.unmeasured).toEqual(["p"]);
  });

  it("does not read a scenario the model could not be asked as checks that were dropped", () => {
    const a = record(3, { s1: [check("a", 3, [])], s2: [check("b", 3, [])] });
    const b = record(3, { s1: [check("a", 3, [])], s2: [] });
    b.scenarios[1]!.error = "Rate limit exceeded";
    const cmp = compareRecords(a, b);
    expect(cmp.unmeasured).toEqual(["s2"]);
    expect(cmp.changes.map((c) => c.check)).toEqual(["a"]);
    expect(formatComparison(cmp)).toContain("Not compared");
    expect(formatSummary(b)).toContain("could not be asked: s2 (Rate limit exceeded)");
  });
});
