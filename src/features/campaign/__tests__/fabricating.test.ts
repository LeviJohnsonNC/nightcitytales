/**
 * Parts left on the bench.
 *
 * The printed rule is that a failed build starts over "with materials intact",
 * so a retry must not be charged for parts a second time. That memory lives in
 * the campaign's existing `role_state` blob beside the Specialty division the
 * Role panel writes, which is why it needs no schema of its own — and why it
 * must not trample the rest of that blob on the way past.
 */
import { describe, expect, it } from "vitest";
import { materialsKey, materialsOnHand } from "../fabricating";

describe("materialsKey", () => {
  it("addresses a build by its kind and its item, so two kinds never collide", () => {
    expect(materialsKey("weapon", "shotgun")).toBe("weapon:shotgun");
    expect(materialsKey("gear", "shotgun")).not.toBe(materialsKey("weapon", "shotgun"));
  });
});

describe("materialsOnHand", () => {
  it("reads the set the maker block is carrying", () => {
    const state = {
      maker: { specialties: { fabrication_expertise: 2 }, materials: ["weapon:shotgun"] },
    };
    expect(materialsOnHand(state)).toEqual(["weapon:shotgun"]);
  });

  it("is empty for a campaign that has never built anything", () => {
    expect(materialsOnHand(null)).toEqual([]);
    expect(materialsOnHand(undefined)).toEqual([]);
    expect(materialsOnHand({})).toEqual([]);
    expect(materialsOnHand({ maker: {} })).toEqual([]);
    // A Solo's campaign has a role_state, and no maker block in it at all.
    expect(materialsOnHand({ combat_awareness: { allocation: { precision_attack: 3 } } })).toEqual(
      [],
    );
  });

  it("ignores anything in there that is not a key", () => {
    expect(materialsOnHand({ maker: { materials: "weapon:shotgun" } })).toEqual([]);
    expect(materialsOnHand({ maker: { materials: [1, null, "weapon:shotgun", {}] } })).toEqual([
      "weapon:shotgun",
    ]);
  });
});
