import { describe, expect, it } from "vitest";
import { checkOutlook } from "../checkDV";

describe("checkOutlook", () => {
  it("cannot fail when the worst Critical Failure still meets the DV", () => {
    const o = checkOutlook(18, 8);
    expect(o.worstCase).toBe(9);
    expect(o.cannotFail).toBe(true);
  });

  it("stays fallible when the worst case lands under the DV", () => {
    const o = checkOutlook(18, 13);
    expect(o.cannotFail).toBe(false);
    expect(o.critFailSafeUpTo).toBe(6); // 18 + 1 - 13
  });

  it("reports the plain face needed for a normal check", () => {
    expect(checkOutlook(10, 15).needed).toBe(5);
  });

  it("flags checks only a Critical Success can reach", () => {
    const o = checkOutlook(6, 21);
    expect(o.critSuccessNeeded).toBe(5);
    expect(o.cannotSucceed).toBe(false);
  });

  it("flags impossible checks", () => {
    expect(checkOutlook(3, 29).cannotSucceed).toBe(true);
  });
});
