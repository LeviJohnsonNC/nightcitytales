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

describe("the Complete Package point-buy", () => {
  const html = (stats: Record<string, number>) =>
    renderToStaticMarkup(<StatsPanel state={state({ method: "complete_package", stats })} />);
  const spent = Object.fromEntries(STAT_ORDER.map((s) => [s, 2]));
  // Six 8s, then 2, 6, 2, 4: sixty-two points exactly.
  const SPENT_ALL = {
    ...spent,
    int: 8,
    ref: 8,
    dex: 8,
    tech: 8,
    cool: 8,
    will: 8,
    luck: 2,
    move: 6,
    body: 2,
    emp: 4,
  };

  it("draws a card per STAT with the number, a pip scale, and a lower and a raise", () => {
    const out = html(spent);
    for (const stat of STAT_ORDER) {
      expect(out).toContain(`aria-label="Lower ${stat.toUpperCase()}"`);
      expect(out).toContain(`aria-label="Raise ${stat.toUpperCase()}"`);
      expect(out).toContain(`aria-label="What is ${stat.toUpperCase()} good for?"`);
    }
    // Seven pips a card, one per point from 2 to 8, described for a screen reader.
    expect(out.split('aria-label="2 on a scale of 2 to 8"').length - 1).toBe(STAT_ORDER.length);
    expect(out.split("<i ").length - 1).toBe(STAT_ORDER.length * 7);
  });

  it("tags the top of the scale, and the edge and the weak spot, only when they exist", () => {
    expect(html(spent)).not.toContain("MAX");
    expect(html(spent)).not.toContain("EDGE");
    expect(html(spent)).not.toContain("WEAK");
    // Shaped and spent to the last point: 8 + 8 + 8 + 8 + 8 + 8 + 2 + 6 + 2 + 4.
    const shaped = {
      ...spent,
      int: 8,
      ref: 8,
      dex: 8,
      tech: 8,
      cool: 8,
      will: 8,
      luck: 2,
      move: 6,
      body: 2,
      emp: 4,
    };
    // Mid-build the extremes are arbitrary, so nothing is named yet.
    expect(html({ ...spent, dex: 8 })).not.toContain("EDGE");
    const out = html(shaped);
    expect(out).toContain("MAX");
    expect(out).toContain("EDGE");
    expect(out).toContain("WEAK");
  });

  it("has no typed numbers, no min-and-max line and no explainer", () => {
    const out = html(spent);
    expect(out).not.toContain("<input");
    expect(out).not.toMatch(/of 62 spent/);
    expect(out).not.toMatch(/min 2/);
    expect(out).not.toContain("You can go over budget");
  });

  it("shows what is left, and says so once it is all spent", () => {
    expect(html(spent)).toContain(">42<");
    expect(html(spent)).not.toContain("All spent");
    const full = SPENT_ALL;
    expect(html(full)).toContain("All spent");
  });

  it("stops the raise buttons when the pool is empty or the STAT is full", () => {
    const full = SPENT_ALL;
    const out = html(full);
    // Nothing left to spend, so every raise is disabled, including on the 2s.
    const raises = out.match(/<button[^>]*aria-label="Raise [A-Z]+"[^>]*>/g) ?? [];
    expect(raises).toHaveLength(STAT_ORDER.length);
    expect(raises.every((tag) => tag.includes("disabled"))).toBe(true);
    // A 2 cannot be lowered.
    const lowerLuck = out.match(/<button[^>]*aria-label="Lower LUCK"[^>]*>/)?.[0] ?? "";
    expect(lowerLuck).toContain("disabled");
  });

  it("makes the derived tiles something you can open", () => {
    const out = html(spent);
    for (const title of ["Hit Points", "Seriously Wounded", "Death Save", "Humanity"]) {
      expect(out).toContain(`aria-label="What is ${title}?"`);
    }
    expect(out).toContain(`aria-label="What is INT good for?"`);
  });
});
