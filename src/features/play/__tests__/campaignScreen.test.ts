import { describe, expect, it } from "vitest";
import { campaignScreen } from "../campaignScreen";

describe("combat over the adventure", () => {
  it.each(["life", "hook", "job", "aftermath"])(
    "overlays %s and returns to that phase after combat",
    (phase) => {
      const state = { phase, status: "active", opening: false, combat: true };
      expect(campaignScreen(state)).toBe("play");
      expect(campaignScreen({ ...state, combat: false })).toBe(
        phase === "job" || phase === "aftermath" ? "play" : "life",
      );
      expect(state.phase).toBe(phase);
    },
  );
  it("never sends a dead character back into Life or a cold opening", () => {
    expect(campaignScreen({ phase: "life", status: "lost", opening: true, combat: false })).toBe(
      "play",
    );
  });
});
