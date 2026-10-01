import { describe, expect, it } from "vitest";
import {
  DEMO_BEATS,
  DEMO_PERIOD_MS,
  DEMO_START,
  GAP_MS,
  HOLD_MS,
  TYPE_CPS,
  demoFrame,
  stillFrame,
} from "../heroDemo";

const typeMs = (text: string) => Math.round((text.length / TYPE_CPS) * 1000);

describe("demoFrame", () => {
  it("opens on an empty page and types the first line out", () => {
    const first = DEMO_BEATS[0]!.text;
    expect(demoFrame(0).text).toBe("");
    const mid = demoFrame(typeMs(first) / 2);
    expect(mid.typing).toBe(true);
    expect(mid.text.length).toBeGreaterThan(0);
    expect(mid.text.length).toBeLessThan(first.length);
    expect(first.startsWith(mid.text)).toBe(true);
  });

  it("holds a finished line, then clears it for the gap before the next", () => {
    const first = DEMO_BEATS[0]!.text;
    const done = typeMs(first);
    expect(demoFrame(done + 100)).toMatchObject({ text: first, typing: false });
    expect(demoFrame(done + HOLD_MS + GAP_MS - 50).text).toBe("");
  });

  it("moves the numbers when the line that causes it has finished typing", () => {
    let at = 0;
    const checkpoints: { hp: number; humanity: number }[] = [];
    for (const beat of DEMO_BEATS) {
      const done = at + typeMs(beat.text);
      checkpoints.push(demoFrame(done + 50));
      at = done + HOLD_MS + GAP_MS;
    }
    expect(checkpoints[0]).toMatchObject({ hp: DEMO_START.hp, humanity: DEMO_START.humanity });
    // The ripperdoc costs Humanity; the stairwell costs HP; neither is given back.
    expect(checkpoints[1]!.humanity).toBeLessThan(DEMO_START.humanity);
    expect(checkpoints[2]!.hp).toBeLessThan(DEMO_START.hp);
    expect(checkpoints[3]!.hp).toBe(checkpoints[2]!.hp);
  });

  it("never lets HP or Humanity rise within a run, and starts over on the loop", () => {
    let hp = Infinity;
    let humanity = Infinity;
    for (let ms = 0; ms < DEMO_PERIOD_MS; ms += 50) {
      const f = demoFrame(ms);
      expect(f.hp).toBeLessThanOrEqual(hp);
      expect(f.humanity).toBeLessThanOrEqual(humanity);
      hp = f.hp;
      humanity = f.humanity;
    }
    expect(demoFrame(DEMO_PERIOD_MS + 10)).toMatchObject({
      hp: DEMO_START.hp,
      humanity: DEMO_START.humanity,
      text: "",
    });
  });
});

describe("stillFrame", () => {
  it("is the first line whole, at full health, for anyone who asked for less motion", () => {
    expect(stillFrame()).toEqual({
      text: DEMO_BEATS[0]!.text,
      typing: false,
      hp: DEMO_START.hp,
      humanity: DEMO_START.humanity,
    });
  });
});
