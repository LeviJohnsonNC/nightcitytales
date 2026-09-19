/**
 * The STAT card, and the two creation steps that now share it with the sheet.
 *
 * The card is the one place a player reads a STAT, so it is worth pinning what
 * it actually draws: the number, the lit meter on the left edge, and the STAT's
 * own icon large in the space to the right that the label and the number leave
 * empty. A card with no value drawn yet lights nothing.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { STAT_ORDER } from "@/engine";
import { StatCard } from "../StatCard";
import { StatsPanel } from "../StatsPanel";
import type { ChargenState } from "../store";

const BADGE = "absolute right-2 top-1/2 size-12 -translate-y-1/2 opacity-40";

function state(over: Partial<ChargenState>): ChargenState {
  return {
    method: "streetrat",
    roleId: "solo",
    stats: {},
    statRolls: { row: null, rows: {} },
    ...over,
  } as unknown as ChargenState;
}

describe("a STAT card", () => {
  it("puts the icon large on the right rather than beside the label", () => {
    const html = renderToStaticMarkup(<StatCard stat="int" value={6} />);
    expect(html).toContain("lucide-brain");
    expect(html).toContain(BADGE);
    // The label keeps its three letters and nothing else.
    expect(html).toMatch(/>INT</);
  });

  it("lights the edge from the value, and lights nothing without one", () => {
    expect(renderToStaticMarkup(<StatCard stat="body" value={2} />)).toContain("height:18%");
    expect(renderToStaticMarkup(<StatCard stat="ref" value={8} />)).toContain("height:100%");
    const empty = renderToStaticMarkup(<StatCard stat="ref" value={undefined} />);
    expect(empty).not.toContain("height:");
    expect(empty).toContain("—");
  });

  it("carries whatever the step puts under the number", () => {
    const html = renderToStaticMarkup(
      <StatCard stat="luck" value={5}>
        <span>row 4</span>
      </StatCard>,
    );
    expect(html).toContain("row 4");
  });
});

describe("the STATs step of creation", () => {
  it("draws a rolled row on the same cards the sheet uses", () => {
    const html = renderToStaticMarkup(
      <StatsPanel state={state({ stats: { int: 6, ref: 8 }, statRolls: { row: 3, rows: {} } })} />,
    );
    expect(html.split(BADGE).length - 1).toBe(STAT_ORDER.length);
    expect(html).toContain("lucide-brain");
  });

  it("keeps the die on the card when each STAT is rolled one at a time", () => {
    const html = renderToStaticMarkup(
      <StatsPanel
        state={state({
          method: "edgerunner",
          stats: { int: 6 },
          statRolls: { row: null, rows: {} },
        })}
      />,
    );
    expect(html.split(BADGE).length - 1).toBe(STAT_ORDER.length);
    expect(html).toContain('data-stat-die-wrap="int"');
  });

  it("drops the band legend, which the ramp on the cards replaced", () => {
    for (const method of ["streetrat", "edgerunner"] as const) {
      const html = renderToStaticMarkup(<StatsPanel state={state({ method })} />);
      expect(html).not.toContain("STAT strength legend");
    }
  });
});
