import { beforeEach, describe, expect, it, vi } from "vitest";

type Home = { placeKey: string | null; districtKey: string | null; readable: boolean };
type StartOptions = { missionId?: string | null; homePlaceKey?: string | null };

const getActiveCampaignForCharacter = vi.fn<(id: string) => Promise<{ id: string } | null>>();
const getCharacterHome = vi.fn<(id: string) => Promise<Home>>();
const startCampaignForCharacter =
  vi.fn<(character: { id: string }, options: StartOptions) => Promise<string>>();

vi.mock("@/lib/backend", () => ({
  getActiveCampaignForCharacter: (id: string) => getActiveCampaignForCharacter(id),
  getCharacterHome: (id: string) => getCharacterHome(id),
}));
vi.mock("@/features/campaign/newCampaign", () => ({
  startCampaignForCharacter: (character: { id: string }, options: StartOptions) =>
    startCampaignForCharacter(character, options),
}));

const { startOrResumeAdventure } = await import("../startAdventure");

const CHARACTER = { id: "char-1", name: "Vincent Kang", handle: "Switchblade" };

/** The options the adventure passed on, including where it decided to open. */
function optionsPassed(): StartOptions {
  const call = startCampaignForCharacter.mock.calls[0];
  expect(call, "startCampaignForCharacter was never called").toBeDefined();
  return call![1];
}

beforeEach(() => {
  getActiveCampaignForCharacter.mockClear().mockResolvedValue(null);
  getCharacterHome.mockReset();
  startCampaignForCharacter.mockClear().mockResolvedValue("campaign-1");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("where a new adventure opens", () => {
  it("opens at the address the character chose", async () => {
    getCharacterHome.mockResolvedValue({ placeKey: "w2", districtKey: "x", readable: true });
    await startOrResumeAdventure(CHARACTER);
    expect(optionsPassed().homePlaceKey).toBe("w2");
  });

  it("opens at the default start, quietly, when a character genuinely has no home", async () => {
    // Saved before the housing step asked for an address. Nothing is wrong, so
    // nothing is said.
    getCharacterHome.mockResolvedValue({ placeKey: null, districtKey: null, readable: true });
    await startOrResumeAdventure(CHARACTER);
    expect(optionsPassed().homePlaceKey).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("complains loudly when the home could not be read at all", async () => {
    // The bug this file exists for. An unapplied migration made the home column
    // unreadable, the failure was swallowed, and a player who chose Pacifica
    // woke up in Little Europe with nothing logged anywhere. Falling back is
    // still right; falling back in silence is not.
    getCharacterHome.mockResolvedValue({ placeKey: null, districtKey: null, readable: false });
    await startOrResumeAdventure(CHARACTER);
    expect(optionsPassed().homePlaceKey).toBeNull();
    expect(console.error).toHaveBeenCalled();
    expect(String(vi.mocked(console.error).mock.calls[0]?.[0])).toContain("home_place_key");
  });

  it("complains loudly when the read throws, and still starts the campaign", async () => {
    getCharacterHome.mockRejectedValue(new Error("network"));
    await expect(startOrResumeAdventure(CHARACTER)).resolves.toBe("campaign-1");
    expect(optionsPassed().homePlaceKey).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it("does not move a character who is resuming a campaign they already have", async () => {
    // Somebody who has walked across the city stays where they walked to.
    getActiveCampaignForCharacter.mockResolvedValue({ id: "existing" });
    await expect(startOrResumeAdventure(CHARACTER)).resolves.toBe("existing");
    expect(getCharacterHome).not.toHaveBeenCalled();
    expect(startCampaignForCharacter).not.toHaveBeenCalled();
  });
});
