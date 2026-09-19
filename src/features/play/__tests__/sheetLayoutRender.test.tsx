/**
 * What the sheet drawer actually renders during play.
 *
 * Three rulings live here rather than in a comment: the live kit is folded
 * away UNDER Weapons and Armor rather than stacked on top of the sheet, every
 * carried line the catalog knows carries the same "?" the printed panels do,
 * and the STATs panel leads with cards — an icon, a lit edge, a number — with
 * no band legend and no instruction to tap anything.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { assembleCharacter, WEAPONS } from "@/engine";
import { CharacterSheet } from "@/features/chargen/CharacterSheet";
import { buildFromState } from "@/features/chargen/sheetModel";
import { stateFromCharacter } from "@/features/roster/characterState";
import { CarriedKit } from "../CarriedKitView";
import type { CampaignInventoryItem, FullCharacter } from "@/lib/backend";

const GUN = WEAPONS.find((w) => w.magazine !== null && w.magazine >= 6)!;

const character = {
  character: {
    id: "char-1",
    name: "V",
    handle: "Vee",
    role: "solo",
    creation_method: "complete_package",
    portrait_id: null,
  },
  stats: { int: 6, ref: 8, dex: 7, tech: 4, cool: 7, will: 6, luck: 5, move: 6, body: 2, emp: 5 },
  skills: [{ skill_id: "handgun", level: 6, specialization: null }],
  roleAbility: { ability_id: "combat_awareness", rank: 4, metadata: { name: "Combat Awareness" } },
  gear: [],
  cyberware: [],
  lifepath: { general: {}, role_specific: {} },
  finance: { housing: "Rented Cargo Container, Combat Zone" },
} as unknown as FullCharacter;

const inventory: CampaignInventoryItem[] = [
  {
    id: "inv-1",
    campaign_id: "c",
    kind: "weapon",
    item_id: GUN.id,
    quantity: 1,
    equipped: true,
    slot: "weapon",
    current_sp: null,
    ammo_loaded: 3,
    condition: "ok",
    notes: null,
  } as unknown as CampaignInventoryItem,
  {
    id: "inv-2",
    campaign_id: "c",
    kind: "gear",
    item_id: "not-a-real-catalog-id",
    quantity: 2,
    equipped: false,
    slot: "gear",
    current_sp: null,
    ammo_loaded: null,
    condition: "ok",
    notes: null,
  } as unknown as CampaignInventoryItem,
];

function sheetHtml(carrying?: React.ReactNode) {
  const state = stateFromCharacter(character);
  const build = buildFromState(state);
  return renderToStaticMarkup(
    <CharacterSheet
      state={state}
      build={build}
      sheet={assembleCharacter(build)}
      improvementPoints={0}
      {...(carrying ? { carrying } : {})}
    />,
  );
}

describe("the STATs panel", () => {
  const html = sheetHtml();

  it("drops the legend and the instruction to tap", () => {
    expect(html).not.toContain("tap a STAT");
    expect(html).not.toContain("STAT strength legend");
    // The band words survive only where they are not printed on the page: the
    // hover title and the label a screen reader reads off the number.
    expect(html).not.toMatch(/>\s*Very Bad\s*</);
    expect(html).not.toMatch(/>\s*Very Good\s*</);
  });

  it("gives every STAT its own icon, large and in the card's empty half", () => {
    // Ten STATs, ten icons, and none of them the band chevrons the cards used
    // to carry beside the number.
    for (const icon of [
      "lucide-brain",
      "lucide-zap",
      "lucide-hand",
      "lucide-wrench",
      "lucide-flame",
      "lucide-anchor",
      "lucide-clover",
      "lucide-footprints",
      "lucide-dumbbell",
      "lucide-heart",
    ]) {
      expect(html).toContain(icon);
    }
    // Held back behind the number, on the right, rather than inline with the
    // three-letter label it used to sit beside.
    expect(html).toContain("absolute right-2 top-1/2 size-12 -translate-y-1/2 opacity-40");
  });

  it("makes the edge a meter as well, so the ramp is not colour alone", () => {
    // BODY 2 sits near the floor of the bar, REF 8 fills it.
    expect(html).toContain("height:18%");
    expect(html).toContain("height:100%");
  });

  it("lights the left edge red at the bottom of the scale and green at the top", () => {
    // BODY 2 and REF 8 in the fixture: the ends of the ramp, both on screen.
    expect(html).toContain("hsl(0 90% 58%)");
    expect(html).toContain("hsl(150 90% 66%)");
  });
});

describe("the live kit on the sheet", () => {
  it("is absent entirely when there is no campaign to read", () => {
    expect(sheetHtml()).not.toContain("Carrying now");
  });

  it("sits after Weapons and Armor, folded away", () => {
    const html = sheetHtml(<CarriedKit inventory={inventory} />);
    const carrying = html.indexOf("Carrying now");
    expect(carrying).toBeGreaterThan(html.indexOf(">Weapons<"));
    expect(carrying).toBeGreaterThan(html.indexOf(">Armor<"));
    // A <details> with no open attribute: closed until the reader opens it.
    const panel = html.slice(carrying - 400, carrying);
    expect(panel).toContain("<details");
    expect(panel).not.toContain("open=");
  });
});

describe("a carried line", () => {
  const html = renderToStaticMarkup(<CarriedKit inventory={inventory} />);

  it("opens the same entry the printed panels do", () => {
    expect(html).toContain(`What is ${GUN.name}?`);
  });

  it("still lists a row the catalog has never heard of, just without the button", () => {
    expect(html).toContain("not-a-real-catalog-id");
    expect(html).not.toContain("What is not-a-real-catalog-id?");
  });
});
