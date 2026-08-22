import { describe, expect, it } from "vitest";
import { buildPortraitPrompt, portraitMissing } from "../portraitPrompt";
import type { ChargenState } from "../store";

const facts = {
  handle: "Static",
  pronouns: "she/her",
  gender: "female" as const,
  role: "Netrunner",
  roleAbility: "Interface",
  facts: [{ label: "Hairstyle", value: "Shaved" }],
  selfDescription: "",
};

describe("portrait prompt", () => {
  it("carries the character facts and the house look", () => {
    const prompt = buildPortraitPrompt(facts);
    expect(prompt).toContain("Netrunner");
    expect(prompt).toContain("Hairstyle: Shaved");
    expect(prompt).toContain("a woman");
    expect(prompt).toContain("no logos");
  });

  it("never invents anything beyond the facts", () => {
    expect(buildPortraitPrompt({ ...facts, facts: [] })).not.toContain("Hairstyle");
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
