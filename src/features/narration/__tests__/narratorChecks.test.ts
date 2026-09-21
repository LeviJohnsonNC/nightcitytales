import { describe, expect, it } from "vitest";
import {
  ALL_CHECKS,
  closedObservationWords,
  endsOnTheWorld,
  knownNpcKeysOnly,
  namesNoWayIn,
  noUnsourcedNumber,
  optionsOnlyWhenAsked,
  quietStaysQuiet,
  riskGetsDice,
  walkOnsFromCatalog,
  withheldStaysWithheld,
  withinProseBudget,
  type CheckContext,
  type CheckableTurn,
} from "../narratorChecks";

/**
 * The checkers, checked.
 *
 * `evals/` runs these against a live model, which costs money and needs a key,
 * so it cannot run here. This does — and it is the half most likely to be
 * wrong. A detector with a sloppy pattern fails in one of two directions: it
 * never fires, and the eval reports a clean sweep forever; or it fires on
 * everything, and the report becomes noise nobody reads. Both look like a
 * working eval from the outside.
 *
 * So every check gets both: prose that must trip it, and prose that must not.
 */

const CLEAN: CheckableTurn = {
  narration:
    "The rain has stopped. A man in a courier's jacket leans against the shutter, " +
    "thumbing something into a battered agent, and does not look up as you pass. " +
    "Somewhere behind the wall a compressor kicks on and keeps running.",
  offeredOptions: [],
  npcKeys: [],
  observations: [],
  walkOns: [],
  proposedActionCount: 0,
};

const CTX: CheckContext = {
  packet: "== SCENE ==\nTime: Day 3, 20:47\nHere: Mister Rice Guy\n",
  optionsRequested: false,
  knownNpcKeys: ["wakako_okada"],
  withheldTruths: [],
  mustStayQuiet: false,
  riskyIntent: false,
};

const turn = (over: Partial<CheckableTurn>): CheckableTurn => ({ ...CLEAN, ...over });
const ctx = (over: Partial<CheckContext>): CheckContext => ({ ...CTX, ...over });

describe("a clean turn trips nothing", () => {
  it("passes every check at once", () => {
    // The guard against the other failure direction: a detector that fires on
    // ordinary prose makes the whole report worthless.
    for (const check of ALL_CHECKS) {
      expect(check.run(CLEAN, CTX), check.id).toEqual([]);
    }
  });
});

describe("a number the engine did not give it", () => {
  it("catches a price", () => {
    // The actual bug: the model resolved "be concrete" against "invent no
    // numbers" by pricing a bowl of noodles.
    const found = noUnsourcedNumber.run(
      turn({ narration: "A bowl of noodles, 5eb if you are not fussy." }),
      CTX,
    );
    expect(found).toHaveLength(1);
    expect(found[0]?.quote).toBe("5eb");
  });

  it("catches money however it is spelled", () => {
    for (const prose of ["it runs you €$250", "two hundred eurobucks", "fifty eddies"]) {
      expect(noUnsourcedNumber.run(turn({ narration: prose }), CTX), prose).not.toEqual([]);
    }
  });

  it("catches a distance, which is the Difficulty Value in disguise", () => {
    const found = noUnsourcedNumber.run(
      turn({ narration: "Twelve feet of chainlink, and a gate at the end." }),
      CTX,
    );
    expect(found[0]?.quote.toLowerCase()).toBe("twelve feet");
  });

  it("catches a duration, a DV and a damage figure", () => {
    expect(noUnsourcedNumber.run(turn({ narration: "about 20 minutes out" }), CTX)).not.toEqual([]);
    expect(noUnsourcedNumber.run(turn({ narration: "call it DV 15" }), CTX)).not.toEqual([]);
    expect(noUnsourcedNumber.run(turn({ narration: "took 8 damage" }), CTX)).not.toEqual([]);
  });

  it("allows a number the packet already stated", () => {
    // Repeating what the engine said is not inventing it. 20:47 is in CTX.
    expect(noUnsourcedNumber.run(turn({ narration: "The clock reads 20:47." }), CTX)).toEqual([]);
  });

  it("does not flag counting the things in a room", () => {
    // "one guard smoking by the loading dock" is exactly the specific the
    // narrator is ASKED for. A checker that flagged it would be telling the
    // narrator to stop doing its job — the rule is about money, time, distance,
    // difficulty and damage, not about counting.
    const prose =
      "Two cameras sweep the wall. One guard smokes by the dock. Three crates sit unclaimed.";
    expect(noUnsourcedNumber.run(turn({ narration: prose }), CTX)).toEqual([]);
  });

  it("reports each distinct offender once, not once per mention", () => {
    const found = noUnsourcedNumber.run(
      turn({ narration: "5eb a bowl. 5eb! And the next place wants 5eb too." }),
      CTX,
    );
    expect(found).toHaveLength(1);
  });
});

describe("naming a way in", () => {
  it("catches the phrasings the prompt forbids by name", () => {
    for (const prose of [
      "You could go around the back.",
      "Perhaps you want to talk to her first.",
      "One option is the service door.",
      "If you wanted to, the window is open.",
    ]) {
      expect(namesNoWayIn.run(turn({ narration: prose }), CTX), prose).not.toEqual([]);
    }
  });

  it("quotes enough of the line to read it", () => {
    const found = namesNoWayIn.run(
      turn({ narration: "The shutter is down at the front. You could go around the back." }),
      CTX,
    );
    expect(found[0]?.quote).toContain("around the back");
  });

  it("leaves a flat statement of fact alone", () => {
    const prose = "The shutter is down. The side door is propped with a brick.";
    expect(namesNoWayIn.run(turn({ narration: prose }), CTX)).toEqual([]);
  });
});

describe("ending on the world", () => {
  it("catches the interface's own question in the prose", () => {
    const found = endsOnTheWorld.run(turn({ narration: "The van backs up. What do you do?" }), CTX);
    expect(found).not.toEqual([]);
  });

  it("allows a question that is part of the scene", () => {
    const prose = '"You got a name?" he says, and goes back to his screen.';
    expect(endsOnTheWorld.run(turn({ narration: prose }), CTX)).toEqual([]);
  });
});

describe("options only when asked", () => {
  it("catches a menu nobody asked for", () => {
    const found = optionsOnlyWhenAsked.run(turn({ offeredOptions: ["Talk to her", "Leave"] }), CTX);
    expect(found).toHaveLength(1);
  });

  it("allows them on a turn that asked", () => {
    const asked = ctx({ optionsRequested: true });
    expect(optionsOnlyWhenAsked.run(turn({ offeredOptions: ["Talk to her"] }), asked)).toEqual([]);
  });
});

describe("closed vocabularies", () => {
  it("catches an npcKey the packet never supplied", () => {
    const found = knownNpcKeysOnly.run(turn({ npcKeys: ["some_guy"] }), CTX);
    expect(found[0]?.quote).toBe("some_guy");
  });

  it("allows one the packet did supply", () => {
    expect(knownNpcKeysOnly.run(turn({ npcKeys: ["wakako_okada"] }), CTX)).toEqual([]);
  });

  it("catches an observation word outside the engine's list", () => {
    expect(closedObservationWords.run(turn({ observations: ["rude"] }), CTX)).not.toEqual([]);
    expect(closedObservationWords.run(turn({ observations: ["killed"] }), CTX)).toEqual([]);
  });

  it("catches a walk-on the art catalog does not have", () => {
    expect(walkOnsFromCatalog.run(turn({ walkOns: ["astronaut"] }), CTX)).not.toEqual([]);
  });
});

describe("a fact the character has not found", () => {
  const withheld = ctx({
    withheldTruths: [
      {
        truth: "The buyer is Arasaka, working through a shell called Kenbishi Holdings",
        tells: ["arasaka", "kenbishi"],
      },
    ],
  });

  it("catches the model having guessed it and stated it", () => {
    const prose =
      "She mentions Kenbishi Holdings, and the way she says it tells you Arasaka is " +
      "behind the shell, working the buyer side.";
    expect(withheldStaysWithheld.run(turn({ narration: prose }), withheld)).not.toEqual([]);
  });

  it("survives the model paraphrasing, because the tells are authored", () => {
    // The first version of this check pulled long words out of the truth's own
    // sentence and wanted all of them. This prose leaks the whole thing and
    // that version stayed silent, because it was also holding out for
    // "through" and "called".
    const prose =
      "She mentions Kenbishi Holdings. The way she says it tells you who is really " +
      "buying, and it is Arasaka.";
    expect(withheldStaysWithheld.run(turn({ narration: prose }), withheld)).not.toEqual([]);
  });

  it("leaves prose that circles it without saying it", () => {
    const prose = "She will not say who is buying. The pause before she does not say it is long.";
    expect(withheldStaysWithheld.run(turn({ narration: prose }), withheld)).toEqual([]);
  });

  it("does not fire on one tell alone", () => {
    // A lone "Arasaka" in Night City is weather. Flagging it would bury the
    // report in noise, which is the other way a checker stops being read.
    const prose = "An Arasaka billboard washes the street red, then blue.";
    expect(withheldStaysWithheld.run(turn({ narration: prose }), withheld)).toEqual([]);
  });
});

describe("a risky intent gets dice", () => {
  it("catches a scene resolved entirely in narration", () => {
    const risky = ctx({ riskyIntent: true });
    const found = riskGetsDice.run(turn({ proposedActionCount: 0 }), risky);
    expect(found).toHaveLength(1);
  });

  it("is satisfied by a proposed action", () => {
    const risky = ctx({ riskyIntent: true });
    expect(riskGetsDice.run(turn({ proposedActionCount: 1 }), risky)).toEqual([]);
  });

  it("says nothing on a turn the scenario did not call risky", () => {
    expect(riskGetsDice.run(turn({ proposedActionCount: 0 }), CTX)).toEqual([]);
  });
});

describe("a quiet evening", () => {
  const quiet = ctx({ mustStayQuiet: true });

  it("catches the three things the prompt names", () => {
    for (const prose of [
      "Your agent buzzes on the counter.",
      "There is a knock at the door.",
      "A noise in the corridor, then nothing.",
    ]) {
      expect(quietStaysQuiet.run(turn({ narration: prose }), quiet), prose).not.toEqual([]);
    }
  });

  it("allows an evening that is genuinely just an evening", () => {
    const prose =
      "The kettle ticks as it cools. Rent is due Thursday and the jacket is still torn.";
    expect(quietStaysQuiet.run(turn({ narration: prose }), quiet)).toEqual([]);
  });
});

describe("prose budget", () => {
  it("catches a turn that ran long", () => {
    const long = turn({ narration: "word ".repeat(200) });
    expect(withinProseBudget.run(long, ctx({ wordBudget: 120 }))).not.toEqual([]);
  });

  it("says nothing when the scenario set no budget", () => {
    expect(withinProseBudget.run(turn({ narration: "word ".repeat(500) }), CTX)).toEqual([]);
  });
});

describe("the check list itself", () => {
  it("gives every check a unique id and a source", () => {
    // A check that traces to nothing is a taste argument, and the eval is not
    // where those are settled.
    const ids = ALL_CHECKS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const check of ALL_CHECKS) {
      expect(check.source, check.id).toMatch(/PRODUCT\.md|AGENTS\.md|prompts?:/i);
      expect(check.title, check.id).not.toBe("");
    }
  });
});
