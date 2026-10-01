import { describe, expect, it } from "vitest";
import { SKILLS, specializationOptions } from "@/engine";

describe("specialization pick-lists", () => {
  it("offers the Cultural Origin languages, and Streetslang the packages grant", () => {
    const languages = specializationOptions("language")!;
    expect(languages).toEqual(expect.arrayContaining(["French", "Japanese", "Streetslang"]));
    expect(new Set(languages).size).toBe(languages.length);
  });

  it("offers common names for Science, Martial Arts and Play Instrument", () => {
    expect(specializationOptions("science")).toContain("Chemistry");
    expect(specializationOptions("martial_arts")).toContain("Judo");
    expect(specializationOptions("play_instrument")).toContain("Guitar");
  });

  it("leaves Local Expert to the map, and unspecialised Skills alone", () => {
    expect(specializationOptions("local_expert")).toBeNull();
    expect(specializationOptions("handgun")).toBeNull();
  });

  it("covers every Skill that asks the player to name something, bar the district one", () => {
    for (const skill of SKILLS.filter((s) => s.requiresSpecialization)) {
      if (skill.id === "local_expert") continue;
      expect(specializationOptions(skill.id), skill.id).not.toBeNull();
    }
  });
});
