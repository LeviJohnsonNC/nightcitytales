import { describe, expect, it } from "vitest";
import { AMMUNITION } from "../catalog";
import {
  AMMO_TYPES,
  ammoNeedsTypeChoice,
  ammoTypeOptions,
  ammoUnitFor,
  ammoVariantLabel,
} from "../ammoTypes";

describe("ammunition delivery types", () => {
  it("resolves every catalog row without guessing", () => {
    for (const ammo of AMMUNITION) {
      const options = ammoTypeOptions(ammo);
      expect(options.length).toBeGreaterThan(0);
      options.forEach((o) => expect(AMMO_TYPES).toContain(o));
    }
  });

  it("expands 'All except Shotgun Shells'", () => {
    const options = ammoTypeOptions("ap_ammo");
    expect(options).not.toContain("Shotgun Shell");
    expect(options).toContain("Grenade");
    expect(options).toContain("Rocket");
    expect(options).toContain("Bullet (Pistol)");
  });

  it("keeps single-type ammo a non-choice", () => {
    expect(ammoTypeOptions("smoke_ammo")).toEqual(["Grenade"]);
    expect(ammoNeedsTypeChoice("smoke_ammo")).toBe(false);
    expect(ammoNeedsTypeChoice("ap_ammo")).toBe(true);
  });

  it("prices grenades and rockets each, everything else per 10", () => {
    expect(ammoUnitFor("Grenade")).toBe("each");
    expect(ammoUnitFor("Rocket")).toBe("each");
    expect(ammoUnitFor("Bullet (Rifle)")).toBe("per 10 units");
    expect(ammoVariantLabel("ap_ammo", "Grenade")).toMatch(/each/);
  });

  it("basic ammunition never lists grenades or rockets", () => {
    const options = ammoTypeOptions("basic_ammo");
    expect(options).not.toContain("Grenade");
    expect(options).not.toContain("Rocket");
  });
});
