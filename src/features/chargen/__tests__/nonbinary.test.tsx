/**
 * A nonbinary character, end to end: chosen in the picker, carried by the draft,
 * saved in the Lifepath, read back for the campaign, and drawn as such.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SEXES, identityLine, readIdentity, IDENTITY_KEY } from "@/engine";
import { buildPortraitFacts, buildPortraitPrompt } from "../portraitPrompt";
import { WhoPicker } from "../WhoPicker";
import type { ChargenState } from "../store";

const state = (over: Partial<ChargenState> = {}) =>
  ({
    name: "Sam",
    handle: "Static",
    pronouns: "they/them",
    sex: "nonbinary",
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
    ...over,
  }) as unknown as ChargenState;

describe("choosing a gender", () => {
  it("offers all three, each with a name a screen reader can say", () => {
    expect(SEXES).toEqual(["male", "female", "nonbinary"]);
    const html = renderToStaticMarkup(<WhoPicker state={state()} />);
    for (const label of ["Male", "Female", "Nonbinary"]) {
      expect(html).toContain(`aria-label="${label}"`);
    }
  });

  it("asks for a gender, not a sex", () => {
    const html = renderToStaticMarkup(<WhoPicker state={state()} />);
    expect(html).toContain("Gender");
    expect(html).not.toMatch(/>\s*Sex\s*</);
  });

  it("marks only the chosen one as pressed", () => {
    const html = renderToStaticMarkup(<WhoPicker state={state()} />);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="Nonbinary"/);
  });
});

describe("what a nonbinary character carries", () => {
  it("reads back from the saved Lifepath, and as a line that never says the age as a number", () => {
    const stored = { [IDENTITY_KEY]: { sex: "nonbinary", age: 34 } };
    const read = readIdentity(stored[IDENTITY_KEY]);
    expect(read).toEqual({ sex: "nonbinary", age: 34 });
    expect(identityLine(read)).toBe("nonbinary person, they/them, in their prime");
  });

  it("is drawn as an androgynous, non-binary presentation, not guessed at", () => {
    const facts = buildPortraitFacts(state());
    expect(facts.gender).toBe("non-binary");
    const prompt = buildPortraitPrompt(facts);
    expect(prompt).toContain("androgynous, non-binary presentation");
    expect(prompt).toContain("they/them");
    expect(prompt).not.toContain("a woman");
    expect(prompt).not.toContain("a man");
  });
});
