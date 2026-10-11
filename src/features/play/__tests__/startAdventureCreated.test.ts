/**
 * startAdventure says WHICH it did, because only a new campaign opens on the
 * cold open's entrance. startAdventure.test.ts covers where it opens.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const getActiveCampaignForCharacter = vi.fn<(id: string) => Promise<{ id: string } | null>>();
const getCharacterHome =
  vi.fn<(id: string) => Promise<{ placeKey: string | null; readable: boolean }>>();
const startCampaignForCharacter =
  vi.fn<(character: { id: string }, options: Record<string, unknown>) => Promise<string>>();

vi.mock("@/lib/backend", () => ({
  getActiveCampaignForCharacter: (id: string) => getActiveCampaignForCharacter(id),
  getCharacterHome: (id: string) => getCharacterHome(id),
}));
vi.mock("@/features/campaign/newCampaign", () => ({
  startCampaignForCharacter: (character: { id: string }, options: Record<string, unknown>) =>
    startCampaignForCharacter(character, options),
}));

const { startAdventure, startOrResumeAdventure } = await import("../startAdventure");

const CHARACTER = { id: "char-1", name: "Vincent Kang", handle: "Switchblade" };

beforeEach(() => {
  getActiveCampaignForCharacter.mockReset().mockResolvedValue(null);
  getCharacterHome.mockReset().mockResolvedValue({ placeKey: "w2", readable: true });
  startCampaignForCharacter.mockReset().mockResolvedValue("new-campaign");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("startAdventure", () => {
  it("reports a resumed campaign as not created", async () => {
    getActiveCampaignForCharacter.mockResolvedValue({ id: "existing" });
    await expect(startAdventure(CHARACTER)).resolves.toEqual({ id: "existing", created: false });
    expect(startCampaignForCharacter).not.toHaveBeenCalled();
  });

  it("reports a new campaign as created", async () => {
    await expect(startAdventure(CHARACTER)).resolves.toEqual({ id: "new-campaign", created: true });
  });

  it("looks up the active campaign for this character", async () => {
    await startAdventure(CHARACTER);
    expect(getActiveCampaignForCharacter).toHaveBeenCalledWith("char-1");
    expect(getCharacterHome).toHaveBeenCalledWith("char-1");
  });

  it("creates a new campaign with no mission attached", async () => {
    // The campaign opens on its cold open in Life; a job is the character's choice.
    await startAdventure(CHARACTER);
    const options = startCampaignForCharacter.mock.calls[0]![1];
    expect(options).toEqual({ homePlaceKey: "w2" });
    expect(options).not.toHaveProperty("missionId");
  });

  it("startOrResumeAdventure returns the same id either way", async () => {
    await expect(startOrResumeAdventure(CHARACTER)).resolves.toBe("new-campaign");
    getActiveCampaignForCharacter.mockResolvedValue({ id: "existing" });
    await expect(startOrResumeAdventure(CHARACTER)).resolves.toBe("existing");
  });

  it("propagates a failure to create rather than inventing an id", async () => {
    startCampaignForCharacter.mockRejectedValue(new Error("start_campaign failed"));
    await expect(startAdventure(CHARACTER)).rejects.toThrow("start_campaign failed");
  });
});
