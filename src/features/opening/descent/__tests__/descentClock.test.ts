import { afterEach, describe, expect, it } from "vitest";
import { armDescent, descentArmed, descentElapsed, disarmDescent } from "../descentClock";

afterEach(() => disarmDescent());

describe("when the descent began", () => {
  it("is measured from the press, whichever screen asks", () => {
    armDescent(1000);
    expect(descentArmed(1500)).toBe(true);
    expect(descentElapsed(3500)).toBe(2500);
    expect(descentElapsed(4000)).toBe(3000);
  });

  it("is not under way until somebody presses the button", () => {
    expect(descentArmed(5000)).toBe(false);
  });

  it("starts now for a screen that mounts with none under way, as on a reload", () => {
    expect(descentElapsed(7000)).toBe(0);
    expect(descentElapsed(7400)).toBe(400);
  });

  it("gives up on a descent from long ago", () => {
    armDescent(0);
    expect(descentArmed(121_000)).toBe(false);
    expect(descentElapsed(121_000)).toBe(0);
  });

  it("is cancelled for a campaign that has no opening to descend into", () => {
    armDescent(0);
    disarmDescent();
    expect(descentArmed(10)).toBe(false);
  });
});
