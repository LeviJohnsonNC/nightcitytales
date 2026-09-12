import { describe, expect, it } from "vitest";
import {
  areaKeyOf,
  areaLabel,
  coversArea,
  HOME_AREA,
  isAreaScoped,
  isHomeArea,
  localExpertAreas,
  localExpertLevel,
  LOCAL_EXPERT_SKILL_ID,
} from "../localExpert";
import roleSkillPackages from "@/data/rules/role-skill-packages.json";
import { skillCheckForCharacter, skillLevelFor, type SkillCheckActor } from "../skillCheck";
import { opposedCheckForCharacter } from "../opposedCheck";

/** Returns fixed 0-1 values so die faces are exact (mirrors dice.test.ts). */
const scripted = (faces: number[]) => {
  let i = 0;
  return () => (faces[i++]! - 1) / 10;
};

describe("the printed sentinel", () => {
  /**
   * The one thing in this module that is a transcription rather than a
   * decision. If a reprint spells the placeholder differently, every starting
   * character's home turf silently becomes unresolvable free text, so it fails
   * here instead.
   */
  it("is the phrase the Role packages actually print", () => {
    const packages = Object.values(
      roleSkillPackages.roles as unknown as Record<
        string,
        { skills: { skill: string; specialization: string | null }[] }
      >,
    );
    const printed = packages.flatMap((pkg) =>
      pkg.skills.filter((line) => line.skill === "Local Expert").map((line) => line.specialization),
    );
    expect(printed.length).toBeGreaterThan(0);
    for (const specialization of printed) expect(specialization).toBe(HOME_AREA);
  });

  it("is recognised however it is cased", () => {
    expect(isHomeArea("Your Home")).toBe(true);
    expect(isHomeArea("your home")).toBe(true);
    expect(isHomeArea("  YOUR HOME  ")).toBe(true);
    expect(isHomeArea("Little China")).toBe(false);
    expect(isHomeArea(null)).toBe(false);
  });
});

describe("which Skills are scoped to a place", () => {
  it("is Local Expert and nothing else", () => {
    expect(isAreaScoped(LOCAL_EXPERT_SKILL_ID)).toBe(true);
    // Specialized too, but a tongue and a field of study are not districts.
    expect(isAreaScoped("language")).toBe(false);
    expect(isAreaScoped("science")).toBe(false);
    expect(isAreaScoped("perception")).toBe(false);
  });
});

describe("areaKeyOf", () => {
  it("takes a district key, a printed code, or a name", () => {
    expect(areaKeyOf("little_china")).toBe("little_china");
    expect(areaKeyOf("E")).toBe("little_china");
    expect(areaKeyOf("Little China")).toBe("little_china");
    expect(areaKeyOf("The Glen")).toBe("the_glen");
  });

  it("resolves the printed placeholder through the character's home", () => {
    expect(areaKeyOf(HOME_AREA, "the_glen")).toBe("the_glen");
    // A home the atlas does not have is no home at all.
    expect(areaKeyOf(HOME_AREA, "atlantis")).toBeNull();
  });

  it("is null for a character whose home has not been chosen yet", () => {
    expect(areaKeyOf(HOME_AREA, null)).toBeNull();
    expect(areaKeyOf(HOME_AREA)).toBeNull();
  });

  it("is null for anything that is not a neighbourhood on the map", () => {
    // The whole city is not a legal scope for this Skill, so it covers nothing.
    expect(areaKeyOf("Night City")).toBeNull();
    expect(areaKeyOf("my block")).toBeNull();
    expect(areaKeyOf("")).toBeNull();
    expect(areaKeyOf(null)).toBeNull();
  });
});

describe("areaLabel", () => {
  it("gives the district's printed name once it resolves", () => {
    expect(areaLabel("little_china")).toBe("Little China");
    expect(areaLabel(HOME_AREA, "pacifica_playground")).toBe("Pacifica Playground");
  });

  it("leaves an unresolved placeholder saying what it is", () => {
    expect(areaLabel(HOME_AREA, null)).toBe(HOME_AREA);
    expect(areaLabel("my block")).toBe("my block");
    expect(areaLabel(null)).toBeNull();
  });
});

describe("coversArea", () => {
  const covers = (specialization: string | null, area: string, home?: string | null) =>
    coversArea({
      skillId: LOCAL_EXPERT_SKILL_ID,
      specialization,
      area,
      ...(home === undefined ? {} : { homeDistrictKey: home }),
    });

  it("matches a district however either side spells it", () => {
    expect(covers("Little China", "little_china")).toBe(true);
    expect(covers("little_china", "E")).toBe(true);
    expect(covers("E", "Little China")).toBe(true);
  });

  it("does not cover the district next door", () => {
    expect(covers("little_china", "pacifica_playground")).toBe(false);
    expect(covers("the_glen", "downtown")).toBe(false);
  });

  it("covers the home district through the placeholder", () => {
    expect(covers(HOME_AREA, "the_glen", "the_glen")).toBe(true);
    expect(covers(HOME_AREA, "kabuki", "the_glen")).toBe(false);
  });

  it("covers nowhere when the Skill names nowhere on the map", () => {
    expect(covers("Night City", "little_china")).toBe(false);
    expect(covers(null, "little_china")).toBe(false);
    expect(covers(HOME_AREA, "little_china", null)).toBe(false);
  });

  it("compares plain text for a Skill that is not place-scoped", () => {
    const language = (specialization: string, area: string) =>
      coversArea({ skillId: "language", specialization, area });
    expect(language("Mandarin", "mandarin")).toBe(true);
    expect(language("Mandarin", "Spanish")).toBe(false);
  });
});

describe("localExpertLevel", () => {
  const skills = [
    { skillId: LOCAL_EXPERT_SKILL_ID, level: 6, specialization: "little_china" },
    { skillId: LOCAL_EXPERT_SKILL_ID, level: 3, specialization: "The Glen" },
    { skillId: "streetwise", level: 8, specialization: null },
  ];

  it("is the Level for the district asked about", () => {
    expect(localExpertLevel(skills, "little_china")).toBe(6);
    expect(localExpertLevel(skills, "the_glen")).toBe(3);
  });

  it("is zero in a neighbourhood they are not a local in", () => {
    expect(localExpertLevel(skills, "pacifica_playground")).toBe(0);
    expect(localExpertLevel(skills, null)).toBe(0);
  });

  it("takes the best line when two cover the same ground", () => {
    const twice = [
      { skillId: LOCAL_EXPERT_SKILL_ID, level: 2, specialization: "little_china" },
      { skillId: LOCAL_EXPERT_SKILL_ID, level: 7, specialization: "Little China" },
    ];
    expect(localExpertLevel(twice, "little_china")).toBe(7);
  });

  it("reads the placeholder through the home district", () => {
    const starting = [{ skillId: LOCAL_EXPERT_SKILL_ID, level: 4, specialization: HOME_AREA }];
    expect(localExpertLevel(starting, "kabuki", "kabuki")).toBe(4);
    expect(localExpertLevel(starting, "downtown", "kabuki")).toBe(0);
    expect(localExpertLevel(starting, "kabuki", null)).toBe(0);
  });
});

describe("localExpertAreas", () => {
  it("names every neighbourhood they are a local in, best first", () => {
    const areas = localExpertAreas(
      [
        { skillId: LOCAL_EXPERT_SKILL_ID, level: 3, specialization: "The Glen" },
        { skillId: LOCAL_EXPERT_SKILL_ID, level: 6, specialization: "little_china" },
        { skillId: LOCAL_EXPERT_SKILL_ID, level: 2, specialization: HOME_AREA },
        { skillId: "perception", level: 9, specialization: null },
      ],
      "kabuki",
    );
    expect(areas).toEqual([
      { districtKey: "little_china", districtName: "Little China", level: 6 },
      { districtKey: "the_glen", districtName: "The Glen", level: 3 },
      { districtKey: "kabuki", districtName: "Kabuki", level: 2 },
    ]);
  });

  it("leaves out the placeholder until a home has been chosen", () => {
    expect(
      localExpertAreas([{ skillId: LOCAL_EXPERT_SKILL_ID, level: 2, specialization: HOME_AREA }]),
    ).toEqual([]);
  });

  it("leaves out a line that names nowhere on the map", () => {
    expect(
      localExpertAreas([
        { skillId: LOCAL_EXPERT_SKILL_ID, level: 5, specialization: "Night City" },
      ]),
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The reason the module exists: a check reads the right line, or no line.
// ---------------------------------------------------------------------------

const local: SkillCheckActor = {
  stats: { int: 6, cool: 5 },
  skills: [
    { skillId: LOCAL_EXPERT_SKILL_ID, level: 6, specialization: "little_china" },
    { skillId: "language", level: 4, specialization: "Mandarin" },
    { skillId: "language", level: 2, specialization: "Streetslang" },
    { skillId: "persuasion", level: 3, specialization: null },
  ],
  homeDistrictKey: null,
};

describe("skillLevelFor", () => {
  it("gives the Level for the district named", () => {
    expect(skillLevelFor(local, LOCAL_EXPERT_SKILL_ID, "little_china")).toBe(6);
  });

  it("gives zero for a district no line covers", () => {
    expect(skillLevelFor(local, LOCAL_EXPERT_SKILL_ID, "pacifica_playground")).toBe(0);
  });

  it("falls back to the best line when no area is named", () => {
    // The behaviour every caller had before specializations were read at all,
    // and the only honest answer for a Skill whose specialization the engine
    // cannot resolve against anything.
    expect(skillLevelFor(local, LOCAL_EXPERT_SKILL_ID)).toBe(6);
    expect(skillLevelFor(local, "language")).toBe(4);
  });

  it("leaves an unspecialized Skill exactly as it was", () => {
    expect(skillLevelFor(local, "persuasion")).toBe(3);
    expect(skillLevelFor(local, "persuasion", "little_china")).toBe(3);
  });

  it("is zero for a Skill the character has no line for", () => {
    expect(skillLevelFor(local, "autofire")).toBe(0);
  });
});

describe("a Local Expert check", () => {
  it("adds the Level in the district the character is standing in", () => {
    const roll = skillCheckForCharacter(
      { ...local, districtKey: "little_china" },
      LOCAL_EXPERT_SKILL_ID,
      15,
      scripted([7]),
    );
    expect(roll.total).toBe(19);
    expect(roll.success).toBe(true);
    expect(roll.formula).toContain("Local Expert (Little China)(6)");
  });

  it("adds nothing at all three districts over", () => {
    const roll = skillCheckForCharacter(
      { ...local, districtKey: "pacifica_playground" },
      LOCAL_EXPERT_SKILL_ID,
      15,
      scripted([7]),
    );
    expect(roll.total).toBe(13);
    expect(roll.success).toBe(false);
    // The card says why the number is what it is, rather than looking broken.
    expect(roll.formula).toContain("Local Expert (Pacifica Playground)(0)");
  });

  it("can be asked about somewhere the character is not standing", () => {
    const roll = skillCheckForCharacter(
      { ...local, districtKey: "pacifica_playground" },
      LOCAL_EXPERT_SKILL_ID,
      15,
      scripted([7]),
      { area: "little_china" },
    );
    expect(roll.total).toBe(19);
  });

  it("is worth its Level in an opposed check for the same ground", () => {
    const opposition = { name: "A Tyger Claw", skillId: "streetwise", skillLevel: 4, statValue: 5 };
    const here = opposedCheckForCharacter(
      { ...local, districtKey: "little_china" },
      LOCAL_EXPERT_SKILL_ID,
      opposition,
      scripted([7, 5]),
    );
    expect(here.actor.total).toBe(19);
    expect(here.actorSide.skillLabel).toBe("Local Expert (Little China)");

    const elsewhere = opposedCheckForCharacter(
      { ...local, districtKey: "old_japantown" },
      LOCAL_EXPERT_SKILL_ID,
      opposition,
      scripted([7, 5]),
    );
    expect(elsewhere.actor.total).toBe(13);
  });
});

describe("every other Skill", () => {
  it("is unchanged by where the character is standing", () => {
    const here = skillCheckForCharacter(
      { ...local, districtKey: "little_china" },
      "persuasion",
      15,
      scripted([7]),
    );
    const elsewhere = skillCheckForCharacter(
      { ...local, districtKey: "kabuki" },
      "persuasion",
      15,
      scripted([7]),
    );
    expect(here.total).toBe(elsewhere.total);
    expect(here.formula).toContain("Persuasion(3)");
  });

  it("still reads a Language line the district cannot possibly name", () => {
    // Language is specialized, and standing in Little China says nothing about
    // which tongue is being spoken. It must not be zeroed by a district.
    const roll = skillCheckForCharacter(
      { ...local, districtKey: "kabuki" },
      "language",
      15,
      scripted([7]),
    );
    expect(roll.total).toBe(17);
    expect(roll.formula).toContain("Language(4)");
  });
});
