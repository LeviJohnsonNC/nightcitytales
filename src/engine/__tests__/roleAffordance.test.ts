/**
 * What a Role reaches for. The thing under test is narrow on purpose: this
 * module grants nothing, so what matters is that every Role has an entry, that
 * the lines are phrased as an invitation rather than a permission, and that an
 * unknown Role produces no block at all rather than an empty heading.
 */
import { describe, expect, it } from "vitest";
import { renderRoleAffordanceLines, roleAffordance } from "../roleAffordance";
import rolesData from "@/data/rules/roles.json";

const ROLE_IDS = Object.keys((rolesData as unknown as { roles: Record<string, unknown> }).roles);

describe("roleAffordance", () => {
  it("has an entry for every Role the rules data knows", () => {
    for (const id of ROLE_IDS) {
      expect(roleAffordance(id), id).not.toBeNull();
      expect(roleAffordance(id)!.reach.length, id).toBeGreaterThan(0);
    }
  });

  it("gives each Role its own moves, not a shared list", () => {
    const fixer = roleAffordance("fixer")!.options;
    const nomad = roleAffordance("nomad")!.options;
    expect(fixer).not.toEqual(nomad);
    expect(fixer.some((o) => nomad.includes(o))).toBe(false);
  });

  it("renders nothing at all for a Role it does not know", () => {
    expect(renderRoleAffordanceLines("bartender")).toEqual([]);
    expect(renderRoleAffordanceLines(null)).toEqual([]);
    expect(renderRoleAffordanceLines(undefined)).toEqual([]);
  });

  it("renders the reach line first, then the moves", () => {
    const lines = renderRoleAffordanceLines("lawman");
    expect(lines[0]).toBe(roleAffordance("lawman")!.reach);
    expect(lines.some((l) => l.startsWith("  - "))).toBe(true);
  });
});
