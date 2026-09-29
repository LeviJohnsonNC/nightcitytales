import { describe, expect, it } from "vitest";
import { formatReplay, narrationTurns, replay, steps, type LedgerRow } from "../ledgerReplay";
import { verdictOf } from "../evalReport";

/**
 * Real turns, replayed. The rows here have the shape `playOps.ts` and
 * `lifeOps.ts` write into `campaign_events`: the prose in `summary`, the
 * options and walk-ons and provenance in `data`.
 */

let n = 0;
const stamp = (narrator: "gm" | "life", version: string, model = "m") => ({
  provenance: { narrator, prompt_version: version, model, served_model: model },
});

function row(over: Partial<LedgerRow> & { summary: string }): LedgerRow {
  n += 1;
  return {
    id: `row-${n}`,
    campaign_id: "c1",
    type: "life_narration",
    data: stamp("life", "2.22.0"),
    created_at: `2026-09-${String(10 + (n % 15)).padStart(2, "0")}T12:00:00Z`,
    ...over,
  };
}

describe("reading narration turns out of the ledger", () => {
  it("takes the three narration types, and leaves every other event alone", () => {
    const turns = narrationTurns([
      row({ type: "gm_narration", summary: "The corridor hums.", data: stamp("gm", "2.14.0") }),
      row({ type: "life_narration", summary: "Rain on the window." }),
      row({ type: "life_options", summary: "You are at the counter." }),
      row({ type: "dice_roll", summary: "rolled 7" }),
      row({ type: "phase_changed", summary: "Job" }),
    ]);
    expect(turns.map((t) => [t.narrator, t.kind])).toEqual([
      ["gm", "narration"],
      ["life", "narration"],
      ["life", "options"],
    ]);
  });

  it("reads options whether they are objects or bare strings, from the field each narrator writes", () => {
    const [gm, life] = narrationTurns([
      row({
        type: "gm_narration",
        summary: "A door.",
        data: {
          ...stamp("gm", "2.14.0"),
          suggestedActions: [{ label: "Knock", skill: null }, "Wait"],
        },
      }),
      row({
        summary: "A bar.",
        data: { ...stamp("life", "2.22.0"), actions: [{ label: "Order" }] },
      }),
    ]);
    expect(gm!.turn.offeredOptions).toEqual(["Knock", "Wait"]);
    expect(life!.turn.offeredOptions).toEqual(["Order"]);
  });

  it("keeps a turn that has no provenance, and does not choke on data that is not an object", () => {
    const turns = narrationTurns([
      row({ summary: "Old turn.", data: {} }),
      row({ summary: "Odd turn.", data: null }),
      row({ summary: "Bad turn.", data: "text" }),
      row({ summary: "   " }),
      row({ summary: null as unknown as string }),
    ]);
    expect(turns).toHaveLength(3);
    expect(turns.every((t) => t.provenance === null)).toBe(true);
  });

  it("counts a turn's words", () => {
    const [t] = narrationTurns([row({ summary: "one two  three\nfour" })]);
    expect(t!.words).toBe(4);
  });
});

describe("scoring real turns", () => {
  const turns = (version: string, prose: string[], type = "life_narration") =>
    prose.map((summary) =>
      row({
        type,
        summary,
        data: stamp(type === "gm_narration" ? "gm" : "life", version),
      }),
    );

  it("groups by narrator, prompt version and model, and counts the prose rules per group", () => {
    const rows = [
      ...turns("2.22.0", [
        "The bar is quiet.",
        "You could try the back door, or perhaps wait.",
        "Rain. What do you do?",
        "The room smells of smoke, sweat, and old beer.",
      ]),
      ...turns("2.23.0", ["A clean turn.", "Another clean turn."]),
    ];
    const groups = replay(rows);
    expect(groups).toHaveLength(2);
    const [old, current] = groups;
    expect([old!.promptVersion, old!.turns]).toEqual(["2.22.0", 4]);
    const failed = Object.fromEntries(old!.measures.map((m) => [m.id, m.failed]));
    expect(failed["names-no-way-in"]).toBe(1);
    expect(failed["ends-on-the-world"]).toBe(1);
    expect(failed["opens-on-something"]).toBe(1);
    expect(current!.measures.every((m) => m.failed === 0)).toBe(true);
  });

  it("quotes what broke a rule, so a report shows the sentence", () => {
    const [g] = replay(turns("2.22.0", ["You could try the back door."]));
    const example = g!.measures.find((m) => m.id === "names-no-way-in")!.examples[0]!;
    expect(example.quote).toContain("You could");
  });

  it("does not hold an options answer to the prose rules of a scene", () => {
    const [g] = replay(
      turns("2.22.0", ["You could try the door. What do you do?"], "life_options"),
    );
    expect(g!.measures.find((m) => m.id === "names-no-way-in")!.applicable).toBe(0);
  });

  it("reports figures as an upper bound, and lets a short duration through", () => {
    const [g] = replay(
      turns("2.22.0", [
        "A bowl of noodles, 5eb if you are not fussy.",
        "The silence holds for four seconds.",
        "It takes twenty minutes.",
      ]),
    );
    const m = g!.measures.find((x) => x.id === "states-a-figure")!;
    expect(m.failed).toBe(2);
    expect(m.title).toContain("upper bound");
  });

  it("never scores 'options only when asked', because engine travel cards look like narrator options", () => {
    const [g] = replay([
      row({
        summary: "No trip could be worked out.",
        data: { ...stamp("life", "2.22.0"), actions: [{ label: "Go to the Paper Lantern" }] },
      }),
    ]);
    expect(g!.measures.some((m) => m.id === "options-only-when-asked")).toBe(false);
  });

  it("puts unstamped turns in a group of their own, and a swapped model in another", () => {
    const groups = replay([
      row({ summary: "Old.", data: {} }),
      row({ summary: "New.", data: stamp("life", "2.22.0", "model-a") }),
      row({ summary: "Swapped.", data: stamp("life", "2.22.0", "model-b") }),
    ]);
    expect(groups.map((g) => `${g.promptVersion} on ${g.model}`).sort()).toEqual([
      "2.22.0 on model-a",
      "2.22.0 on model-b",
      "unstamped on unknown",
    ]);
  });

  it("measures prose length: the median, the 90th percentile, and turns over the reference", () => {
    const long = Array(300).fill("word").join(" ");
    const [g] = replay(turns("2.22.0", ["short one", "short two", long]));
    expect(g!.words.median).toBe(2);
    expect(g!.words.p90).toBe(300);
    expect(g!.words.overBudget).toBe(1);
  });
});

describe("one version against the one before it", () => {
  const bad = "You could try the door.";
  const fine = "The door is shut.";
  const many = (version: string, prose: string, count: number, model = "m") =>
    Array.from({ length: count }, () =>
      row({ summary: prose, data: stamp("life", version, model) }),
    );

  it("calls a big enough move a change, and says so with the counts", () => {
    const rows = [...many("2.22.0", bad, 40), ...many("2.23.0", fine, 40)];
    rows.forEach(
      (r, i) =>
        (r.created_at = `2026-09-${String(1 + Math.floor(i / 4)).padStart(2, "0")}T00:00:00Z`),
    );
    const [step] = steps(replay(rows));
    const move = step!.moves.find((m) => m.id === "names-no-way-in")!;
    expect(move.verdict).toBe("improved");
    expect([move.cleanBefore, move.runsBefore, move.cleanAfter, move.runsAfter]).toEqual([
      0, 40, 40, 40,
    ]);
  });

  it("does not call a wobble on a few turns a change", () => {
    const rows = [
      ...many("2.22.0", fine, 6),
      ...many("2.23.0", bad, 1),
      ...many("2.23.0", fine, 5),
    ];
    rows.forEach((r, i) => (r.created_at = `2026-09-${String(1 + i).padStart(2, "0")}T00:00:00Z`));
    const [step] = steps(replay(rows));
    expect(step!.moves.find((m) => m.id === "names-no-way-in")!.verdict).toBe("unclear");
  });

  it("does not compare across a model change, because the change could be the model", () => {
    const rows = [...many("2.22.0", fine, 5, "model-a"), ...many("2.23.0", bad, 5, "model-b")];
    expect(steps(replay(rows))).toEqual([]);
  });

  it("prints the report, ends by saying it is a lead, and copes with nothing to read", () => {
    const rows = [...many("2.22.0", bad, 40), ...many("2.23.0", fine, 40)];
    const text = formatReplay(replay(rows));
    expect(text).toContain("LIFE 2.22.0 on m");
    expect(text).toContain("2.22.0 -> 2.23.0");
    expect(text).toContain("Read this as a lead, not a result");
    expect(formatReplay([])).toContain("No narration turns");
  });
});

describe("verdictOf", () => {
  it("is the rule eval:compare uses", () => {
    expect(verdictOf(5, 5, 5, 5)).toBe("same");
    expect(verdictOf(5, 5, 1, 5)).toBe("regressed");
    expect(verdictOf(1, 5, 5, 5)).toBe("improved");
    expect(verdictOf(3, 3, 0, 3)).toBe("unclear");
  });
});
