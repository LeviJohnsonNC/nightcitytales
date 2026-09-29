import { describe, expect, it } from "vitest";
import type { CheckableTurn } from "../narratorChecks";
import {
  doesNotRepeatItself,
  keepsItsPeople,
  namedPeople,
  sharedRuns,
  speakerNames,
} from "../sessionChecks";

const turn = (narration: string): CheckableTurn => ({
  narration,
  offeredOptions: [],
  npcKeys: [],
  observations: [],
  walkOns: [],
  proposedActionCount: 0,
});

describe("shared runs", () => {
  it("finds a clause that came back, quoted as the later turn wrote it", () => {
    const runs = sharedRuns(
      "The Paper Lantern smells of boiled cabbage, warm beer and floor disinfectant.",
      "You sit. The Paper Lantern smells of boiled cabbage, warm beer and floor disinfectant, still.",
    );
    expect(runs).toHaveLength(1);
    expect(runs[0]).toContain("boiled cabbage, warm beer and floor disinfectant");
  });

  it("lets a name, a place and a verb recur", () => {
    expect(
      sharedRuns(
        "The bartender wipes the counter and says nothing.",
        "The bartender wipes the counter again, then slides a glass across.",
      ),
    ).toEqual([]);
  });

  it("ignores punctuation and case", () => {
    expect(
      sharedRuns(
        "a heavy glass of amber synth-distillate slides across",
        "A HEAVY glass, of amber synth-distillate: slides across.",
      ),
    ).toHaveLength(1);
  });
});

describe("does not repeat itself", () => {
  it("names the turn it came back in, and the one that said it first", () => {
    const found = doesNotRepeatItself.run([
      turn("Red light from the holo-screen crawls over your knuckles and the bar."),
      turn("You drink. Nothing else moves."),
      turn("The bartender nods. Red light from the holo-screen crawls over your knuckles again."),
    ]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ turn: 3, note: "already said in turn 1" });
  });

  it("passes a session where every turn is new", () => {
    expect(
      doesNotRepeatItself.run([
        turn("You take the stool by the tap."),
        turn("The bartender pours without looking at you."),
        turn("A man two stools down laughs at something on his cuff."),
      ]),
    ).toEqual([]);
  });

  it("passes a single turn", () => {
    expect(doesNotRepeatItself.run([turn("One turn.")])).toEqual([]);
  });
});

describe("named people", () => {
  it("reads a name pinned to a job three ways", () => {
    expect(namedPeople("Kenji, the bartender, wipes a glass.")).toMatchObject([
      { name: "Kenji", role: "bartender" },
    ]);
    expect(namedPeople("The barkeep, Kenji, wipes a glass.")).toMatchObject([
      { name: "Kenji", role: "bartender" },
    ]);
    expect(
      namedPeople('The bartender leans in. "Name\'s Kenji. Been here since the war."'),
    ).toMatchObject([{ name: "Kenji", role: "bartender" }]);
  });

  it("does not take a gang or a sentence opener for a name", () => {
    expect(namedPeople("The bartender, Tyger Claws at his back, says nothing.")).toEqual([]);
    expect(namedPeople("Down the bar, the bartender nods.")).toEqual([]);
  });
});

describe("keeps its people", () => {
  it("catches a job that changes name between turns", () => {
    const found = keepsItsPeople.run([
      turn('The bartender sets down a glass. "Name\'s Kenji."'),
      turn("You drink. He does not speak."),
      turn("Hiro, the bartender, slides you the bill."),
    ]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ turn: 3, note: "the bartender was Kenji in turn 1" });
  });

  it("catches a name that changes job", () => {
    const found = keepsItsPeople.run([
      turn("Kenji, the bartender, nods."),
      turn("Kenji, the mechanic, wipes his hands."),
    ]);
    expect(found).toMatchObject([{ turn: 2, note: "Kenji was the bartender in turn 1" }]);
  });

  it("passes a person who stays the same, and a session with no names", () => {
    expect(
      keepsItsPeople.run([
        turn("Kenji, the bartender, nods."),
        turn("The barkeep, Kenji, pours."),
        turn('"Name\'s Kenji," the bartender says.'),
      ]),
    ).toEqual([]);
    expect(keepsItsPeople.run([turn("The bartender nods."), turn("The bartender pours.")])).toEqual(
      [],
    );
  });
});

describe("speaker names", () => {
  it("reads a name that opens a sentence with a verb, and a name alone in quotes", () => {
    expect(speakerNames("Kenji stares at you through the smoke.").map((n) => n.name)).toEqual([
      "Kenji",
    ]);
    expect(speakerNames('"Katsuo," he says, wiping the rag.').map((n) => n.name)).toEqual([
      "Katsuo",
    ]);
  });

  it("does not take a sentence opener or a gang for a person", () => {
    expect(speakerNames("Unless he nods. Which is fine. The Tyger Claws watch.")).toEqual([]);
  });

  it("holds a scene with one interlocutor to one name", () => {
    const found = keepsItsPeople.run(
      [
        turn("Tadashi leans on the counter."),
        turn("The rag goes round the glass."),
        turn('"Katsuo," he says.'),
      ],
      { interlocutor: "bartender" },
    );
    expect(found).toMatchObject([{ turn: 3, note: "the bartender was Tadashi in turn 1" }]);
    expect(
      keepsItsPeople.run([turn("Tadashi leans on the counter."), turn("Tadashi wipes a glass.")], {
        interlocutor: "bartender",
      }),
    ).toEqual([]);
  });

  it("does not count a second person who is only mentioned in passing", () => {
    expect(
      keepsItsPeople.run(
        [
          turn("Kenji leans on the counter."),
          turn("Kenji wipes a glass. Sato gets a cut of every pour."),
          turn("Kenji nods."),
        ],
        { interlocutor: "bartender" },
      ),
    ).toEqual([]);
  });

  it("catches someone else taking the seat for two turns", () => {
    const found = keepsItsPeople.run(
      [
        turn("Kenji leans on the counter."),
        turn("Kenji wipes a glass."),
        turn("Hiro pours the drink."),
        turn("Hiro nods and looks away."),
      ],
      { interlocutor: "bartender" },
    );
    expect(found).toMatchObject([{ turn: 4, note: "the bartender was Kenji in turn 1" }]);
  });

  it("does not guess who a name belongs to without an interlocutor", () => {
    expect(
      keepsItsPeople.run([turn("Tadashi leans on the counter."), turn('"Katsuo," he says.')]),
    ).toEqual([]);
  });
});
