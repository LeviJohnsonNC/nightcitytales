/**
 * The portrait that develops: when each stage becomes possible, that a stage
 * is developed once and never over a hand-drawn picture, and that every stage
 * describes the same face.
 */
import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { StatBlock } from "@/engine";
import { CharacterFile } from "../CharacterFile";
import { buildPortraitFacts } from "../portraitPrompt";
import {
  faceFact,
  firstPictureNeeds,
  nextStageToDevelop,
  portraitStageReady,
} from "../portraitStages";
import { useChargenStore, type ChargenState } from "../store";

const STATS: StatBlock = {
  int: 6,
  ref: 7,
  dex: 6,
  tech: 5,
  cool: 6,
  will: 5,
  luck: 5,
  move: 6,
  body: 8,
  emp: 5,
};

function entry(tableId: string, value: string) {
  return { tableId, roll: 1, value, source: "rolled" };
}

const LOOKS = {
  entries: {
    clothing_style: entry("clothing_style", "Leisurewear"),
    hairstyle: entry("hairstyle", "Mohawk"),
    affectation: entry("affectation", "Tattoos"),
  },
  friends: [],
  enemies: [],
  tragicLove: [],
  language: null,
};

afterEach(() => useChargenStore.getState().reset());

function draft(over: Partial<ChargenState> = {}): ChargenState {
  return {
    ...useChargenStore.getState(),
    method: "edgerunner",
    castPlan: { seed: 1234, picks: {} },
    ...over,
  };
}

describe("when the picture can develop", () => {
  it("waits for the Role, the pronouns and how they look", () => {
    expect(firstPictureNeeds(draft())).toEqual(["what you do", "your pronouns", "how you look"]);
    expect(portraitStageReady(draft())).toBe(0);
    const looked = draft({
      roleId: "solo",
      pronouns: "she/her",
      lifepath: { general: LOOKS as unknown as Record<string, unknown>, roleSpecific: {} },
    });
    expect(firstPictureNeeds(looked)).toEqual([]);
    expect(portraitStageReady(looked)).toBe(1);
    expect(portraitStageReady({ ...looked, stats: STATS })).toBe(2);
  });

  it("develops each stage once, jumps to the best available, and never over a hand-drawn one", () => {
    const base = draft({
      roleId: "solo",
      pronouns: "she/her",
      stats: STATS,
      lifepath: { general: LOOKS as unknown as Record<string, unknown>, roleSpecific: {} },
    });
    expect(nextStageToDevelop({ ...base, portraitStage: 0 })).toBe(2);
    expect(nextStageToDevelop({ ...base, portraitStage: 2 })).toBeNull();
    expect(nextStageToDevelop({ ...base, portraitStage: 3 })).toBeNull();
  });
});

describe("the same face at every stage", () => {
  it("is fixed by the draft's seed, and sent with every picture", () => {
    expect(faceFact(1234)).toEqual(faceFact(1234));
    const faces = new Set(Array.from({ length: 30 }, (_, i) => faceFact(i * 101)!.value));
    expect(faces.size).toBeGreaterThan(10);
    expect(faceFact(null)).toBeNull();
    const facts = buildPortraitFacts(draft({ roleId: "solo" }), "Solo");
    expect(facts.facts).toContainEqual(faceFact(1234));
  });
});

describe("the file, while there is no picture yet", () => {
  it("says what the first picture is waiting for", () => {
    const html = renderToStaticMarkup(<CharacterFile state={draft({ roleId: "solo" })} />);
    expect(html).toContain("A picture develops once the file has your pronouns, how you look.");
    expect(html).toContain("No photo on file");
  });
});
