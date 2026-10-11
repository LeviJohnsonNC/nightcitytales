/**
 * The model may only PICK a printed I.P. tier. Whatever it sends back, every
 * number leaving normalizeIpJudgement is on the table, and a standout exists
 * only when it names a real playstyle.
 */
import { describe, expect, it } from "vitest";
import { IP_PLAYSTYLES, IP_TIER_VALUES, isIpTierValue } from "@/engine";
import {
  IP_JUDGEMENT_SYSTEM_PROMPT,
  normalizeIpJudgement,
  renderIpJudgementPrompt,
} from "../ipJudgement";

const LOWEST = Math.min(...IP_TIER_VALUES);
const HIGHEST = Math.max(...IP_TIER_VALUES);

describe("normalizeIpJudgement", () => {
  it("keeps printed values as they are", () => {
    const out = normalizeIpJudgement({ groupIp: 30, primaryIp: 40, secondaryIp: 20 });
    expect(out).toMatchObject({ groupIp: 30, primaryIp: 40, secondaryIp: 20 });
  });

  it("snaps an off-tier value down to the printed tier below it, never up", () => {
    const out = normalizeIpJudgement({ groupIp: 35, primaryIp: 49, secondaryIp: 21 });
    expect(out).toMatchObject({ groupIp: 30, primaryIp: 40, secondaryIp: 20 });
  });

  it("rounds before snapping, so a near-miss float lands on its tier", () => {
    expect(normalizeIpJudgement({ groupIp: 29.6 }).groupIp).toBe(30);
    expect(normalizeIpJudgement({ groupIp: 29.4 }).groupIp).toBe(20);
  });

  it("clamps values off either end of the table", () => {
    const out = normalizeIpJudgement({ groupIp: -5, primaryIp: 0, secondaryIp: 999 });
    expect(out).toMatchObject({ groupIp: LOWEST, primaryIp: LOWEST, secondaryIp: HIGHEST });
  });

  it("reads missing or non-finite values as the lowest tier", () => {
    const out = normalizeIpJudgement({
      groupIp: null,
      primaryIp: Number.NaN,
      secondaryIp: Infinity,
    });
    expect(out).toMatchObject({ groupIp: LOWEST, primaryIp: LOWEST, secondaryIp: LOWEST });
  });

  it("returns only printed values for any input", () => {
    for (let v = -20; v <= 120; v += 3) {
      const out = normalizeIpJudgement({
        groupIp: v,
        primaryIp: v,
        secondaryIp: v,
        standoutPlaystyle: "warrior",
        standoutIp: v,
      });
      for (const n of [out.groupIp, out.primaryIp, out.secondaryIp, out.standout?.ip ?? LOWEST])
        expect(isIpTierValue(n), String(v)).toBe(true);
    }
  });

  it("accepts a standout naming a real playstyle, in any case and padding", () => {
    const out = normalizeIpJudgement({
      standoutPlaystyle: "  Warrior ",
      standoutIp: 55,
      standoutReason: " Held the stairwell. ",
    });
    expect(out.standout).toEqual({ playstyle: "warrior", ip: 50, reason: "Held the stairwell." });
  });

  it("drops a standout naming a playstyle the table does not print", () => {
    expect(
      normalizeIpJudgement({ standoutPlaystyle: "netrunner", standoutIp: 60 }).standout,
    ).toBeNull();
    expect(normalizeIpJudgement({ standoutPlaystyle: "", standoutIp: 60 }).standout).toBeNull();
  });

  it("has no standout when none was sent", () => {
    expect(normalizeIpJudgement({}).standout).toBeNull();
    expect(normalizeIpJudgement({ standoutPlaystyle: null, standoutIp: null }).standout).toBeNull();
    // A playstyle without a value is not a standout either.
    expect(normalizeIpJudgement({ standoutPlaystyle: "explorer" }).standout).toBeNull();
  });

  it("supplies a reason when the model left one out", () => {
    const out = normalizeIpJudgement({
      standoutPlaystyle: "socializer",
      standoutIp: 40,
      reason: "  ",
    });
    expect(out.reason.length).toBeGreaterThan(0);
    expect(out.standout?.reason.length).toBeGreaterThan(0);
  });

  it("every printed playstyle id is accepted", () => {
    for (const p of IP_PLAYSTYLES)
      expect(
        normalizeIpJudgement({ standoutPlaystyle: p.id, standoutIp: 40 }).standout?.playstyle,
      ).toBe(p.id);
  });
});

describe("the judgement prompt", () => {
  it("lists every legal value in the system prompt", () => {
    for (const v of IP_TIER_VALUES) expect(IP_JUDGEMENT_SYSTEM_PROMPT).toContain(`${v} IP`);
  });

  it("renders the session's facts, and says when nothing was recorded", () => {
    const text = renderIpJudgementPrompt({
      missionTitle: "A Night at the Opera",
      missionFinished: false,
      outcome: "walked away",
      objectives: [],
      primary: "warrior",
      secondary: "explorer",
      log: ["LOG-ONE", "LOG-TWO"],
      rollCount: 4,
    });
    expect(text).toContain("MISSION FINISHED: no");
    expect(text).toContain("primary warrior, secondary explorer");
    expect(text).toContain("DICE ROLLED THIS SESSION: 4");
    expect(text).toContain("(none recorded)");
    expect(text.indexOf("LOG-ONE")).toBeLessThan(text.indexOf("LOG-TWO"));
  });
});
