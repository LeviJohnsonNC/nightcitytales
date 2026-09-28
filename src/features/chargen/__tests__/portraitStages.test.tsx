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
  fileProgress,
  firstPictureNeeds,
  nextStageToDevelop,
  portraitClarity,
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
  it("is an undeveloped print, and explains nothing", () => {
    const html = renderToStaticMarkup(<CharacterFile state={draft({ roleId: "solo" })} />);
    expect(html).toContain("No photo on file");
    expect(html).not.toContain('alt="Your portrait"');
    expect(html).not.toContain("A picture develops");
  });
});

describe("how clear the picture is", () => {
  it("is black with no picture, and sharpens within each stage's band as steps are answered", () => {
    expect(portraitClarity(0, 1)).toBe(0);
    // The first still is barely a face however far the file has come.
    expect(portraitClarity(1, 0)).toBe(0.1);
    expect(portraitClarity(1, 0.9)).toBe(0.35);
    // Between the bands, it follows the answers.
    expect(portraitClarity(2, 0.5)).toBe(0.5);
    expect(portraitClarity(2, 0.3)).toBe(0.4);
    // The file photo is nearly clear when it lands, and clear at the end.
    expect(portraitClarity(3, 0.7)).toBe(0.85);
    expect(portraitClarity(3, 1)).toBe(1);
  });

  it("counts only steps that were reached and answered", () => {
    const fresh = draft();
    expect(fileProgress(fresh)).toBe(0);
    const met = draft({
      castPlan: { seed: 1234, picks: { fixer: "Kit Mwangi" } },
      visited: ["fixer"],
    });
    expect(fileProgress(met)).toBeGreaterThan(0);
    expect(fileProgress(met)).toBeLessThan(0.2);
  });

  it("puts the stage's clarity on the picture", () => {
    const html = renderToStaticMarkup(
      <CharacterFile
        state={draft()}
        developing={{ preview: "data:image/png;base64,x", developing: 1, failed: null, retry() {} }}
      />,
    );
    expect(html).toContain('data-clarity="10"');
    expect(html).toContain("blur(10.8px)");
  });
});

describe("a draft from before the picture developed", () => {
  it("keeps the portrait it already has: nothing develops over a hand-drawn face", () => {
    useChargenStore.getState().hydrate({ portraitPath: "user/draft/portrait.png" } as never);
    expect(useChargenStore.getState().portraitStage).toBe(3);
    useChargenStore.getState().reset();
    useChargenStore.getState().hydrate({ portraitPath: null } as never);
    expect(useChargenStore.getState().portraitStage).toBe(0);
  });
});
