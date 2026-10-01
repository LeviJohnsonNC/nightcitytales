import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { LifeClock, LifeSituation } from "@/engine";
import type { Campaign, CampaignVitals, FullCharacter } from "@/lib/backend";
import { statusView } from "@/features/status/statusModel";
import { CharacterCard } from "../CharacterCard";
import { DockTile } from "../DockTile";
import { ResourceStrip } from "../ResourceStrip";

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
    summary: "Second notice.",
    status: "live",
    severity: 4,
    dueDay: 10,
  },
];
const clocks: LifeClock[] = [];

const status = statusView({
  campaign: { id: "c1", day: 10, bills_paid_through_day: 0 } as Campaign,
  vitals: { eurobucks: 1540 } as CampaignVitals,
  character,
  situations,
  clocks,
});

describe("the character card", () => {
  const card = (hp: number, wound: string) =>
    renderToStaticMarkup(
      <CharacterCard
        name="Shane McMahn"
        handle="Sliver"
        role="lawman"
        hp={{ current: hp, max: 40 }}
        humanity={{ current: 46, max: 60 }}
        luck={{ left: 4, max: 6 }}
        wound={wound}
      />,
    );

  it("draws bars and luck as pips, not prose", () => {
    const html = card(40, "none");
    expect(html).toContain("Shane McMahn");
    expect(html).toContain('role="meter"');
    expect(html).toContain('aria-label="Luck 4 of 6"');
    expect(html).not.toContain("Wounded");
  });

  it("goes red and says so when hurt", () => {
    const html = card(8, "serious");
    expect(html).toContain("bg-destructive");
    expect(html).toContain("Seriously wounded");
  });
});

describe("the resource strip", () => {
  const html = renderToStaticMarkup(<ResourceStrip status={status} />);
  it("shows three chips with figures only", () => {
    expect(html).toContain("€1,540");
    expect(html).toContain("3 IP");
    expect(html).toContain('aria-label="Money"');
    expect(html).toContain('aria-label="Growth"');
    expect(html).toContain('aria-label="Commitments"');
  });
  it("keeps the detail closed until asked for", () => {
    expect(html).not.toContain("On hand");
  });
});

describe("a dock tile", () => {
  it("carries its label and an optional badge", () => {
    const html = renderToStaticMarkup(<DockTile icon={<i />} label="Shop" badge="new" />);
    expect(html).toContain("Shop");
    expect(html).toContain("new");
  });
});
