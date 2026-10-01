/**
 * The portrait that develops: when each stage becomes possible, that a stage
 * is developed once, that a picture of the wrong person is developed again,
 * and that every stage describes the same face.
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
  portraitBasis,
  portraitClarity,
  portraitIsStale,
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
  it("waits for the Role, sex and age, and how they look", () => {
    expect(firstPictureNeeds(draft())).toEqual(["what you do", "your sex and age", "how you look"]);
    expect(portraitStageReady(draft())).toBe(0);
    const looked = draft({
      roleId: "solo",
      pronouns: "she/her",
      sex: "female",
      age: 34,
      lifepath: { general: LOOKS as unknown as Record<string, unknown>, roleSpecific: {} },
    });
    expect(firstPictureNeeds(looked)).toEqual([]);
    expect(portraitStageReady(looked)).toBe(1);
    expect(portraitStageReady({ ...looked, stats: STATS })).toBe(2);
  });

  it("develops each stage once and jumps to the best available", () => {
    const base = draft({
      roleId: "solo",
      pronouns: "she/her",
      sex: "female",
      age: 34,
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
  it("is black with no picture, and starts barely a face", () => {
    expect(portraitClarity(0, 1)).toBe(0);
    expect(portraitClarity(1, 0.4, 0.4)).toBeCloseTo(0.1);
  });

  it("only ever gets clearer as the interview goes on, from the first picture to the identity step", () => {
    for (const stage of [1, 2, 3] as const) {
      let last = 0;
      for (let progress = 0; progress <= 1.0001; progress += 0.05) {
        const clarity = portraitClarity(stage, progress, 0.4);
        expect(clarity).toBeGreaterThanOrEqual(last);
        last = clarity;
      }
    }
    // The same curve at every stage: a new picture arrives at the clarity the
    // last one had reached, never at a band of its own.
    expect(portraitClarity(2, 0.6, 0.4)).toBe(portraitClarity(1, 0.6, 0.4));
    expect(portraitClarity(3, 0.9, 0.4)).toBeGreaterThan(portraitClarity(3, 0.8, 0.4));
  });

  it("is fully clear on arriving at the identity step, once the file photo is there", () => {
    expect(portraitClarity(3, 1, 0.4)).toBe(1);
  });

  it("waits at a ceiling for a better picture, unless none is coming", () => {
    expect(portraitClarity(1, 1, 0.4)).toBe(0.5);
    expect(portraitClarity(2, 1, 0.4)).toBe(0.8);
    expect(portraitClarity(2, 1, 0.4, true)).toBe(1);
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

  it("puts the clarity on the picture", () => {
    const html = renderToStaticMarkup(
      <CharacterFile
        state={draft()}
        developing={{
          preview: { key: "frame:1", src: "data:image/png;base64,x" },
          latest: null,
          developing: 1,
          failed: null,
          stalled: false,
          retry() {},
        }}
      />,
    );
    // No steps answered yet: the floor.
    expect(html).toContain('data-clarity="10"');
    expect(html).toContain("blur(10.8px)");
  });
});

describe("a picture of somebody the answers no longer describe", () => {
  const drawn = draft({
    roleId: "solo",
    pronouns: "she/her",
    sex: "female",
    age: 34,
    stats: STATS,
    lifepath: { general: LOOKS as unknown as Record<string, unknown>, roleSpecific: {} },
    portraitPath: "u/d/p.png",
    portraitStage: 2,
  });
  const recorded = { ...drawn, portraitBasis: portraitBasis(drawn) };

  it("is fresh until who they are on sight changes", () => {
    expect(portraitIsStale(recorded)).toBe(false);
    expect(nextStageToDevelop(recorded)).toBeNull();
    // Gear, STATs and the name are not the face.
    expect(
      portraitBasis({ ...recorded, name: "Somebody Else", stats: { ...STATS, body: 3 } }),
    ).toBe(recorded.portraitBasis);
  });

  it("is developed again, at the best stage now possible, when the sex, age, Role or look changes", () => {
    for (const change of [{ sex: "male" as const }, { age: 61 }, { roleId: "fixer" }]) {
      const changed = { ...recorded, ...change };
      expect(portraitIsStale(changed), JSON.stringify(change)).toBe(true);
      expect(nextStageToDevelop(changed), JSON.stringify(change)).toBe(2);
    }
    const hair = {
      ...recorded,
      lifepath: {
        general: {
          ...LOOKS,
          entries: { ...LOOKS.entries, hairstyle: entry("hairstyle", "Shaved") },
        } as unknown as Record<string, unknown>,
        roleSpecific: {},
      },
    };
    expect(portraitIsStale(hair)).toBe(true);
  });

  it("is never stale when nothing recorded who it was of, as with a saved face", () => {
    expect(portraitIsStale({ ...drawn, portraitBasis: null, sex: "male" })).toBe(false);
  });
});

describe("a draft from before the picture developed", () => {
  it("keeps the portrait it already has: nothing develops over a saved face", () => {
    useChargenStore.getState().hydrate({ portraitPath: "user/draft/portrait.png" } as never);
    expect(useChargenStore.getState().portraitStage).toBe(3);
    useChargenStore.getState().reset();
    useChargenStore.getState().hydrate({ portraitPath: null } as never);
    expect(useChargenStore.getState().portraitStage).toBe(0);
  });
});
