import { describe, expect, it } from "vitest";
import { resolveSkillId } from "../skillMatch";

describe("resolveSkillId", () => {
  it("takes a printed id unchanged", () => {
    expect(resolveSkillId("conceal_reveal_object")).toBe("conceal_reveal_object");
  });

  it("takes the printed display name", () => {
    expect(resolveSkillId("Conceal/Reveal Object")).toBe("conceal_reveal_object");
    expect(resolveSkillId("Perception")).toBe("perception");
  });

  it("takes common GM phrasing through aliases", () => {
    expect(resolveSkillId("Notice")).toBe("perception");
    expect(resolveSkillId("sneak")).toBe("stealth");
    expect(resolveSkillId("Handgun skill")).toBe("handgun");
    expect(resolveSkillId("first aid check")).toBe("first_aid");
  });

  it("refuses to invent a skill", () => {
    expect(resolveSkillId("Vibe Check")).toBeNull();
    expect(resolveSkillId("")).toBeNull();
    expect(resolveSkillId(null)).toBeNull();
  });
});
