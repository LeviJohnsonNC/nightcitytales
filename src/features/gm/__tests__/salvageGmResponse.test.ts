/**
 * Recovering a turn whose JSON did not survive the trip.
 *
 * `generateObject` throws "No object generated: response did not match schema"
 * when the model's output cannot be read as the wire shape. In combat that is
 * the wrong place to give up: the dice were rolled, the damage applied and the
 * encounter saved BEFORE the GM was asked to narrate, so the turn already
 * happened and only the telling of it went missing. The player saw a red error
 * over a fight that had really advanced.
 *
 * What may be recovered and what may not is the whole point of these tests: the
 * fiction, yes; a proposed action read out of a payload that stops mid-sentence,
 * never.
 */
import { describe, expect, it } from "vitest";
import { salvageGmResponse } from "../gmResponse";

describe("salvageGmResponse", () => {
  it("keeps everything when the JSON is complete and merely missed the schema", () => {
    const text = JSON.stringify({
      narration: "The chapel goes quiet.",
      proposedActions: [{ kind: "skill_check", skillId: "perception", dv: 13, intent: "listen" }],
      // Not in the schema at all — the kind of drift that fails a strict parse.
      mood: "tense",
    });
    const got = salvageGmResponse(text);
    expect(got?.narration).toBe("The chapel goes quiet.");
    // A complete payload has earned its actions: nothing was lost in transit.
    expect(got?.proposedActions).toEqual([
      { kind: "skill_check", skillId: "perception", dv: 13, intent: "listen" },
    ]);
  });

  it("recovers the narration from JSON cut off mid-string", () => {
    // The common failure: a long combat turn that ran out of tokens partway
    // through the story, with no closing quote and no closing brace.
    const text = '{"narration": "The slug takes him in the chest and he folds over the pew';
    const got = salvageGmResponse(text);
    expect(got?.narration).toBe("The slug takes him in the chest and he folds over the pew");
  });

  it("drops the actions out of a truncated payload rather than half-reading them", () => {
    // A fight the model may not have finished proposing must not start on the
    // strength of the part that arrived.
    const text =
      '{"narration": "Four of them fan out through the nave.", "proposedActions": [{"kind":"start_encounter","name":"Chapel","arena":"stre';
    const got = salvageGmResponse(text);
    expect(got?.narration).toBe("Four of them fan out through the nave.");
    expect(got?.proposedActions).toEqual([]);
    expect(got?.suggestedActions).toEqual([]);
    expect(got?.stateDeltas).toEqual([]);
    expect(got?.question).toBeNull();
  });

  it("reads the escapes rather than printing them", () => {
    const text = '{"narration": "He says \\"stay down\\".\\nYou do not.';
    expect(salvageGmResponse(text)?.narration).toBe('He says "stay down".\nYou do not.');
  });

  it("takes a model that answered in prose at its word", () => {
    const got = salvageGmResponse("The alley empties out. Nobody follows you.");
    expect(got?.narration).toBe("The alley empties out. Nobody follows you.");
    expect(got?.proposedActions).toEqual([]);
  });

  it("shows the player nothing rather than a wall of broken JSON", () => {
    // Braces but no narration field: there is no fiction in here to rescue, so
    // the caller raises the original error instead.
    expect(salvageGmResponse('{"proposedActions": [{"kind":"attack","targ')).toBeNull();
  });

  it("gives up on an empty or absent response", () => {
    expect(salvageGmResponse("")).toBeNull();
    expect(salvageGmResponse("   ")).toBeNull();
    expect(salvageGmResponse(null)).toBeNull();
    expect(salvageGmResponse(undefined)).toBeNull();
    expect(salvageGmResponse(42)).toBeNull();
  });

  it("does not salvage an empty narration into a blank turn", () => {
    expect(salvageGmResponse('{"narration": "')).toBeNull();
    expect(salvageGmResponse('{"narration": ""}')).toBeNull();
  });
});
