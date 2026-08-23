import { describe, expect, it } from "vitest";
import { getSkill, resolveSkillId } from "@/engine";

describe("resolveSkillId", () => {
  it("returns an exact id unchanged", () => {
    expect(resolveSkillId("perception")).toBe("perception");
    expect(resolveSkillId("handgun")).toBe("handgun");
  });

  it("resolves a display name to its canonical id", () => {
    expect(resolveSkillId("Perception")).toBe("perception");
    expect(resolveSkillId("Handgun")).toBe("handgun");
  });

  it("resolves the loose, decorated references a GM might emit", () => {
    expect(resolveSkillId("perception check")).toBe("perception");
    expect(resolveSkillId("HANDGUN roll")).toBe("handgun");
    expect(resolveSkillId(" Perception ")).toBe("perception");
  });

  it("round-trips a resolved id through getSkill", () => {
    const id = resolveSkillId("Handgun");
    expect(id).not.toBeNull();
    expect(getSkill(id!).name).toBe("Handgun");
  });

  it("returns null for an unknown or empty reference", () => {
    expect(resolveSkillId("teleportation")).toBeNull();
    expect(resolveSkillId("")).toBeNull();
  });
});
