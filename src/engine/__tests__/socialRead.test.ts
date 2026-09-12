import { describe, expect, it } from "vitest";
import {
  GUARDED_AT,
  INSIGHT_MARGIN,
  REVEAL_LADDER,
  SOCIAL_SHAPES,
  SUSPICION_COOLS_AFTER_DAYS,
  canRead,
  isGuarded,
  mappedSocialSkills,
  raiseSuspicion,
  readsThePerson,
  shapeForSkill,
  shapeOf,
  socialRead,
  socialShape,
  suspicionCost,
  suspicionNow,
  type DossierFact,
} from "@/engine";
import { SKILLS, getSkill } from "@/engine/rulesData";

const NOTHING_KNOWN: DossierFact[] = [];

/** Every read in this file is a comfortable win: the margin is not the subject. */
const WON = INSIGHT_MARGIN + 3;

describe("the shape table", () => {
  it("names a printed Skill for every entry", () => {
    for (const skillId of mappedSocialSkills()) {
      expect(() => getSkill(skillId)).not.toThrow();
    }
  });

  it("gives every printed Social Skill a shape", () => {
    // The bug this system exists for was a Skill being treated as a read
    // because of the category it is filed under. Every Social Skill now has to
    // say what it does, including the ones whose answer is "not this".
    const social = SKILLS.filter((skill) => skill.category === "Social");
    expect(social.length).toBeGreaterThanOrEqual(9);
    for (const skill of social) {
      expect(shapeOf(skill.id), `${skill.name} has no shape`).not.toBeNull();
    }
  });

  it("only reaches rungs the dossier ladder actually has", () => {
    for (const shape of SOCIAL_SHAPES) {
      for (const fact of socialShape(shape).reaches) {
        expect(REVEAL_LADDER).toContain(fact);
      }
    }
  });

  it("reads nobody for a Skill it has never heard of", () => {
    expect(shapeForSkill("mind_reading")).toBeNull();
    expect(canRead("mind_reading")).toBe(false);
    expect(socialRead({ skillId: "mind_reading", margin: 20, known: NOTHING_KNOWN }).outcome).toBe(
      "none",
    );
  });
});

describe("nine Social Skills are no longer one Skill", () => {
  it("stops Wardrobe & Style and Personal Grooming reading minds", () => {
    // The headline bug: `readsThePerson` asked for the Skill's CATEGORY, so
    // looking good told you what somebody was hiding.
    for (const skillId of ["wardrobe_style", "personal_grooming"]) {
      expect(canRead(skillId)).toBe(false);
      expect(readsThePerson(skillId, 20)).toBe(false);
      const read = socialRead({ skillId, margin: 20, known: NOTHING_KNOWN });
      expect(read).toEqual({ outcome: "none", why: "reads_nothing", shape: expect.anything() });
    }
  });

  it("keeps Trading about the deal and Streetwise about people who are not here", () => {
    expect(canRead("trading")).toBe(false);
    expect(canRead("streetwise")).toBe(false);
  });

  it("lets talking reach what they want and never what they are hiding", () => {
    const read = socialRead({ skillId: "conversation", margin: WON, known: NOTHING_KNOWN });
    expect(read).toMatchObject({ outcome: "read", fact: "wants" });

    // However well it is rolled, and however much they have already given up.
    const further = socialRead({ skillId: "conversation", margin: 40, known: ["wants", "fear"] });
    expect(further).toMatchObject({ outcome: "none", why: "out_of_reach" });
  });

  it("lets watching them reach the fear without asking a question", () => {
    const read = socialRead({ skillId: "human_perception", margin: WON, known: NOTHING_KNOWN });
    expect(read).toMatchObject({ outcome: "read", fact: "fear" });
    expect(socialShape("observe").needsExchange).toBe(false);
  });

  it("skips the rungs a shape cannot reach rather than queueing behind them", () => {
    // The ladder is the ORDER within a shape's reach, not a queue every shape
    // joins at the back of. A bought answer goes straight to the secret without
    // first learning what they want; leaning on somebody shows you the fear on
    // the way, so it takes a second go to reach the same place.
    expect(socialRead({ skillId: "bribery", margin: WON, known: NOTHING_KNOWN })).toMatchObject({
      outcome: "read",
      fact: "secret",
    });
    expect(
      socialRead({ skillId: "interrogation", margin: WON, known: NOTHING_KNOWN }),
    ).toMatchObject({ outcome: "read", fact: "fear" });
    expect(socialRead({ skillId: "interrogation", margin: WON, known: ["fear"] })).toMatchObject({
      outcome: "read",
      fact: "secret",
    });
  });

  it("still wants a comfortable win, whatever the shape", () => {
    for (const skillId of ["conversation", "human_perception", "interrogation", "bribery"]) {
      const narrow = socialRead({ skillId, margin: INSIGHT_MARGIN - 1, known: NOTHING_KNOWN });
      expect(narrow).toMatchObject({ outcome: "none", why: "narrow_win" });
      expect(readsThePerson(skillId, INSIGHT_MARGIN - 1)).toBe(false);
      expect(readsThePerson(skillId, INSIGHT_MARGIN)).toBe(true);
    }
  });

  it("says which silence it is, because they mean different things", () => {
    // "Everything I can reach, I have" is a nudge to change approach. "They
    // have nothing left" is the end of the person. The caller needs both.
    const all = [...REVEAL_LADDER];
    expect(socialRead({ skillId: "conversation", margin: WON, known: all })).toMatchObject({
      why: "nothing_left",
    });
    expect(socialRead({ skillId: "conversation", margin: WON, known: ["wants"] })).toMatchObject({
      why: "out_of_reach",
    });
  });
});

describe("suspicion", () => {
  it("is free to watch somebody and never free to work them", () => {
    expect(suspicionCost("human_perception")).toBe(0);
    expect(suspicionCost("conversation")).toBe(0);
    expect(suspicionCost("persuasion")).toBeGreaterThan(0);
    expect(suspicionCost("interrogation")).toBeGreaterThan(suspicionCost("persuasion"));
    expect(suspicionCost("bribery")).toBeGreaterThan(0);
  });

  it("closes a guarded person to being asked, and never to being looked at", () => {
    const guarded = GUARDED_AT;
    expect(isGuarded(guarded)).toBe(true);
    expect(isGuarded(guarded - 1)).toBe(false);

    for (const skillId of ["conversation", "persuasion", "interrogation", "bribery"]) {
      expect(
        socialRead({ skillId, margin: 30, known: NOTHING_KNOWN, suspicion: guarded }),
      ).toMatchObject({ outcome: "none", why: "guarded" });
    }
    // The way back in: stop asking.
    expect(
      socialRead({
        skillId: "human_perception",
        margin: WON,
        known: NOTHING_KNOWN,
        suspicion: guarded + 5,
      }),
    ).toMatchObject({ outcome: "read", fact: "fear" });
  });

  it("cools on its own, without anything having to tick it", () => {
    const raised = { points: 3, onDay: 10 };
    expect(suspicionNow(raised, 10)).toBe(3);
    expect(suspicionNow(raised, 10 + SUSPICION_COOLS_AFTER_DAYS - 1)).toBe(3);
    expect(suspicionNow(raised, 10 + SUSPICION_COOLS_AFTER_DAYS)).toBe(2);
    expect(suspicionNow(raised, 10 + SUSPICION_COOLS_AFTER_DAYS * 3)).toBe(0);
    // And never goes negative, however long they are left alone.
    expect(suspicionNow(raised, 9999)).toBe(0);
    expect(suspicionNow(null, 4)).toBe(0);
  });

  it("does not bring an old grudge back when a new one is added", () => {
    // Raising carries TODAY's standing forward, not the number that was
    // written before it had cooled.
    const stale = { points: 3, onDay: 0 };
    const today = SUSPICION_COOLS_AFTER_DAYS * 3;
    expect(suspicionNow(stale, today)).toBe(0);
    const next = raiseSuspicion({ state: stale, add: 1, today });
    expect(next).toEqual({ points: 1, onDay: today });
  });

  it("is spent on information and never on dice", () => {
    // The ruling this whole axis lives under. There is no modifier anywhere in
    // the module: a guarded person is harder to LEARN and no harder to beat.
    const spec = socialShape("lean_on");
    expect(Object.keys(spec)).not.toContain("dv");
    expect(Object.keys(spec)).not.toContain("penalty");
    expect(JSON.stringify(spec)).not.toMatch(/modifier/i);
  });
});
