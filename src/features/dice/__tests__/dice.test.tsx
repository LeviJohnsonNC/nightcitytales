/**
 * The pieces around the die: batches fan out, the arithmetic shows the
 * engine's numbers and never its own, and nothing breaks outside a browser.
 */
import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { statSkillCheck } from "@/engine";
import { onSkip, resetStagger, skipAll, staggerDelay } from "../cascade";
import { playCrit, playSettle, playTumble } from "../fx";
import { HoloDie } from "../HoloDie";
import { RollMath } from "../RollMath";

afterEach(() => resetStagger());

describe("a batch of dice", () => {
  it("fans out when they ask together, and starts fresh after a pause", () => {
    expect(staggerDelay(1000)).toBe(0);
    expect(staggerDelay(1010)).toBe(70);
    expect(staggerDelay(1020)).toBe(140);
    // Long after the batch: a new one starts at zero.
    expect(staggerDelay(5000)).toBe(0);
  });

  it("never makes a die wait too long", () => {
    let last = 0;
    for (let i = 0; i < 40; i += 1) last = staggerDelay(1000 + i);
    expect(last).toBeLessThanOrEqual(900);
  });

  it("skips every rolling die at once, and a die that stopped listening is left alone", () => {
    let a = 0;
    let b = 0;
    const offA = onSkip(() => (a += 1));
    const offB = onSkip(() => (b += 1));
    offB();
    skipAll();
    expect([a, b]).toEqual([1, 0]);
    offA();
  });
});

describe("the arithmetic, landing", () => {
  it("shows the engine's die, modifiers and verdict, including a crit", () => {
    // A rigged die: a natural 10, then 4 on the critical die.
    const faces = [0.95, 0.35];
    const r = statSkillCheck(
      [
        { label: "REF", value: 6 },
        { label: "Handgun", value: 5 },
      ],
      () => faces.shift() ?? 0,
      { dv: 15 },
    );
    expect(r.critical).toBe("success");
    const html = renderToStaticMarkup(
      <RollMath
        rolls={r.rolls}
        modifiers={r.modifiers}
        total={r.total}
        target={{ kind: "dv", dv: 15 }}
        success={r.success}
        margin={r.total - 15}
      />,
    );
    expect(html).toContain("REF");
    expect(html).toContain("Handgun");
    expect(html).toContain("Crit");
    expect(html).toContain("vs DV 15");
    expect(html).toContain(`Success by ${r.total - 15}`);
  });

  it("says a tie goes to the other side, in the table's words", () => {
    const html = renderToStaticMarkup(
      <RollMath
        rolls={[5]}
        modifiers={[{ label: "COOL", value: 7 }]}
        total={12}
        target={{ kind: "vs", total: 12, name: "Rook" }}
        success={false}
        margin={null}
        tie
      />,
    );
    expect(html).toContain("vs Rook 12");
    expect(html).toContain("Tied · they hold");
  });

  it("uses the words it is given", () => {
    const html = renderToStaticMarkup(
      <RollMath
        rolls={[9]}
        modifiers={[]}
        total={20}
        target={{ kind: "dv", dv: 13 }}
        success
        margin={7}
        words={{ success: "Hit", failure: "Miss" }}
      />,
    );
    expect(html).toContain("Hit by 7");
  });
});

describe("outside a browser", () => {
  it("renders a die and plays no sound without throwing", () => {
    expect(() => renderToStaticMarkup(<HoloDie sides={10} value={7} />)).not.toThrow();
    expect(() => renderToStaticMarkup(<HoloDie sides={6} value={null} />)).not.toThrow();
    expect(() => {
      playTumble(0.5);
      playSettle(7, 10);
      playCrit();
    }).not.toThrow();
  });
});
