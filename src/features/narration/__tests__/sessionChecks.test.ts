import { describe, expect, it } from "vitest";
import type { CheckableTurn } from "../narratorChecks";
import { doesNotRepeatItself, sharedRuns } from "../sessionChecks";

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
