import { describe, expect, it } from "vitest";
import gearPackages from "@/data/rules/gear-packages.json";
import {
  GEAR,
  getGear,
  isChoice,
  resolvePackageCyberware,
  resolvePackageItem,
  unresolvedVariants,
  variantOptionsFor,
  variantPoints,
  type PackageEntry,
} from "@/engine";

const ROLES = gearPackages.roles as unknown as Record<
  string,
  { weaponsArmor: PackageEntry[]; gear: PackageEntry[]; cyberware: PackageEntry[] }
>;

/** Labels the catalog genuinely does not cover; listed, never guessed at. */
const UNRESOLVED = [/^Program: /];

function allLabels(): string[] {
  const out: string[] = [];
  for (const pkg of Object.values(ROLES)) {
    for (const field of ["weaponsArmor", "gear", "cyberware"] as const) {
      for (const entry of pkg[field]) {
        if (isChoice(entry)) out.push(...entry.choice);
        else out.push(entry.item);
      }
    }
  }
  return [...new Set(out)];
}

describe("gear catalog", () => {
  it("exposes the gear rows from the rules file", () => {
    expect(GEAR.length).toBeGreaterThan(0);
    expect(getGear("agent").name).toBe("Agent");
  });
});

describe("package label resolution", () => {
  it("resolves every package label except the ones the catalog does not cover", () => {
    const misses = allLabels().filter(
      (label) =>
        !resolvePackageItem(label) &&
        !resolvePackageCyberware(label) &&
        !UNRESOLVED.some((re) => re.test(label)),
    );
    expect(misses).toEqual([]);
  });

  it("reads the quantity and armor location out of the label", () => {
    expect(resolvePackageItem("Basic H Pistol Ammunition x100")).toMatchObject({
      kind: "ammunition",
      id: "basic_ammo",
      qty: 100,
    });
    expect(resolvePackageItem("Light Armorjack Head Armor (SP11)")).toMatchObject({
      kind: "armor",
      id: "light_armorjack",
      location: "head",
    });
  });

  it("returns null rather than guessing", () => {
    expect(resolvePackageItem("Program: Sword")).toBeNull();
  });
});

describe("specific weapon picks", () => {
  it("lists the variants of a generic weapon class", () => {
    expect(variantOptionsFor("Heavy Melee Weapon")).toContain("Spiked Bat");
    expect(variantOptionsFor("Heavy Pistol")).toEqual([]);
  });

  it("flags a package weapon class with no specific weapon picked", () => {
    const roleId = Object.keys(ROLES).find((id) =>
      variantPoints(id, {}).length > 0 ? true : false,
    );
    expect(roleId).toBeDefined();
    const points = variantPoints(roleId!, {});
    expect(unresolvedVariants(roleId!, {}, {})).toHaveLength(points.length);
    const picked = Object.fromEntries(points.map((p) => [p.id, p.options[0]!]));
    expect(unresolvedVariants(roleId!, {}, picked)).toEqual([]);
  });
});
