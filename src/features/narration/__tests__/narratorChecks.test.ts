import { describe, expect, it } from "vitest";
import {
  ALL_CHECKS,
  closedObservationWords,
  comesOverOnCue,
  directionsAreReal,
  endsOnTheWorld,
  finishesTheRequest,
  goesWhereAsked,
  knownNpcKeysOnly,
  namesNoWayIn,
  noUnsourcedNumber,
  offersTheWire,
  resultStands,
  opensOnSomething,
  optionsOnlyWhenAsked,
  quietStaysQuiet,
  riskGetsDice,
  smallChecksRollThemselves,
  staysInTheScene,
  staysPutOnRefusal,
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

  it("allows the packet's amount said in words, and only that amount", () => {
    // Verbatim from the first live run: the packet priced the drink "10eb" and
    // gave the bar as "2 min on foot", and the narrator said "ten eddies" and
    // "two minutes". That is quoting the engine, not pricing it.
    const ctx = {
      ...CTX,
      packet:
        "Have a drink (The Paper Lantern, 10eb)\n  - bar: The Paper Lantern — 2 min on foot\n",
    };
    const said = (narration: string) => noUnsourcedNumber.run(turn({ narration }), ctx);
    expect(said("She slides it over. Ten eddies.")).toEqual([]);
    expect(said("It's two minutes that way, past the noodle stand.")).toEqual([]);
    expect(said("Eleven eddies, and don't argue.")).not.toEqual([]);
    expect(said("Twenty minutes that way.")).not.toEqual([]);
    // Same amount, different unit: the packet's 10eb is not ten minutes.
    expect(said("Back in ten minutes.")).not.toEqual([]);
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

describe("follow-through: a trip to a kind of place", () => {
  const asked = ctx({ tripToKind: "bar" });

  it("passes a trip that seeks the kind", () => {
    expect(goesWhereAsked.run(turn({ trips: [{ seek: "bar" }] }), asked)).toEqual([]);
  });

  it("passes a trip to a real bar by name", () => {
    expect(goesWhereAsked.run(turn({ trips: [{ destination: "Forlorn Hope" }] }), asked)).toEqual(
      [],
    );
  });

  it('catches the transcript: "a bar" refused, then nothing', () => {
    expect(goesWhereAsked.run(turn({ trips: [] }), asked)).not.toEqual([]);
  });

  it("catches a trip to somewhere that is not a bar", () => {
    const clinic = turn({ trips: [{ destination: "Crisis Medical Center" }] });
    expect(goesWhereAsked.run(clinic, asked)).not.toEqual([]);
  });
});

describe("follow-through: the rest of the request", () => {
  const rest = ctx({ carryThrough: ["counter", "drink", "pour"] });

  it("passes when the prose got to the counter", () => {
    const prose =
      "You take the stool at the end of the counter and the bartender slides a glass over.";
    expect(finishesTheRequest.run(turn({ narration: prose }), rest)).toEqual([]);
  });

  it("passes on a spend, however it is worded", () => {
    expect(finishesTheRequest.run(turn({ spends: 1 }), rest)).toEqual([]);
  });

  it("catches an arrival that stops at the door", () => {
    const prose = "Forlorn Hope sits under a dead sign, the door propped with a crate.";
    expect(finishesTheRequest.run(turn({ narration: prose }), rest)).not.toEqual([]);
  });
});

describe("follow-through: a refused trip stays put", () => {
  const refused = ctx({ staysPut: true });

  it("catches the transcript's retreat up the stairs", () => {
    const prose =
      "Wandering the alleys without a heading is just a good way to burn shoe leather, so " +
      "you haul yourself back up the rusted steel stairs to your own lock.";
    expect(staysPutOnRefusal.run(turn({ narration: prose }), refused)).not.toEqual([]);
  });

  it("catches ending up right where you started", () => {
    const prose = "It leaves you right where you started on your own walkway.";
    expect(staysPutOnRefusal.run(turn({ narration: prose }), refused)).not.toEqual([]);
  });

  it("allows standing still and thinking", () => {
    const prose =
      "You stop on the landing, rain ticking on the rail, and weigh which way the night goes.";
    expect(staysPutOnRefusal.run(turn({ narration: prose }), refused)).toEqual([]);
  });
});

describe("follow-through: directions lead somewhere real", () => {
  const nearest = ctx({ realAnswers: ["Forlorn Hope", "Chrome Cross"] });

  it("passes directions to a place the engine offered", () => {
    const prose = "He jerks his chin north. 'Forlorn Hope. Beer's real, mostly.'";
    expect(directionsAreReal.run(turn({ narration: prose }), nearest)).toEqual([]);
  });

  it("catches the cellar three alleys down", () => {
    const prose = "He tells you which cellar hole three alleys down is serving real beer.";
    expect(directionsAreReal.run(turn({ narration: prose }), nearest)).not.toEqual([]);
  });
});

describe("momentum: the scene keeps its subject", () => {
  const scene = ctx({ offScene: ["jacket", "armor"] });

  it("passes a turn about what the player did", () => {
    const prose = "The bartender taps a bottle with no label. 'This, if you're brave.'";
    expect(staysInTheScene.run(turn({ narration: prose }), scene)).toEqual([]);
  });

  it("catches the chewed jacket taking over the bar", () => {
    const prose = "You glance at the torn jacket on the stool beside you. It needs patching.";
    expect(staysInTheScene.run(turn({ narration: prose }), scene)).not.toEqual([]);
  });
});

describe("momentum: somebody comes over when the engine says so", () => {
  const cue = ctx({ comesOver: "Kiro Tanaka" });

  it("passes when they cross the room", () => {
    const prose = "Kiro slides onto the stool next to you without asking. 'You look terrible.'";
    expect(comesOverOnCue.run(turn({ narration: prose }), cue)).toEqual([]);
  });

  it("catches them left in the corner", () => {
    const prose = "The bar hums along. Someone laughs too loud by the jukebox.";
    expect(comesOverOnCue.run(turn({ narration: prose }), cue)).not.toEqual([]);
  });
});

describe("momentum: a roll that risks nothing rolls itself", () => {
  const idle = ctx({ nothingRiding: true });

  it("passes a turn with no check", () => {
    expect(smallChecksRollThemselves.run(turn({ checks: [] }), idle)).toEqual([]);
  });

  it("passes a check marked low-stakes", () => {
    const marked = turn({ checks: [{ skillId: "perception", dv: 13, lowStakes: true }] });
    expect(smallChecksRollThemselves.run(marked, idle)).toEqual([]);
  });

  it("catches a button press for nothing", () => {
    const unmarked = turn({ checks: [{ skillId: "streetwise", dv: 13, lowStakes: false }] });
    expect(smallChecksRollThemselves.run(unmarked, idle)).not.toEqual([]);
  });

  it("says nothing when something does ride on it", () => {
    const unmarked = turn({ checks: [{ skillId: "streetwise", dv: 13, lowStakes: false }] });
    expect(smallChecksRollThemselves.run(unmarked, CTX)).toEqual([]);
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

describe("the opening line", () => {
  it("catches an opening that is a list of smells", () => {
    for (const prose of [
      "The fourth floor of the Social Sciences building smells like ozone, damp carpet, and thirty years of tenure. It is late.",
      "The Paper Lantern smells of stale rice wine, burnt cooking oil, and ozone. You sit.",
      "The stairwell reeks of fried cabbage, damp plaster and cheap ozone. The rain has stopped.",
    ]) {
      expect(opensOnSomething.run(turn({ narration: prose }), CTX), prose).not.toEqual([]);
    }
  });

  it("leaves a single smell, a later smell, and an opening on action alone", () => {
    for (const prose of [
      "The corridor smells of bleach. A guard is asleep in the booth.",
      "You slide onto the stool. The place smells like fried oil, ozone and wet coats.",
      "The bartender slides a glass across without a word.",
    ]) {
      expect(opensOnSomething.run(turn({ narration: prose }), CTX), prose).toEqual([]);
    }
  });
});

describe("a settled result", () => {
  const ctx = {
    ...CTX,
    resolved: { skillId: "pick_lock", contradicts: ["clicks open", "swings open"] },
  };

  it("catches the settled check asked for again, and the other outcome told", () => {
    const again = turn({
      narration: "The pins will not set.",
      checks: [{ skillId: "pick_lock", dv: 13, lowStakes: false }],
    });
    expect(resultStands.run(again, ctx)).toHaveLength(1);
    const flipped = turn({ narration: "One more twist and the drawer clicks open." });
    expect(resultStands.run(flipped, ctx)[0]?.note).toBe("narrated the other outcome");
  });

  it("passes the result told straight, and a different check that follows from it", () => {
    const fine = turn({
      narration: "The pick snaps off in the cylinder. Down the hall, a door opens.",
      checks: [{ skillId: "stealth", dv: 13, lowStakes: false }],
    });
    expect(resultStands.run(fine, ctx)).toEqual([]);
    expect(resultStands.run(fine, CTX)).toEqual([]);
  });
});

describe("the job on the wire", () => {
  it("catches a night with work on the wire that never offers it", () => {
    const ctx = { ...CTX, wireJob: true };
    expect(offersTheWire.run(turn({ narration: "The rain comes down." }), ctx)).toHaveLength(1);
    expect(
      offersTheWire.run(turn({ narration: "Your agent buzzes.", offersWork: true }), ctx),
    ).toEqual([]);
    expect(offersTheWire.run(turn({ narration: "The rain comes down." }), CTX)).toEqual([]);
  });
});
