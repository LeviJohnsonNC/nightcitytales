/**
 * The Lifepath as an interview: chapters, the fixer opening each one, and the
 * people the dice roll put in front of the player as faces to choose between.
 */
import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { castCandidates, fixerCandidates } from "@/engine";
import { LifepathPanel } from "../LifepathPanel";
import { PeoplePicker } from "../PeoplePicker";
import { fixerChapterLine } from "../interview";
import { castForState, tiesForState } from "../revealModel";
import { useChargenStore, type ChargenState } from "../store";

const SEED = 31337;
const FIXER = fixerCandidates(SEED)[0]!;

afterEach(() => useChargenStore.getState().reset());

function draft(over: Partial<ChargenState> = {}): ChargenState {
  return {
    ...useChargenStore.getState(),
    method: "edgerunner",
    roleId: "solo",
    castPlan: { seed: SEED, picks: { fixer: FIXER } },
    ...over,
  };
}

/** React escapes quotes in markup; compare against the same escaping. */
function escaped(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

describe("the Lifepath, in chapters", () => {
  it("opens on the first chapter with the fixer asking, and names all five", () => {
    const html = renderToStaticMarkup(<LifepathPanel state={draft()} />);
    for (const title of [
      "Where you come from",
      "Who you are",
      "Who is still out there",
      "What you want",
      "About the work",
    ]) {
      expect(html).toContain(title);
    }
    expect(html).toContain(escaped(fixerChapterLine(FIXER, "origin")!));
    expect(html).toContain("Roll this chapter");
    expect(html).toContain("Next: Who you are");
  });
});

describe("meeting your people", () => {
  it("offers faces for each of the three, with the dice's choice among them", () => {
    const state = draft({
      lifepath: {
        general: {
          entries: {},
          friends: [],
          enemies: [
            {
              id: "e",
              who: { tableId: "enemy_who", roll: 8, value: "Corporate exec", source: "rolled" },
              cause: null,
              throwAtYou: null,
              injuredParty: "you",
            },
          ],
          tragicLove: [],
          language: null,
        },
        roleSpecific: {},
      },
    });
    const html = renderToStaticMarkup(<PeoplePicker state={state} />);
    const ties = tiesForState(state);
    for (const role of ["enemy", "friend", "old_flame"] as const) {
      for (const name of castCandidates({ seed: SEED, ties, role }).candidates) {
        expect(html).toContain(escaped(name));
      }
    }
    // A Corporate exec can only be one person, and the screen says so.
    expect(castCandidates({ seed: SEED, ties, role: "enemy" }).candidates).toEqual(["Song Ha-eun"]);
    expect(html).toContain("Only one person in the city fits");
    expect(html).toContain("The dice chose");
    expect(html).toContain("Your Lifepath rolled no friends");
  });

  it("carries a choice straight into the cast the campaign will seed", () => {
    const base = draft();
    const { candidates } = castCandidates({ seed: SEED, ties: tiesForState(base), role: "friend" });
    const chosen = candidates[candidates.length - 1]!;
    const state = draft({ castPlan: { seed: SEED, picks: { fixer: FIXER, friend: chosen } } });
    expect(castForState(state).find((m) => m.role === "friend")!.name).toBe(chosen);
    expect(renderToStaticMarkup(<PeoplePicker state={state} />)).toContain("Your choice");
  });

  it("asks for the meet first when there is no plan", () => {
    const html = renderToStaticMarkup(<PeoplePicker state={draft({ castPlan: null })} />);
    expect(html).toContain("Meet your fixer first");
  });
});
