import { describe, expect, it } from "vitest";
import { placeCallout } from "../calloutPlacement";

const card = { width: 120, height: 60 };
const board = { width: 390, height: 380 };

describe("where the information card goes", () => {
  it("sits over the person when there is room", () => {
    expect(placeCallout({ left: 200, top: 200 }, { left: 200, top: 280 }, card, board)).toEqual({
      mode: "above",
      left: 200,
      top: 200,
    });
  });

  it("goes under the feet, never across the body, when there is no room above", () => {
    const p = placeCallout({ left: 200, top: 90 }, { left: 200, top: 170 }, card, board);
    expect(p.mode).toBe("below");
    expect(p.top).toBeGreaterThanOrEqual(170);
  });

  it("goes beside the person when there is room neither above nor below", () => {
    const p = placeCallout({ left: 100, top: 90 }, { left: 100, top: 340 }, card, board);
    expect(p.mode).toBe("beside");
    expect(Math.abs(p.left - 100)).toBeGreaterThanOrEqual(card.width / 2 + 22);
  });

  it("keeps off the board's controls and caption as measured, not a fixed band", () => {
    const caption = { left: 0, top: 50, right: 280, bottom: 90 };
    const p = placeCallout({ left: 130, top: 140 }, { left: 130, top: 220 }, card, board, [
      caption,
    ]);
    expect(p.mode).toBe("below");
    // and with the caption elsewhere, the same card sits above
    expect(
      placeCallout({ left: 330, top: 160 }, { left: 330, top: 240 }, card, board, [caption]).mode,
    ).toBe("above");
  });

  it("stays inside the board's sides", () => {
    const p = placeCallout({ left: 5, top: 200 }, { left: 5, top: 280 }, card, board);
    expect(p.left - card.width / 2).toBeGreaterThanOrEqual(8);
  });
});

describe("the card and the people around it", () => {
  it("prefers a clear place that covers nobody, and covers someone only when it must", () => {
    const you = { left: 180, top: 180, right: 220, bottom: 250 };
    // no room above: below would land on the player, so it goes beside instead
    const p = placeCallout({ left: 200, top: 60 }, { left: 200, top: 150 }, card, board, [], [you]);
    expect(p.mode).toBe("beside");
    // crowded all round: still placed, on the fewest people
    const crowd = [0, 1, 2, 3].map((i) => ({
      left: i * 100,
      top: 0,
      right: i * 100 + 99,
      bottom: 380,
    }));
    expect(
      placeCallout({ left: 200, top: 200 }, { left: 200, top: 280 }, card, board, [], crowd),
    ).toBeTruthy();
  });
});
