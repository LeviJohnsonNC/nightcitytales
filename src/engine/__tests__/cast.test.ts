import { describe, expect, it } from "vitest";
import {
  CAST_ROLES,
  FUNCTIONAL_ROLES,
  INSIGHT_MARGIN,
  PERSONAL_ROLES,
  REVEAL_LADDER,
  STARTING_DISPOSITION,
  generateCast,
  isDossierFact,
  memberInRole,
  nextUnknownFact,
  publicView,
  readsThePerson,
  revealText,
  type CastMember,
  type DossierFact,
} from "@/engine";

const SEEDS = Array.from({ length: 120 }, (_, i) => i * 6151 + 29);

const TIES = {
  friend: "A teacher or mentor.",
  enemy: {
    who: "Ex-lover",
    cause: "Caused a major public humiliation.",
    throwAtYou: "Themselves and a few friends.",
  },
  tragicLove: "Your lover mysteriously vanished.",
};

describe("the cast a campaign opens with", () => {
  it("fills every role exactly once", () => {
    const cast = generateCast({ seed: 1234 });
    expect(cast).toHaveLength(CAST_ROLES.length);
    expect(cast.map((m) => m.role)).toEqual([...CAST_ROLES]);
    expect(new Set(cast.map((m) => m.key)).size).toBe(cast.length);
  });

  it("always brings someone with work, someone with a chair, and the rent", () => {
    const cast = generateCast({ seed: 99 });
    for (const role of FUNCTIONAL_ROLES) {
      expect(memberInRole(cast, role)).not.toBeNull();
    }
  });

  it("is the same cast forever, down to the secrets", () => {
    expect(generateCast({ seed: 777, ties: TIES })).toEqual(
      generateCast({ seed: 777, ties: TIES }),
    );
  });

  it("gives different characters different people", () => {
    const names = new Set(SEEDS.map((seed) => generateCast({ seed })[0]!.name));
    expect(names.size).toBeGreaterThan(1);
    const signatures = new Set(
      SEEDS.map((seed) =>
        generateCast({ seed })
          .map((m) => `${m.name}|${m.dossier.secret}`)
          .join("/"),
      ),
    );
    expect(signatures.size).toBeGreaterThan(100);
  });

  it("opens a friend warm and an enemy cold", () => {
    const cast = generateCast({ seed: 5 });
    expect(memberInRole(cast, "friend")!.disposition).toBe(STARTING_DISPOSITION.friend);
    expect(memberInRole(cast, "enemy")!.disposition).toBeLessThan(0);
    for (const member of cast) {
      expect(member.disposition).toBeGreaterThanOrEqual(-3);
      expect(member.disposition).toBeLessThanOrEqual(3);
    }
  });

  it("gives everyone a complete dossier", () => {
    for (const seed of SEEDS.slice(0, 30)) {
      for (const member of generateCast({ seed })) {
        expect(member.name).not.toBe("");
        expect(member.standing).not.toBe("");
        expect(member.dossier.wants).not.toBe("");
        expect(member.dossier.fear).not.toBe("");
        expect(member.dossier.secret).not.toBe("");
        expect(member.dossier.breakingPoint).not.toBe("");
      }
    }
  });
});

describe("the Lifepath the character actually rolled", () => {
  it("is quoted onto the three personal roles", () => {
    const cast = generateCast({ seed: 42, ties: TIES });
    expect(memberInRole(cast, "friend")!.tie).toBe("A teacher or mentor.");
    expect(memberInRole(cast, "old_flame")!.tie).toBe("Your lover mysteriously vanished.");
    const enemy = memberInRole(cast, "enemy")!.tie ?? "";
    expect(enemy).toBe(
      "Ex-lover. Caused a major public humiliation. They can bring themselves and a few friends.",
    );
  });

  it("leaves the functional three untied to it", () => {
    const cast = generateCast({ seed: 42, ties: TIES });
    for (const role of FUNCTIONAL_ROLES) {
      expect(memberInRole(cast, role)!.tie).toBeNull();
    }
  });

  it("still builds a full cast for a character who answered none of it", () => {
    const cast = generateCast({ seed: 42 });
    expect(cast).toHaveLength(CAST_ROLES.length);
    for (const role of PERSONAL_ROLES) {
      expect(memberInRole(cast, role)!.tie).toBeNull();
    }
  });

  it("does not change who the people are, only what is known about them", () => {
    const withTies = generateCast({ seed: 42, ties: TIES });
    const without = generateCast({ seed: 42 });
    expect(withTies.map((m) => m.name)).toEqual(without.map((m) => m.name));
    expect(withTies.map((m) => m.dossier)).toEqual(without.map((m) => m.dossier));
  });

  it("skips a partly answered enemy rather than printing blanks", () => {
    const cast = generateCast({ seed: 42, ties: { enemy: { who: "Ex-friend" } } });
    expect(memberInRole(cast, "enemy")!.tie).toBe("Ex-friend.");
    const none = generateCast({ seed: 42, ties: { enemy: {} } });
    expect(memberInRole(none, "enemy")!.tie).toBeNull();
  });
});

describe("what the model is allowed to see", () => {
  const member: CastMember = generateCast({ seed: 8, ties: TIES })[0]!;

  it("hands over nothing from the dossier until it is earned", () => {
    const view = publicView(member, []);
    const rendered = JSON.stringify(view);
    expect(view.known).toEqual([]);
    expect(rendered).not.toContain(member.dossier.wants);
    expect(rendered).not.toContain(member.dossier.fear);
    expect(rendered).not.toContain(member.dossier.secret);
    expect(rendered).not.toContain(member.dossier.breakingPoint);
  });

  it("hands over exactly the rungs that were earned, and no others", () => {
    const view = publicView(member, ["wants"]);
    expect(view.known).toHaveLength(1);
    expect(view.known[0]).toContain(member.dossier.wants);
    expect(JSON.stringify(view)).not.toContain(member.dossier.secret);
  });

  it("never leaks the breaking point, which is not learned by insight", () => {
    const view = publicView(member, [...REVEAL_LADDER]);
    expect(view.known).toHaveLength(REVEAL_LADDER.length);
    expect(JSON.stringify(view)).not.toContain(member.dossier.breakingPoint);
  });

  it("keeps the public half public", () => {
    const view = publicView(member, []);
    expect(view.standing).toBe(member.standing);
    expect(view.tie).toBe(member.tie);
    expect(view.disposition).toBe(member.disposition);
  });
});

describe("the reveal ladder", () => {
  it("opens people up in order", () => {
    expect(nextUnknownFact([])).toBe("wants");
    expect(nextUnknownFact(["wants"])).toBe("fear");
    expect(nextUnknownFact(["wants", "fear"])).toBe("secret");
    expect(nextUnknownFact([...REVEAL_LADDER])).toBeNull();
  });

  it("fills a gap before moving on", () => {
    expect(nextUnknownFact(["fear"] as DossierFact[])).toBe("wants");
  });

  it("phrases a reveal as something the character now knows", () => {
    const member = generateCast({ seed: 3 })[0]!;
    expect(revealText(member, "secret")).toContain(member.name);
    expect(revealText(member, "secret")).toContain(member.dossier.secret);
  });

  it("recognises its own facts and nothing else", () => {
    expect(isDossierFact("secret")).toBe(true);
    expect(isDossierFact("breakingPoint")).toBe(false);
    expect(isDossierFact(7)).toBe(false);
  });
});

describe("reading a person off a check", () => {
  it("wants a Social skill and a comfortable win", () => {
    expect(readsThePerson("persuasion", INSIGHT_MARGIN)).toBe(true);
    expect(readsThePerson("human_perception", INSIGHT_MARGIN + 4)).toBe(true);
    expect(readsThePerson("conversation", INSIGHT_MARGIN)).toBe(true);
  });

  it("gives nothing away on a narrow win", () => {
    expect(readsThePerson("persuasion", INSIGHT_MARGIN - 1)).toBe(false);
    expect(readsThePerson("persuasion", 0)).toBe(false);
    expect(readsThePerson("persuasion", -8)).toBe(false);
  });

  it("does not count skills that are not about people", () => {
    expect(readsThePerson("stealth", 20)).toBe(false);
    expect(readsThePerson("handgun", 20)).toBe(false);
  });

  it("shrugs off a skill id that is not printed", () => {
    expect(readsThePerson("mind_reading", 20)).toBe(false);
  });
});
