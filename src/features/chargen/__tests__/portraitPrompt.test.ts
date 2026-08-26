import { describe, expect, it } from "vitest";
import { buildPortraitFacts, buildPortraitPrompt, portraitMissing } from "../portraitPrompt";
import type { ChargenState } from "../store";

const facts = {
  handle: "Static",
  pronouns: "she/her",
  gender: "female" as const,
  role: "Netrunner",
  roleAbility: "Interface",
  facts: [{ label: "Hairstyle", value: "Shaved" }],
  build: null,
  wardrobe: [],
  chrome: [],
  armor: [],
  weapon: null,
  humanity: null,
  home: null,
  selfDescription: "",
};

const baseState = {
  name: "Jo",
  handle: "Static",
  pronouns: "she/her",
  selfDescription: "",
  method: "complete_package",
  roleId: null,
  roleAbility: null,
  stats: {},
  skills: [],
  lifepath: { general: {}, roleSpecific: {} },
  loadout: { lines: [], packageChoices: {} },
  lifestyle: { location: null },
} as unknown as ChargenState;

describe("portrait prompt", () => {
  it("carries the character facts and the painterly house look", () => {
    const prompt = buildPortraitPrompt(facts);
    expect(prompt).toContain("Netrunner");
    expect(prompt).toContain("Hairstyle: Shaved");
    expect(prompt).toContain("a woman");
    expect(prompt).toContain("no logos");
    expect(prompt).toContain("digital oil painting");
    expect(prompt).toContain("Neon-noir palette");
  });

  it("never invents anything beyond the facts", () => {
    const bare = buildPortraitPrompt({ ...facts, facts: [] });
    expect(bare).not.toContain("Hairstyle");
    expect(bare).not.toContain("Armor:");
    expect(bare).not.toContain("Carries a");
    expect(bare).not.toContain("Visible cybernetics");
  });

  it("shows what the player actually bought and wore", () => {
    const prompt = buildPortraitPrompt({
      ...facts,
      build: "broad and powerfully built",
      wardrobe: ["Gangsta Jacket"],
      armor: ["Light Armorjack worn on the body"],
      chrome: ["Cybereye"],
      weapon: "Heavy Pistol",
      humanity: "visibly chromed; the expression has cooled",
    });
    expect(prompt).toContain("Gangsta Jacket");
    expect(prompt).toContain("Light Armorjack worn on the body");
    expect(prompt).toContain("Cybereye");
    expect(prompt).toContain("never pointed at the camera");
    expect(prompt).toContain("broad and powerfully built");
  });

  it("reads visible chrome from the loadout and hides internal implants", () => {
    const built = buildPortraitFacts({
      ...baseState,
      stats: { body: 8 },
      loadout: {
        lines: [
          { lineId: "a", kind: "cyberware", itemId: "cybereye", qty: 1, budget: "gear" },
          { lineId: "b", kind: "cyberware", itemId: "light_tattoo", qty: 1, budget: "gear" },
          { lineId: "c", kind: "armor", itemId: "kevlar", qty: 1, budget: "gear", location: "body" },
          { lineId: "d", kind: "weapon", itemId: "heavy_pistol", qty: 1, budget: "gear" },
        ],
        packageChoices: {},
      },
    } as unknown as ChargenState);

    expect(built.chrome).toContain("Light Tattoo");
    expect(built.armor.some((a) => a.includes("Kevlar"))).toBe(true);
    expect(built.weapon).toBeTruthy();
    expect(built.build).toBe("broad and powerfully built");
    expect(built.humanity).toBeTruthy();
  });

  it("leaves the visible-gear lines out when nothing was bought", () => {
    const built = buildPortraitFacts(baseState);
    expect(built.chrome).toEqual([]);
    expect(built.armor).toEqual([]);
    expect(built.weapon).toBeNull();
    expect(built.humanity).toBeNull();
  });

  it("blocks generation until identity and earlier steps are done", () => {
    const empty = { name: "", handle: "", pronouns: "", method: null } as ChargenState;
    const missing = portraitMissing({
      ...empty,
      lifepath: { general: {}, roleSpecific: {} },
      stats: {},
      skills: [],
      loadout: { lines: [], packageChoices: {} },
      lifestyle: {},
    } as unknown as ChargenState);
    expect(missing).toContain("name");
    expect(missing).toContain("handle");
    expect(missing).toContain("pronouns");
    expect(missing.length).toBeGreaterThan(3);
  });
});
