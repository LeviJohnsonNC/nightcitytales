import { describe, expect, it } from "vitest";
import { PORTRAIT_SIZE, buildPortraitFacts, buildPortraitPrompt } from "../portraitPrompt";
import type { ChargenState } from "../store";

const facts = {
  handle: "Static",
  pronouns: "she/her",
  gender: "female" as const,
  age: 34,
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
  setting: [] as { label: string; value: string }[],
  selfDescription: "",
};

const baseState = {
  name: "Jo",
  handle: "Static",
  pronouns: "she/her",
  sex: "female",
  age: 34,
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
          {
            lineId: "c",
            kind: "armor",
            itemId: "kevlar",
            qty: 1,
            budget: "gear",
            location: "body",
          },
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

  it("composes for the square crop the file shows it in", () => {
    const prompt = buildPortraitPrompt(buildPortraitFacts(baseState, "Solo"));
    expect(prompt).toContain("headroom");
    expect(prompt).toContain("upper-third line");
    expect(prompt).toContain("2:3");
    expect(PORTRAIT_SIZE.height / PORTRAIT_SIZE.width).toBe(1.5);
  });

  it("paints the backdrop from the character's own file", () => {
    const prompt = buildPortraitPrompt({
      ...facts,
      setting: [{ label: "What's Your Workspace Like?", value: "A messy nest of cables" }],
    });
    expect(prompt).toContain("specifically theirs");
    expect(prompt).toContain("What's Your Workspace Like?: A messy nest of cables");
    expect(prompt).not.toContain("never the subject");
  });

  it("reads the setting from the Role Lifepath, the district and the keepsake", () => {
    const built = buildPortraitFacts({
      ...baseState,
      roleId: "exec",
      lifestyle: { location: "Watson" },
      lifepath: {
        general: {
          entries: {
            most_valued_possession: {
              tableId: "most_valued_possession",
              roll: 1,
              value: "A weapon",
              method: "chosen",
            },
          },
        },
        roleSpecific: {
          roleId: "exec",
          entries: {
            what_kind_of_corp_do_you_work_for: {
              tableId: "what_kind_of_corp_do_you_work_for",
              roll: 1,
              value: "Media and communications",
              method: "chosen",
            },
          },
        },
      },
    } as unknown as ChargenState);
    const values = built.setting.map((s) => s.value);
    expect(values).toContain("Watson");
    expect(values).toContain("Media and communications");
    expect(values).toContain("A weapon");
  });

  it("has no setting until the file says something about where they are", () => {
    expect(buildPortraitFacts(baseState).setting).toEqual([]);
  });
});
