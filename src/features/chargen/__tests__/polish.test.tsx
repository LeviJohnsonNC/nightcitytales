/**
 * Phase six: rolls that count, what the STATs make you, and a handle from the
 * fixer.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CHARGEN_HOUSE_RULES_ARE_HOUSE_RULE,
  STAT_ORDER,
  STAT_REROLLS,
  statRerollsLeft,
  statRollCost,
  type StatBlock,
} from "@/engine";
import { BACKGROUND_JOBS } from "@/lib/background.jobs";
import { StatsPanel } from "../StatsPanel";
import { buildHandleInput, parseHandles } from "../handleSuggestions";
import { STAT_GLANCE } from "../statFlavor";
import { useChargenStore, type ChargenState } from "../store";

const STATS: StatBlock = {
  int: 6,
  ref: 8,
  dex: 6,
  tech: 5,
  cool: 6,
  will: 5,
  luck: 5,
  move: 6,
  body: 6,
  emp: 3,
};

function draft(over: Partial<ChargenState> = {}): ChargenState {
  return { ...useChargenStore.getState(), ...over };
}

describe("rolls that count", () => {
  it("is a house rule, with at least one reroll to spend", () => {
    expect(CHARGEN_HOUSE_RULES_ARE_HOUSE_RULE).toBe(true);
    expect(STAT_REROLLS).toBeGreaterThanOrEqual(1);
  });

  it("lets a first roll through free, and charges a reroll until there are none", () => {
    expect(statRollCost({ alreadyRolled: false, used: 99 })).toEqual({
      allowed: true,
      spends: false,
    });
    expect(statRollCost({ alreadyRolled: true, used: 0 })).toEqual({
      allowed: true,
      spends: true,
    });
    expect(statRollCost({ alreadyRolled: true, used: STAT_REROLLS })).toEqual({
      allowed: false,
      spends: true,
    });
    expect(statRerollsLeft(STAT_REROLLS + 5)).toBe(0);
  });
});

describe("what the STATs make you", () => {
  it("has a line for the best and the worst of every STAT, in the house voice", () => {
    for (const stat of STAT_ORDER) {
      for (const line of [STAT_GLANCE[stat].high, STAT_GLANCE[stat].low]) {
        expect(line, stat).toBeTruthy();
        expect(line, stat).not.toMatch(/\d|—/);
      }
    }
  });

  it("names the edge and the weak spot once every STAT is in", () => {
    const html = renderToStaticMarkup(
      <StatsPanel state={draft({ method: "streetrat", roleId: "solo", stats: STATS })} />,
    );
    expect(html).toContain("Your edge");
    expect(html).toContain("REF 8");
    expect(html).toContain(STAT_GLANCE.ref.high);
    expect(html).toContain("Your weak spot");
    expect(html).toContain("EMP 3");
    expect(html).toContain(STAT_GLANCE.emp.low);
    const partial = renderToStaticMarkup(
      <StatsPanel state={draft({ method: "streetrat", roleId: "solo", stats: { int: 6 } })} />,
    );
    expect(partial).not.toContain("Your edge");
  });

  it("lists every edge and every weak spot when there are several", () => {
    const many = { ...STATS, int: 8, dex: 8, luck: 7, ref: 2, emp: 3, tech: 3 };
    const html = renderToStaticMarkup(
      <StatsPanel state={draft({ method: "streetrat", roleId: "solo", stats: many })} />,
    );
    expect(html).toContain("Your edges");
    expect(html).toContain("Your weak spots");
    for (const stat of ["int", "dex", "luck"] as const)
      expect(html).toContain(STAT_GLANCE[stat].high);
    for (const stat of ["ref", "emp", "tech"] as const)
      expect(html).toContain(STAT_GLANCE[stat].low);
  });

  it("tells a roller the first roll stands", () => {
    const html = renderToStaticMarkup(
      <StatsPanel state={draft({ method: "edgerunner", roleId: "solo" })} />,
    );
    expect(html).toContain("First roll stands");
    expect(html).toContain("Roll all ten");
  });
});

describe("a handle from the fixer", () => {
  it("is a job on the closed list the server owns", () => {
    expect(BACKGROUND_JOBS).toContain("handle_suggestions");
  });

  it("cleans the model's reply into five short, distinct names", () => {
    const reply = [
      "1. Static",
      '- "Lowlight"',
      "• Static",
      "Here are some ideas:",
      "Vic Salas",
      "Two Bits",
      "Glasswork",
      "Sixth Street Saint",
      "A very long handle that nobody could possibly shout across a bar",
      "Knuckles",
    ].join("\n");
    expect(parseHandles(reply, "Vic Salas")).toEqual([
      "Static",
      "Lowlight",
      "Two Bits",
      "Glasswork",
      "Sixth Street Saint",
    ]);
  });

  it("sends what the character already is, and never a number the engine owns as prose", () => {
    const input = buildHandleInput(
      draft({ roleId: "solo", method: "complete_package", stats: STATS }),
      "Solo",
    );
    expect(input.role).toBe("Solo");
    expect(input.bestStat).toBe("REF");
  });
});
