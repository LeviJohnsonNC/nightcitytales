import { describe, expect, it } from "vitest";
import { defaultCampaignName } from "../newCampaign";

describe("defaultCampaignName", () => {
  it("prefers the handle when present", () => {
    expect(defaultCampaignName({ name: "Vincent Kang", handle: "Switchblade" })).toBe(
      "Switchblade in Night City",
    );
  });

  it("falls back to the legal name when the handle is missing or blank", () => {
    expect(defaultCampaignName({ name: "Vincent Kang", handle: null })).toBe(
      "Vincent Kang in Night City",
    );
    expect(defaultCampaignName({ name: "Vincent Kang", handle: "   " })).toBe(
      "Vincent Kang in Night City",
    );
  });
});
