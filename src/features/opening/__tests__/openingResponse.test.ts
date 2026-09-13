import { describe, expect, it } from "vitest";
import { OPENING_CHOICES, OPENING_FALLBACK } from "@/engine";
import { EmptyOpeningError, normalizeOpening, paragraphsOf } from "../openingResponse";

/**
 * The doors are ours.
 *
 * The model writes how each one SOUNDS; it does not get to decide how many
 * there are, what they are called internally, or which of them exist. A model
 * that returns three doors, five doors, or the same door twice must still
 * produce a playable first screen — this is the player's very first minute, and
 * it cannot be the place the game throws.
 *
 * The prose is the one exception, and it is deliberate: empty prose is a failed
 * generation and is reported as one, because a stand-in opening is worse than a
 * retry. That is the call recorded in the plan.
 */

const wire = (over: Partial<Parameters<typeof normalizeOpening>[0]> = {}) => ({
  title: "The Sixth Floor",
  opening: "The lift has been out for a week.\n\nSomebody is shouting two floors down.",
  choices: OPENING_CHOICES.map((choice) => ({
    choice,
    label: `Do ${choice}`,
    line: `This is what ${choice} means.`,
  })),
  ...over,
});

describe("normalizeOpening", () => {
  it("keeps every door, in the engine's order", () => {
    const opening = normalizeOpening(wire());
    expect(opening.doors.map((d) => d.choice)).toEqual([...OPENING_CHOICES]);
  });

  it("splits the prose on blank lines and collapses the wrapping inside a paragraph", () => {
    const opening = normalizeOpening(
      wire({ opening: "One\nstill one.\n\n\nTwo.\n\n   \n\nThree." }),
    );
    expect(opening.paragraphs).toEqual(["One still one.", "Two.", "Three."]);
  });

  it("restores a door the model forgot", () => {
    const opening = normalizeOpening(
      wire({ choices: [{ choice: "take_work", label: "Answer it", line: "The phone is lit." }] }),
    );
    expect(opening.doors).toHaveLength(OPENING_CHOICES.length);
    expect(opening.doors[0]).toEqual({
      choice: "take_work",
      label: "Answer it",
      line: "The phone is lit.",
    });
    // The three it skipped come back in the engine's own words.
    expect(opening.doors[1]?.label).toBe(OPENING_FALLBACK["see_someone"].label);
  });

  it("drops a door the model invented", () => {
    const opening = normalizeOpening(
      wire({
        choices: [
          { choice: "steal_a_car", label: "Steal a car", line: "Not a door." },
          ...OPENING_CHOICES.map((choice) => ({ choice, label: "L", line: "D" })),
        ],
      }),
    );
    expect(opening.doors.map((d) => d.choice)).toEqual([...OPENING_CHOICES]);
    expect(opening.doors.some((d) => d.label === "Steal a car")).toBe(false);
  });

  it("keeps the first writing of a duplicated door, not the last", () => {
    const opening = normalizeOpening(
      wire({
        choices: [
          { choice: "take_work", label: "Answer it", line: "The phone is lit." },
          { choice: "take_work", label: "Answer it again", line: "No." },
        ],
      }),
    );
    expect(opening.doors[0]?.label).toBe("Answer it");
  });

  it("falls back on a door whose label came back empty", () => {
    const opening = normalizeOpening(
      wire({ choices: [{ choice: "take_work", label: "   ", line: "Something." }] }),
    );
    expect(opening.doors[0]?.label).toBe(OPENING_FALLBACK["take_work"].label);
  });

  it("keeps a written label whose line came back empty", () => {
    const opening = normalizeOpening(
      wire({ choices: [{ choice: "take_work", label: "Answer it", line: "" }] }),
    );
    expect(opening.doors[0]?.label).toBe("Answer it");
    expect(opening.doors[0]?.line).toBe(OPENING_FALLBACK["take_work"].line);
  });

  it("refuses to invent prose, because the prose is the whole experience", () => {
    expect(() => normalizeOpening(wire({ opening: "" }))).toThrow(EmptyOpeningError);
    expect(() => normalizeOpening(wire({ opening: "   \n\n  " }))).toThrow(EmptyOpeningError);
  });

  it("still names the night when the title came back empty", () => {
    expect(normalizeOpening(wire({ title: "" })).title).toBe("Night City");
  });
});

describe("paragraphsOf", () => {
  it("returns nothing for nothing", () => {
    expect(paragraphsOf("")).toEqual([]);
    expect(paragraphsOf("\n\n\n")).toEqual([]);
  });
});
