/**
 * Moving house end to end: the SQL writes the receipt the engine reads, rent
 * follows the campaign once it has moved and creation until then, and Then and
 * now tells the move.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LEDGER_EVENTS, MOVED_HOUSE_KEYS, readMovedHouseEventData } from "@/engine";
import type { Campaign, CampaignEvent, FullCharacter } from "@/lib/backend";
import { lifestyleRates } from "@/features/downtime/downtimeModel";
import { campaignHome, homeLine } from "../home";
import { moveSummary } from "../moving";
import { thenAndNow } from "../thenAndNow";

function newestDefinitionOf(fn: string): string {
  const dir = join(process.cwd(), "supabase/migrations");
  let body: string | null = null;
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const sql = readFileSync(join(dir, file), "utf8");
    const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}`);
    if (start === -1) continue;
    const end = sql.indexOf("$$;", start);
    if (end !== -1) body = sql.slice(start, end);
  }
  if (!body) throw new Error(`No migration defines ${fn}.`);
  return body;
}

describe("move_house", () => {
  const body = newestDefinitionOf("move_house");

  it("writes the event type the engine names", () => {
    expect(body).toContain(`'${LEDGER_EVENTS.movedHouse}'`);
  });

  it("spells exactly the keys the reader parses, in order", () => {
    const build = body.slice(body.indexOf("v_data := jsonb_build_object("));
    const keys = [...build.matchAll(/^\s*'([a-z_]+)',/gm)].map((m) => m[1]);
    expect(keys).toEqual([...MOVED_HOUSE_KEYS]);
  });

  it("only moves between jobs, and refuses a plan priced against another campaign state", () => {
    expect(body).toContain("v_phase <> 'life'");
    expect(body).toContain("'campaign changed'");
  });
});

const written = {
  from_place: "x3",
  from_housing: "cargo_container",
  from_lifestyle: "kibble",
  to_place: "j2",
  to_housing: "studio_apartment",
  to_lifestyle: "good_prepak",
  deposit: 1500,
  rent: 1500,
  lifestyle_cost: 600,
  day: 12,
};

describe("readMovedHouseEventData", () => {
  it("reads what the database writes", () => {
    expect(readMovedHouseEventData(written)).toMatchObject({
      fromPlace: "x3",
      toHousing: "studio_apartment",
      lifestyleCost: 600,
    });
  });

  it("refuses a payload the function could not have written", () => {
    expect(readMovedHouseEventData({ ...written, deposit: "1500" })).toBeNull();
    expect(readMovedHouseEventData(null)).toBeNull();
  });
});

const character = {
  character: { name: "Red", role: "solo" },
  finance: { home_place_key: "x3", home_district_key: "rancho_coronado" },
  cyberware: [],
  gear: [],
  skills: [],
  stats: null,
} as unknown as FullCharacter;
const campaign = (over: Record<string, unknown> = {}) =>
  ({ id: "c1", day: 12, minute: 600, bills_paid_through_day: 0, ...over }) as unknown as Campaign;

describe("the home a campaign reads", () => {
  it("is creation's until the character moves, rent and all", () => {
    const rates = lifestyleRates(character, campaign());
    expect(rates).toMatchObject({ rent: 1000, lifestyleCost: 100 });
    expect(rates.housingName).toBe(lifestyleRates(character).housingName);
    expect(campaignHome(campaign(), character).placeKey).toBe("x3");
  });

  it("is the campaign's once they have", () => {
    const moved = campaign({
      housing_id: "studio_apartment",
      lifestyle_id: "good_prepak",
      home_place_key: "j2",
    });
    expect(lifestyleRates(character, moved)).toMatchObject({
      housingName: "Studio Apartment",
      lifestyleName: "Good Prepak",
      rent: 1500,
      lifestyleCost: 600,
      perMonth: 2100,
    });
    expect(homeLine(moved, character)).toMatch(/^Studio Apartment at .+; eats Good Prepak$/);
    expect(homeLine(moved, character)).not.toMatch(/eb\b|1500|600/);
  });

  it("is told in Then and now, from where they started to where they are", () => {
    const events = [
      { id: "e1", type: "moved_house", data: written },
      {
        id: "e2",
        type: "moved_house",
        data: { ...written, from_lifestyle: "good_prepak", to_lifestyle: "fresh_food" },
      },
    ] as unknown as CampaignEvent[];
    const sections = thenAndNow({
      day: 20,
      character,
      vitals: { humanity_current: 50 } as never,
      inventory: [],
      cyberware: [],
      npcs: [],
      standings: [],
      events,
    });
    const home = sections.find((s) => s.title === "Where you live");
    expect(home?.lines.map((l) => l.text)).toEqual([
      expect.stringMatching(/^Cargo Container, .+ → Studio Apartment, .+$/),
      "Kibble → Fresh Food",
    ]);
  });

  it("logs the move in words, with the deposit and the new monthly bill", () => {
    expect(
      moveSummary(
        { housingId: "studio_apartment", lifestyleId: "kibble", placeKey: "j2" },
        { moving: true, deposit: 1500, perMonthAfter: 1600 },
      ),
    ).toMatch(
      /^Moved into a Studio Apartment at .+\. Deposit 1500eb\. 1600eb a month from the next bill\.$/,
    );
    expect(
      moveSummary(
        { housingId: "cargo_container", lifestyleId: "fresh_food", placeKey: "x3" },
        { moving: false, deposit: 0, perMonthAfter: 2500 },
      ),
    ).toBe("Living on Fresh Food now: 2500eb a month from the next bill.");
  });
});
