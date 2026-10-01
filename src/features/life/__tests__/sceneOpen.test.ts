import { describe, expect, it } from "vitest";
import { sceneOpen } from "../sceneOpen";

describe("sceneOpen", () => {
  it("leaves it to the game until the player chooses", () => {
    expect(sceneOpen({ opening: true, arrived: false, override: null })).toBe(true);
    expect(sceneOpen({ opening: false, arrived: true, override: null })).toBe(true);
    expect(sceneOpen({ opening: false, arrived: false, override: null })).toBe(false);
  });

  it("lets a click open the strip, or put away a picture the game opened", () => {
    expect(sceneOpen({ opening: false, arrived: false, override: true })).toBe(true);
    expect(sceneOpen({ opening: true, arrived: false, override: false })).toBe(false);
    expect(sceneOpen({ opening: false, arrived: true, override: false })).toBe(false);
  });
});
