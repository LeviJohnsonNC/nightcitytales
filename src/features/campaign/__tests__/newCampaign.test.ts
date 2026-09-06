import { beforeEach, describe, expect, it, vi } from "vitest";

type CampaignPatch = { location_key?: string; known_places?: string[] };
type PlaceUpsert = { placeKey: string; visits: number };

const startCampaign = vi.fn<(payload: { character_id: string }) => Promise<string>>();
const updateCampaign = vi.fn<(id: string, patch: CampaignPatch) => Promise<unknown>>();
const upsertCampaignPlace = vi.fn<(id: string, place: PlaceUpsert) => Promise<unknown>>();

vi.mock("@/lib/backend", () => ({
  startCampaign: (payload: { character_id: string }) => startCampaign(payload),
  updateCampaign: (id: string, patch: CampaignPatch) => updateCampaign(id, patch),
  upsertCampaignPlace: (id: string, place: PlaceUpsert) => upsertCampaignPlace(id, place),
}));

const { defaultCampaignName, startCampaignForCharacter } = await import("../newCampaign");

const CHARACTER = { id: "char-1", name: "Vincent Kang", handle: "Switchblade" };

beforeEach(() => {
  startCampaign.mockClear().mockResolvedValue("campaign-1");
  updateCampaign.mockClear().mockResolvedValue({});
  upsertCampaignPlace.mockClear().mockResolvedValue({});
});

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

/**
 * The seam that broke.
 *
 * `startingPositionFor` was tested thoroughly as a pure function and the wiring
 * around it was not tested at all, so a character who chose Pacifica could be
 * dropped at the atlas default with every engine test still green. These are
 * the tests that would have failed the day that shipped.
 */
describe("moving the character into their own home", () => {
  it("opens the campaign at the address the character chose", async () => {
    const id = await startCampaignForCharacter(CHARACTER, { homePlaceKey: "w2" });
    expect(id).toBe("campaign-1");
    expect(updateCampaign).toHaveBeenCalledWith(
      "campaign-1",
      expect.objectContaining({ location_key: "w2" }),
    );
  });

  it("lets the character know the building they live in", async () => {
    // placeIntel opens its rungs on visits and the top one costs six. Somebody
    // who lives somewhere knows it; they should not have to walk through their
    // own front door six times to be told so.
    await startCampaignForCharacter(CHARACTER, { homePlaceKey: "w2" });
    expect(upsertCampaignPlace).toHaveBeenCalledWith(
      "campaign-1",
      expect.objectContaining({ placeKey: "w2", visits: 6 }),
    );
  });

  it("puts the home on the map the character knows", async () => {
    await startCampaignForCharacter(CHARACTER, { homePlaceKey: "w2" });
    expect(updateCampaign).toHaveBeenCalledWith(
      "campaign-1",
      expect.objectContaining({ known_places: ["w2"] }),
    );
  });

  it("leaves the campaign at the default start when there is no home", async () => {
    // A character saved before the housing step asked for an address. Nothing
    // is written, and the campaign opens wherever it used to.
    await startCampaignForCharacter(CHARACTER, { homePlaceKey: null });
    expect(startCampaign).toHaveBeenCalled();
    expect(updateCampaign).not.toHaveBeenCalled();
    expect(upsertCampaignPlace).not.toHaveBeenCalled();
  });

  it("ignores an address the atlas has never heard of", async () => {
    // Rather than writing a location_key nothing downstream can resolve.
    await startCampaignForCharacter(CHARACTER, { homePlaceKey: "zz9" });
    expect(updateCampaign).not.toHaveBeenCalled();
  });

  it("still returns a playable campaign when moving in fails", async () => {
    // A campaign at the default start beats no campaign at all, which is why
    // this is caught — but the catch is only allowed to cost the LOCATION.
    updateCampaign.mockRejectedValueOnce(new Error("network"));
    await expect(startCampaignForCharacter(CHARACTER, { homePlaceKey: "w2" })).resolves.toBe(
      "campaign-1",
    );
  });

  it("does not start a second campaign just to place the first", async () => {
    await startCampaignForCharacter(CHARACTER, { homePlaceKey: "w2" });
    expect(startCampaign).toHaveBeenCalledTimes(1);
  });
});
