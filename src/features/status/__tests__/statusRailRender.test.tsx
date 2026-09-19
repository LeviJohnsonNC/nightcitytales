/**
 * The rail, server-rendered once.
 *
 * statusModel.test.ts proves the numbers; this proves the screen actually draws
 * them — that the runway reaches the chip, that a clock arrives as a dial rather
 * than a fraction, and that a commitment and a lead do not end up looking like
 * the same thing. `renderToStaticMarkup` needs no DOM, so it costs the suite
 * nothing and still catches a panel that throws.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { LifeClock, LifeSituation } from "@/engine";
import type { Campaign, CampaignVitals, FullCharacter } from "@/lib/backend";
import { statusView } from "../statusModel";
import { CommitmentsPanel, StatusRail, StatusStrip } from "../StatusRail";

const character = {
  character: { id: "ch1", name: "V", role: "solo" },
  skills: [{ skill_id: "handgun", level: 4, specialization: null }],
  finance: { improvement_points: 3, home_district_key: null },
} as unknown as FullCharacter;

const situations: LifeSituation[] = [
  {
    key: "rent",
    category: "need",
    title: "The landlord wants his money",
    summary: "Second notice under the door.",
    status: "live",
    severity: 4,
    dueDay: 12,
  },
  {
    key: "gig",
    category: "opportunity",
    title: "Somebody is asking after runners",
    summary: "A name at the bar.",
    status: "live",
    severity: 5,
  },
];

const clocks: LifeClock[] = [
  { key: "heat", label: "NCPD Heat", filled: 2, segments: 6, hidden: false },
];

const view = () =>
  statusView({
    campaign: { id: "c1", day: 10, bills_paid_through_day: 0 } as Campaign,
    vitals: { eurobucks: 4350 } as CampaignVitals,
    character,
    situations,
    clocks,
  });

describe("the rail renders", () => {
  const html = renderToStaticMarkup(<StatusRail status={view()} />);

  it("puts the balance on the money chip and nothing beside it", () => {
    expect(html).toContain("€4,350");
    expect(html).not.toContain("rent in");
    expect(html).not.toContain("€$");
  });

  it("leads the growth chip with the distance, not the name of the Skill", () => {
    expect(html).toMatch(/3 IP · \d+ to next Skill/);
    // The raise is still named where the choice is actually made — the panel
    // behind the chip, which statusModel still hands the whole SkillRaise to.
    expect(html).not.toContain("Handgun");
    expect(view().growth.next?.skillName).toBe("Handgun");
  });

  it("gives each chip a caret big enough to press", () => {
    // Three chips, three carets, each one a 2rem box rather than a 10px glyph.
    expect(html.split("lucide-chevron-down").length - 1).toBe(3);
    expect(html).toContain("size-8");
  });

  it("counts the commitments and not the leads", () => {
    // Two live situations, one of them an opportunity, plus a clock: the chip
    // says two, because the opportunity is not something the player took on.
    expect(html).toContain("2 open");
  });
});

describe("the commitments panel", () => {
  const html = renderToStaticMarkup(<CommitmentsPanel status={view().commitments} />);

  it("shows a due date a player can act on", () => {
    expect(html).toContain("due in 2 days");
  });

  it("draws a clock as its dial rather than printing a fraction alone", () => {
    expect(html).toContain("2/6");
    // Six segments, two of them filled with the destructive colour.
    expect(html.split("bg-destructive").length - 1).toBe(2);
    expect(html.split("bg-border").length - 1).toBe(4);
  });

  it("keeps leads out of the committed list and under their own heading", () => {
    expect(html).toContain("Going around");
    const committed = html.indexOf("Going around");
    expect(html.indexOf("The landlord wants his money")).toBeLessThan(committed);
    expect(html.indexOf("Somebody is asking after runners")).toBeGreaterThan(committed);
  });
});

describe("the collapsed strip", () => {
  it("carries all three facts on one line for a screen that cannot spare three", () => {
    const html = renderToStaticMarkup(<StatusStrip status={view()} />);
    expect(html).toContain("€4,350");
    expect(html).toContain("3 IP");
    expect(html).toContain("2 open");
  });
});
