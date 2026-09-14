/**
 * What there is to do somewhere AS this person.
 *
 * The failure this exists against: a Fixer, a Nomad and a Lawman standing in
 * the same district were offered exactly the same five things, because nothing
 * in the offer list had ever heard of a Role. These tests hold the two
 * properties that matter — a Role sees something nobody else does, and nobody
 * loses anything they had before it existed.
 */
import { describe, expect, it } from "vitest";
import actionFile from "@/data/atlas/place-actions.json";
import rolesData from "@/data/rules/roles.json";
import skillsData from "@/data/rules/skills.json";
import {
  DISTRICTS,
  MAX_PLACE_ROLE_ACTIONS,
  PLACE_TAGS,
  placeActions,
  type PlaceAction,
} from "@/engine";

const FILE = actionFile as unknown as {
  roleActionCap: number;
  roleActions: { key: string; roles: string[]; tags: string[]; skill?: string | null }[];
};
const ROLE_IDS = Object.keys((rolesData as unknown as { roles: Record<string, unknown> }).roles);

/** Every skill id the rules data knows, however deeply it nests them. */
const SKILL_IDS = (() => {
  const acc = new Set<string>();
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === "object") {
      const record = node as Record<string, unknown>;
      if (typeof record["id"] === "string") acc.add(record["id"]);
      Object.values(record).forEach(walk);
    }
  };
  walk(skillsData);
  return acc;
})();

const roleOffersIn = (districtKey: string, roleId?: string): PlaceAction[] =>
  placeActions({ districtKey, ...(roleId ? { roleId } : {}) }).filter((a) => a.role);

describe("role action data", () => {
  it("names only Roles the rules data knows", () => {
    for (const action of FILE.roleActions) {
      expect(action.roles.length, action.key).toBeGreaterThan(0);
      for (const role of action.roles) expect(ROLE_IDS, action.key).toContain(role);
    }
  });

  it("is grounded on real place tags and real Skill ids", () => {
    for (const action of FILE.roleActions) {
      expect(action.tags.length, action.key).toBeGreaterThan(0);
      for (const tag of action.tags) expect(PLACE_TAGS, action.key).toContain(tag);
      if (action.skill) expect(SKILL_IDS, action.key).toContain(action.skill);
    }
  });

  it("covers every Role, so none of them is the one with nothing", () => {
    const covered = new Set(FILE.roleActions.flatMap((a) => a.roles));
    for (const id of ROLE_IDS) expect([...covered], id).toContain(id);
  });
});

describe("placeActions with a Role", () => {
  it("offers nothing Role-specific when no Role is given", () => {
    for (const district of DISTRICTS) {
      expect(roleOffersIn(district.key), district.name).toEqual([]);
    }
  });

  it("never offers a card belonging to another Role", () => {
    const byKey = new Map(FILE.roleActions.map((a) => [a.key, a]));
    for (const district of DISTRICTS) {
      for (const roleId of ROLE_IDS) {
        for (const offer of roleOffersIn(district.key, roleId)) {
          expect(byKey.get(offer.action)?.roles, `${district.name}/${roleId}`).toContain(roleId);
        }
      }
    }
  });

  it("keeps Role offers on their own budget, never taking the district's business", () => {
    for (const district of DISTRICTS) {
      const plain = placeActions({ districtKey: district.key });
      const fixer = placeActions({ districtKey: district.key, roleId: "fixer" });
      // Every ordinary offer a Fixer sees is one everybody sees, in the same order.
      expect(
        fixer.filter((a) => !a.role),
        district.name,
      ).toEqual(plain);
      expect(fixer.filter((a) => a.role).length, district.name).toBeLessThanOrEqual(
        MAX_PLACE_ROLE_ACTIONS,
      );
    }
  });

  it("does actually give somebody something somewhere", () => {
    // The whole point. If the tags and the atlas never meet, this is decoration.
    const seen = new Set<string>();
    for (const district of DISTRICTS) {
      for (const roleId of ROLE_IDS) {
        if (roleOffersIn(district.key, roleId).length > 0) seen.add(roleId);
      }
    }
    for (const id of ROLE_IDS) expect([...seen], id).toContain(id);
  });

  it("names a real venue on every Role offer, like every other offer does", () => {
    for (const district of DISTRICTS) {
      for (const offer of roleOffersIn(district.key, "lawman")) {
        expect(offer.placeName.length).toBeGreaterThan(0);
        expect(offer.placeKey.length).toBeGreaterThan(0);
        expect(offer.minutes).toBeGreaterThan(0);
      }
    }
  });

  it("reads its cap from the data rather than from a literal", () => {
    expect(MAX_PLACE_ROLE_ACTIONS).toBe(FILE.roleActionCap);
  });
});
