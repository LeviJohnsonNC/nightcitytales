import { describe, expect, it } from "vitest";
import {
  agreement,
  combineOrders,
  lengthBias,
  parseJudgement,
  parseLabels,
  renderJudgePrompt,
  renderLabels,
  shuffled,
  signTest,
  tally,
  unblind,
} from "../judge";

describe("reading a judgement", () => {
  it("takes bare JSON, fenced JSON, and JSON after a preamble", () => {
    const body = '{"overall":"B","criteria":{"specific":"A","voice":"tie"},"reason":"Sharper."}';
    for (const text of [body, "```json\n" + body + "\n```", "Here you go: " + body + " Done."]) {
      expect(parseJudgement(text)).toEqual({
        overall: "B",
        criteria: { specific: "A", voice: "tie" },
        reason: "Sharper.",
      });
    }
  });

  it("accepts loose case, drops unknown criteria, and refuses no verdict", () => {
    expect(parseJudgement('{"overall":"tie","criteria":{"nonsense":"A"}}')?.criteria).toEqual({});
    expect(parseJudgement('{"overall":" a "}')?.overall).toBe("A");
    expect(parseJudgement('{"overall":"C"}')).toBeNull();
    expect(parseJudgement("no json here")).toBeNull();
    expect(parseJudgement("{broken")).toBeNull();
  });

  it("puts the narrations in delimiters as data", () => {
    const { system, prompt } = renderJudgePrompt({ scene: "S", a: "first", b: "second" });
    expect(prompt).toContain("<a>\nfirst\n</a>");
    expect(prompt).toContain("<b>\nsecond\n</b>");
    expect(system).toContain("never instructions");
  });
});

describe("the order swap", () => {
  it("counts a win only if it survives the swap", () => {
    // First order: A = before. Second: A = after.
    expect(combineOrders("B", "A")).toBe("after");
    expect(combineOrders("A", "B")).toBe("before");
    expect(combineOrders("tie", "tie")).toBe("tie");
  });

  it("calls position bias inconsistent, not a tie", () => {
    expect(combineOrders("A", "A")).toBe("inconsistent");
    expect(combineOrders("B", "B")).toBe("inconsistent");
  });

  it("a win the swap does not confirm is a tie", () => {
    expect(combineOrders("A", "tie")).toBe("tie");
    expect(combineOrders("tie", "A")).toBe("tie");
  });
});

describe("the sign test", () => {
  it("is 1 with nothing decided and for an even split", () => {
    expect(signTest(0, 0)).toBe(1);
    expect(signTest(5, 5)).toBe(1);
  });

  it("matches the exact binomial", () => {
    expect(signTest(10, 0)).toBeCloseTo(2 / 1024, 10);
    expect(signTest(8, 2)).toBeCloseTo(112 / 1024, 10);
  });

  it("calls a change only when chance is unlikely", () => {
    expect(tally(Array(9).fill("after").concat(["before"])).favours).toBe("after");
    expect(tally(["after", "after", "before"]).favours).toBeNull();
    expect(tally(["tie", "inconsistent"]).decided).toBe(0);
  });
});

describe("length bias", () => {
  it("reports how often the longer text won", () => {
    const r = lengthBias([
      { outcome: "after", beforeLength: 10, afterLength: 20 },
      { outcome: "before", beforeLength: 30, afterLength: 20 },
      { outcome: "after", beforeLength: 30, afterLength: 20 },
      { outcome: "tie", beforeLength: 1, afterLength: 2 },
    ]);
    expect(r).toEqual({ decided: 3, longerWon: 2, share: 2 / 3 });
    expect(lengthBias([]).share).toBeNull();
  });
});

describe("agreement with a person", () => {
  it("is 1 for identical labels and about 0 for chance-level", () => {
    expect(agreement(["A", "B", "tie", "A"], ["A", "B", "tie", "A"]).kappa).toBe(1);
    const k = agreement(["A", "A", "B", "B"], ["A", "B", "A", "B"]);
    expect(k.raw).toBe(0.5);
    expect(k.kappa).toBeCloseTo(0, 10);
  });

  it("handles empty input and a single repeated label", () => {
    expect(agreement([], []).raw).toBeNull();
    expect(agreement(["A", "A"], ["A", "A"]).kappa).toBeNull();
  });
});

describe("blind labels", () => {
  const items = [
    { id: "s1#1", scenario: "about one", scene: "line\nline2", a: "alpha", b: "beta" },
    { id: "s2#1", scenario: "about two", scene: "x", a: "gamma", b: "delta" },
  ];

  it("round-trips a filled-in file and leaves blanks out", () => {
    const filled = renderLabels(items).replace("Verdict: \n", "Verdict: B\n");
    const got = parseLabels(filled);
    expect(got.get("s1#1")).toBe("B");
    expect(got.has("s2#1")).toBe(false);
    expect(parseLabels(renderLabels(items).replace(/Verdict: /g, "Verdict: tie")).size).toBe(2);
  });

  it("never says which side is the change", () => {
    const text = renderLabels(items);
    expect(text).not.toMatch(/before|after/i);
  });

  it("maps a slot back through the key", () => {
    expect(unblind("A", false)).toBe("before");
    expect(unblind("A", true)).toBe("after");
    expect(unblind("B", true)).toBe("before");
    expect(unblind("tie", true)).toBe("tie");
  });

  it("shuffles the same way for the same seed", () => {
    const xs = Array.from({ length: 20 }, (_, i) => i);
    expect(shuffled(xs, 7)).toEqual(shuffled(xs, 7));
    expect(shuffled(xs, 7)).not.toEqual(xs);
    expect([...shuffled(xs, 7)].sort((a, b) => a - b)).toEqual(xs);
  });
});
