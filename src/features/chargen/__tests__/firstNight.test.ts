/**
 * "On your first night" is the Role told as a scene. It has to cover every
 * Role, and it must not slip back into the rulebook: the numbers live in the
 * engine's `roleOpening`, shown under "Read the printed rule".
 */
import { describe, expect, it } from "vitest";
import rolesData from "@/data/rules/roles.json";
import { ROLE_FIRST_NIGHT } from "../copy";

const ROLE_IDS = Object.keys(rolesData.roles);
/** Words a player who has not read the book should not meet here. */
const GAME_TERMS = /\b(Rank|d10|d6|STATs?|Skill|Round|Specialty|DV|BODY|WILL|Check|eb)\b/;

describe("the first night, as a scene", () => {
  it("has beats for every Role", () => {
    for (const id of ROLE_IDS) expect(ROLE_FIRST_NIGHT[id]?.length, id).toBeGreaterThan(0);
  });

  it("speaks no game terms", () => {
    for (const [id, beats] of Object.entries(ROLE_FIRST_NIGHT)) {
      for (const beat of beats) {
        expect(`${beat.title} ${beat.body}`, id).not.toMatch(GAME_TERMS);
      }
    }
  });
});
