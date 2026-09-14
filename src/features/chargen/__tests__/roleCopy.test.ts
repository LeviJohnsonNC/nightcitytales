/**
 * The wizard's own copy for the Role picker.
 *
 * Two rules it has to keep. Every Role needs a hook, because the grid is the
 * first thing anybody sees and a tile with no line under it reads as the Role
 * nobody bothered with. And the hook has to be the WIZARD's voice, not the
 * book's — `roles.json` carries the printed third-person tagline, which is on
 * the page below the fold where it belongs, and copying it up here would undo
 * the whole point of the screen.
 */
import { describe, expect, it } from "vitest";
import rolesData from "@/data/rules/roles.json";
import { ROLE_HOOK, ROLE_PLAYS_LIKE } from "../copy";

type Role = { name: string; tagline: string };
const ROLES = (rolesData as unknown as { roles: Record<string, Role> }).roles;
const ROLE_IDS = Object.keys(ROLES);

describe("ROLE_HOOK", () => {
  it("covers every Role, and invents none", () => {
    expect([...Object.keys(ROLE_HOOK)].sort()).toEqual([...ROLE_IDS].sort());
  });

  it("stays short enough to sit on a tile", () => {
    for (const [id, hook] of Object.entries(ROLE_HOOK)) {
      expect(hook.trim().length, id).toBeGreaterThan(10);
      expect(hook.length, `${id}: "${hook}"`).toBeLessThanOrEqual(48);
    }
  });

  it("is not the book's tagline in disguise", () => {
    for (const id of ROLE_IDS) {
      expect(ROLE_HOOK[id], id).not.toBe(ROLES[id]!.tagline);
    }
  });

  it("never names the Role in the third person", () => {
    // "Rockerboys are street poets" is the encyclopedia voice this screen was
    // written to get away from.
    for (const id of ROLE_IDS) {
      expect(ROLE_HOOK[id]!.toLowerCase(), id).not.toContain(`${ROLES[id]!.name.toLowerCase()}s`);
    }
  });

  it("gives each Role its own line", () => {
    expect(new Set(Object.values(ROLE_HOOK)).size).toBe(ROLE_IDS.length);
  });
});

describe("ROLE_PLAYS_LIKE", () => {
  it("still covers every Role", () => {
    expect([...Object.keys(ROLE_PLAYS_LIKE)].sort()).toEqual([...ROLE_IDS].sort());
  });
});
