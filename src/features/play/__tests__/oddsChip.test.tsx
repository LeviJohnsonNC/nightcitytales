/**
 * The odds chip's words, and the card that carries it. The numbers are the
 * engine's and are held to the dice in `checkPreview.test.ts`; this holds what a
 * player is told about them.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { checkPercent } from "@/engine";
import type { PendingCheck } from "../checkPrompt";
import { CheckCard } from "../CheckCard";
import { oddsBand, oddsReadout } from "../oddsChip";
import type { CheckPreview } from "../rollCheck";

const preview = (percent: number, base = 10): CheckPreview => ({
  base,
  against: 15,
  percent,
  modifiers: [],
});

describe("oddsBand", () => {
  it("puts a word to every chance and never leaves a gap", () => {
    for (let percent = 0; percent <= 100; percent += 1) {
      expect(oddsBand(percent).label).toBeTruthy();
    }
  });

  it("reads the edges plainly", () => {
    expect(oddsBand(0).label).toBe("No chance");
    expect(oddsBand(10).label).toBe("Long shot");
    expect(oddsBand(50).label).toBe("Even");
    expect(oddsBand(75).label).toBe("Favoured");
    expect(oddsBand(95).label).toBe("Near-certain");
    expect(oddsBand(100).label).toBe("Locked in");
  });

  it("colours a long shot as a warning and a safe bet as a comfort", () => {
    expect(oddsBand(10).tone).toBe("bad");
    expect(oddsBand(50).tone).toBe("mid");
    expect(oddsBand(80).tone).toBe("good");
  });

  it("never rises as the chance falls", () => {
    const rank = { out: 0, long: 1, against: 2, even: 3, favoured: 4, near: 5, locked: 6 } as const;
    let last = -1;
    for (let percent = 0; percent <= 100; percent += 1) {
      const now = rank[oddsBand(percent).band];
      expect(now).toBeGreaterThanOrEqual(last);
      last = now;
    }
  });
});

describe("oddsReadout", () => {
  const base = { versus: "to clear DV 15" };

  it("prices one more point of Luck when it would change anything", () => {
    const r = oddsReadout({
      ...base,
      now: preview(55),
      withOneMore: preview(65),
      withoutLuck: preview(55),
      luckSpent: 0,
    });
    expect(r.luckHint).toEqual({ percent: 65, gain: 10 });
    expect(r.luckGain).toBeNull();
  });

  it("says nothing about Luck when the point would be wasted, or the pool is spent", () => {
    const wasted = oddsReadout({
      ...base,
      now: preview(100),
      withOneMore: preview(100),
      withoutLuck: preview(100),
      luckSpent: 0,
    });
    expect(wasted.luckHint).toBeNull();
    const spent = oddsReadout({
      ...base,
      now: preview(55),
      withOneMore: null,
      withoutLuck: preview(55),
      luckSpent: 0,
    });
    expect(spent.luckHint).toBeNull();
  });

  it("says what the Luck already dedicated has bought", () => {
    const r = oddsReadout({
      ...base,
      now: preview(75),
      withOneMore: preview(85),
      withoutLuck: preview(55),
      luckSpent: 2,
    });
    expect(r.luckGain).toBe(20);
    expect(r.luckHint).toEqual({ percent: 85, gain: 10 });
  });
});

describe("the check card", () => {
  const pending = {
    eventId: "e1",
    skillId: "perception",
    skillName: "Perception",
    stat: "int",
    statValue: 6,
    skillLevel: 4,
    base: 10,
    woundPenalty: 0,
    dv: 15,
    bandName: "Professional",
    needed: 5,
    opposition: null,
    target: null,
    reads: null,
    intent: "",
    beatId: null,
  } as unknown as PendingCheck;

  const render = (luckRemaining: number) =>
    renderToStaticMarkup(
      <CheckCard
        pending={pending}
        roll={() => {
          throw new Error("not rolled");
        }}
        odds={(luck) => ({
          base: 10 + luck,
          against: 15,
          percent: checkPercent(10 + luck, 15),
          modifiers: luck > 0 ? [{ label: "Luck", value: luck }] : [],
        })}
        onSettled={() => {}}
        busy={false}
        luckRemaining={luckRemaining}
      />,
    );

  it("shows the chance before the die, in a word and a number", () => {
    const html = render(3);
    expect(html).toContain('data-testid="odds-chip"');
    expect(html).toContain(`${checkPercent(10, 15)}%`);
    expect(html).toContain("to clear DV 15");
  });

  it("prices a point of Luck on the card", () => {
    expect(render(3)).toContain("one more Luck →");
  });

  it("keeps the working-out one tap away rather than on the card", () => {
    const html = render(3);
    expect(html).toContain("<details");
    expect(html).toContain("How this is worked out");
  });

  it("offers no Luck hint when there is none to spend", () => {
    expect(render(0)).not.toContain("one more Luck");
  });
});
