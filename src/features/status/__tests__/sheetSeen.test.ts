import { describe, expect, it } from "vitest";
import { firstVisitBaseline } from "../sheetSeen";

describe("the first visit to a Sheet that already has headlines", () => {
  it("adopts them as read, up to the newest", () => {
    expect(firstVisitBaseline([{ seq: 4 }, { seq: 19 }, { seq: 7 }], null)).toBe(19);
  });

  it("leaves a reader who has been here, and an empty sheet, alone", () => {
    expect(firstVisitBaseline([{ seq: 4 }], 2)).toBeNull();
    expect(firstVisitBaseline([{ seq: 4 }], 0)).toBeNull();
    expect(firstVisitBaseline([], null)).toBeNull();
  });
});
