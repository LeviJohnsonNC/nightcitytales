import { describe, expect, it } from "vitest";
import { FLAVOR_SUBJECTS } from "../flavorArt";
import {
  cleanWalkOnName,
  nameTheyLearned,
  normalizeWalkOnMentions,
  resolveWalkOns,
} from "../walkOnMention";

const KNOWN_SUBJECT = FLAVOR_SUBJECTS[0]!;

describe("normalizeWalkOnMentions()", () => {
  it("keeps a mention naming a known subject", () => {
    const out = normalizeWalkOnMentions([{ subject: KNOWN_SUBJECT, gender: "female" }]);
    expect(out).toEqual([{ subject: KNOWN_SUBJECT, gender: "female" }]);
  });

  it("keeps a mention with no gender at all", () => {
    const out = normalizeWalkOnMentions([{ subject: KNOWN_SUBJECT }]);
    expect(out).toEqual([{ subject: KNOWN_SUBJECT }]);
  });

  it("drops a subject the catalog does not know", () => {
    expect(normalizeWalkOnMentions([{ subject: "a-person-nobody-drew" }])).toEqual([]);
  });

  it("drops an unrecognized gender rather than passing it through", () => {
    const out = normalizeWalkOnMentions([{ subject: KNOWN_SUBJECT, gender: "unspecified" }]);
    expect(out).toEqual([{ subject: KNOWN_SUBJECT }]);
  });

  it("ignores non-object items and non-array input", () => {
    expect(normalizeWalkOnMentions(["a string", null, 5])).toEqual([]);
    expect(normalizeWalkOnMentions(null)).toEqual([]);
    expect(normalizeWalkOnMentions(undefined)).toEqual([]);
  });

  it("caps the list at three", () => {
    const raw = Array.from({ length: 10 }, () => ({ subject: KNOWN_SUBJECT }));
    expect(normalizeWalkOnMentions(raw)).toHaveLength(3);
  });
});

describe("resolveWalkOns()", () => {
  it("resolves every valid mention to a concrete gender", () => {
    const out = resolveWalkOns([{ subject: KNOWN_SUBJECT }], "campaign-1:some-place");
    expect(out).toHaveLength(1);
    expect(["male", "female"]).toContain(out[0]?.gender);
    expect(out[0]?.subject).toBe(KNOWN_SUBJECT);
  });

  it("keeps a requested gender that this subject actually has", () => {
    const out = resolveWalkOns([{ subject: KNOWN_SUBJECT, gender: "male" }], "seed");
    expect(out).toMatchObject([{ subject: KNOWN_SUBJECT, gender: "male" }]);
  });

  it("is stable for the same seed and subject across calls", () => {
    const seed = "campaign-9:skivs-counter";
    const first = resolveWalkOns([{ subject: KNOWN_SUBJECT }], seed);
    const second = resolveWalkOns([{ subject: KNOWN_SUBJECT }], seed);
    expect(second).toEqual(first);
  });

  it("tolerates a caller whose mentions never got normalized (a test fixture, an older mock)", () => {
    expect(resolveWalkOns(undefined, "seed")).toEqual([]);
    expect(resolveWalkOns(null as never, "seed")).toEqual([]);
  });

  it("drops nothing silently invalid: an unknown subject never reaches here in the first place", () => {
    // resolveWalkOns trusts its input is already normalized; this documents
    // that an unresolvable subject (no art at all) is dropped rather than
    // thrown, matching normalizeWalkOnMentions' own drop-don't-throw rule.
    const out = resolveWalkOns([{ subject: "not-a-real-subject" }], "seed");
    expect(out).toEqual([]);
  });
});

describe("a walk-on's name", () => {
  it("is a short run of letters and never a cast member's", () => {
    expect(cleanWalkOnName("  Mara   Ketter ")).toBe("Mara Ketter");
    expect(cleanWalkOnName("Dae-ho O'Neill")).toBe("Dae-ho O'Neill");
    expect(cleanWalkOnName("Ilsa Bräun")).toBeUndefined();
    expect(cleanWalkOnName("Kit Mwangi")).toBeUndefined();
    expect(cleanWalkOnName("R2D2")).toBeUndefined();
    expect(cleanWalkOnName('"Boss"')).toBeUndefined();
    expect(cleanWalkOnName("A")).toBeUndefined();
    expect(cleanWalkOnName("x".repeat(41))).toBeUndefined();
    expect(cleanWalkOnName(7)).toBeUndefined();
  });

  it("rides on the mention the model tagged", () => {
    expect(normalizeWalkOnMentions([{ subject: "dive-bar-tender", name: "Mara Ketter" }])).toEqual([
      { subject: "dive-bar-tender", name: "Mara Ketter" },
    ]);
    expect(normalizeWalkOnMentions([{ subject: "dive-bar-tender", name: "Ilsa Bräun" }])).toEqual([
      { subject: "dive-bar-tender" },
    ]);
  });

  it("is the player's to know only when the passage says it", () => {
    const text = "Mara Ketter wipes the counter. Mara nods.";
    expect(nameTheyLearned("Mara Ketter", text)).toBe("Mara Ketter");
    // Only the first name was said: that is all they have learned.
    expect(nameTheyLearned("Mara Ketter", "Mara nods at you.")).toBe("Mara");
    expect(nameTheyLearned("Mara Ketter", "The tender nods at you.")).toBeUndefined();
    // Whole words only: a name inside another word is not said.
    expect(nameTheyLearned("Ann", "A bad channel hums.")).toBeUndefined();
    expect(nameTheyLearned(undefined, text)).toBeUndefined();
  });

  it("is kept by resolveWalkOns only against the passage, and never given a role's gender by it", () => {
    const mentions = [{ subject: "dive-bar-tender", name: "Mara Ketter" }];
    expect(resolveWalkOns(mentions, "c1:p", [], { text: "Mara Ketter pours." })[0]?.name).toBe(
      "Mara Ketter",
    );
    expect(
      resolveWalkOns(mentions, "c1:p", [], { text: "The tender pours." })[0],
    ).not.toHaveProperty("name");
    // No passage handed in, no name: it cannot be checked, so it is not trusted.
    expect(resolveWalkOns(mentions, "c1:p")[0]).not.toHaveProperty("name");
  });
});
