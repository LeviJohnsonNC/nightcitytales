import { describe, expect, it } from "vitest";
import { GM_SYSTEM_PROMPT } from "@/features/gm/gmSystemPrompt";
import { LIFE_SYSTEM_PROMPT } from "@/features/life/lifeSystemPrompt";
import { appearsAsProp, identityFrom } from "../castSeeding";

const saved = (identity: unknown) => ({ lifepath: { general: { identity } } }) as never;

describe("who the character is on sight, in the campaign", () => {
  it("reads sex and age off the saved Lifepath and hands the narrator one line", () => {
    expect(identityFrom(saved({ sex: "female", age: 22 }))).toEqual({ sex: "female", age: 22 });
    expect(appearsAsProp(saved({ sex: "male", age: 71 }))).toEqual({
      appearsAs: "man, 71, elderly",
    });
  });

  it("says nothing for a character saved before the file asked", () => {
    expect(appearsAsProp({ lifepath: null } as never)).toEqual({});
    expect(appearsAsProp(saved(undefined))).toEqual({});
  });

  it("gives both narrators the same rule, and keeps difficulty out of it", () => {
    for (const prompt of [GM_SYSTEM_PROMPT, LIFE_SYSTEM_PROMPT]) {
      expect(prompt).toContain("WHO THEY ARE ON SIGHT");
      expect(prompt).toContain("never changes a difficulty");
    }
  });
});
