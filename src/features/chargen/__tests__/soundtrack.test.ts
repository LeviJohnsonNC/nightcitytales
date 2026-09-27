import { describe, expect, it } from "vitest";
import { CHARGEN_STEPS } from "../steps";
import { CUE_FILES, cueForStep, cueLoops } from "../music/soundtrack";
import {
  currentCue,
  isMusicEnabled,
  setBaseCue,
  setCueOverride,
  setMusicEnabled,
} from "../music/musicDirector";

describe("the creator's soundtrack", () => {
  it("gives every step a cue, and follows the shape of the scene", () => {
    for (const step of CHARGEN_STEPS) expect(CUE_FILES[cueForStep(step.id)]).toBeTruthy();
    expect(cueForStep("fixer")).toBe("meet");
    expect(cueForStep("role")).toBe("interview");
    expect(cueForStep("lifepath")).toBe("interview");
    expect(cueForStep("skills")).toBe("build");
    expect(cueForStep("identity")).toBe("build");
    expect(cueForStep("review")).toBe("reveal");
  });

  it("loops everything but the reveal, which plays once into night one", () => {
    expect(cueLoops("interview")).toBe(true);
    expect(cueLoops("reveal")).toBe(false);
  });

  it("names every cue's file the way the art guide asks for it", () => {
    for (const file of Object.values(CUE_FILES)) expect(file).toMatch(/^music-[a-z]+\.mp3$/);
  });
});

describe("the director, outside a browser", () => {
  it("does nothing and throws nothing, and an override wins over the step", () => {
    expect(() => setBaseCue("interview")).not.toThrow();
    expect(currentCue()).toBe("interview");
    setCueOverride("people");
    expect(currentCue()).toBe("people");
    setCueOverride(null);
    expect(currentCue()).toBe("interview");
    setBaseCue(null);
    expect(currentCue()).toBeNull();
    setMusicEnabled(false);
    expect(isMusicEnabled()).toBe(false);
    setMusicEnabled(true);
  });
});
