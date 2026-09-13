import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Campaign, CampaignVitals, FullCharacter } from "@/lib/backend";
import type { CastMember } from "@/engine";

/**
 * What each door actually does.
 *
 * The model wrote the wording and chose none of this. The test that matters is
 * that the four DIVERGE: one puts a job on the table and moves the phase, and
 * the other three seed different situations and leave the campaign in Life.
 * Four doors onto the same corridor would be the "fake agency" PRODUCT.md names
 * outright, and it is the failure this design is most likely to rot into.
 */

type Situation = { situationKey: string; category: string; severity: number; npcKey?: string };

const upsertSituations = vi.fn<(id: string, rows: Situation[]) => Promise<unknown>>();
const setCampaignFlag = vi.fn<(id: string, flag: string, value: unknown) => Promise<unknown>>();
const setCampaignPhase = vi.fn<(id: string, phase: string) => Promise<unknown>>();
const appendCampaignEvent = vi.fn<(row: { type: string }) => Promise<unknown>>();

vi.mock("@/lib/backend", () => ({
  upsertSituations: (id: string, rows: Situation[]) => upsertSituations(id, rows),
  setCampaignFlag: (id: string, flag: string, value: unknown) => setCampaignFlag(id, flag, value),
  setCampaignPhase: (id: string, phase: string) => setCampaignPhase(id, phase),
  appendCampaignEvent: (row: { type: string }) => appendCampaignEvent(row),
  getCampaign: vi.fn(),
  getCharacter: vi.fn(),
  listCampaignFlags: vi.fn(),
  listCampaignNpcs: vi.fn(),
}));

vi.mock("@/features/campaign/castSeeding", () => ({
  castFrom: () => [],
  ensureCast: vi.fn(),
}));

vi.mock("../opening.server", () => ({ openingFn: vi.fn() }));

const { OPENING_FLAG, chooseOpening, needsOpening } = await import("../openingOps");

const campaign = (over: Partial<Campaign> = {}): Campaign =>
  ({ id: "c1", day: 3, phase: "life", current_mission_id: null, ...over }) as Campaign;

const person = (over: Partial<CastMember> = {}): CastMember =>
  ({
    key: "kiro",
    name: "Kiro",
    role: "fixer",
    standing: "Owes you a straight answer.",
    tie: null,
    disposition: 4,
    dossier: { wants: "w", fear: "f", secret: "s", breakingPoint: "b" },
  }) as CastMember;

const bundle = (cast: CastMember[] = []) => ({
  campaign: campaign(),
  vitals: {} as CampaignVitals,
  character: {} as FullCharacter,
  cast,
});

beforeEach(() => {
  for (const fn of [upsertSituations, setCampaignFlag, setCampaignPhase, appendCampaignEvent]) {
    fn.mockClear().mockResolvedValue({});
  }
});

describe("needsOpening", () => {
  it("is true for a fresh campaign with no mission and no flag", () => {
    expect(needsOpening(campaign(), [])).toBe(true);
  });

  it("is false once a door has been taken", () => {
    expect(needsOpening(campaign(), [{ flag: OPENING_FLAG }])).toBe(false);
  });

  it("is false for a campaign that predates the opening", () => {
    // Every campaign created before this feature was handed a mission at
    // creation, so a mission id is the discriminator that keeps old saves out
    // of a cold open they have already lived past.
    expect(needsOpening(campaign({ current_mission_id: "night-at-the-opera" }), [])).toBe(false);
  });

  it("is false anywhere but Life", () => {
    expect(needsOpening(campaign({ phase: "job" }), [])).toBe(false);
    expect(needsOpening(campaign({ phase: "aftermath" }), [])).toBe(false);
  });
});

describe("the four doors diverge", () => {
  it("take_work puts a real offer on the table and moves the phase", async () => {
    await chooseOpening(bundle(), "take_work");
    const [, rows] = upsertSituations.mock.calls[0] ?? [];
    expect(rows?.[0]?.category).toBe("hook");
    expect(appendCampaignEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "hook_offered" }),
    );
    // Life → hook. Accepting is still the player's, and still the only door
    // into a job.
    expect(setCampaignPhase).toHaveBeenCalledWith("c1", "hook");
  });

  it("the other three leave the campaign in Life", async () => {
    for (const choice of ["see_someone", "walk_the_block", "handle_business"] as const) {
      setCampaignPhase.mockClear();
      await chooseOpening(bundle(), choice);
      expect(setCampaignPhase, choice).not.toHaveBeenCalled();
    }
  });

  it("seeds a different kind of situation for each", async () => {
    const categories: string[] = [];
    for (const choice of ["see_someone", "walk_the_block", "handle_business"] as const) {
      upsertSituations.mockClear();
      await chooseOpening(bundle([person()]), choice);
      categories.push(upsertSituations.mock.calls[0]?.[1]?.[0]?.category ?? "");
    }
    expect(categories).toEqual(["people", "opportunity", "need"]);
    expect(new Set(categories).size).toBe(3);
  });

  it("points see_someone at the person the character is closest to", async () => {
    await chooseOpening(
      bundle([person({ key: "cold", disposition: -2 }), person()]),
      "see_someone",
    );
    expect(upsertSituations.mock.calls[0]?.[1]?.[0]?.npcKey).toBe("kiro");
  });

  it("still works when the cast could not be seeded", async () => {
    // A campaign with no people is not a campaign that cannot start.
    await chooseOpening(bundle([]), "see_someone");
    const row = upsertSituations.mock.calls[0]?.[1]?.[0];
    expect(row?.category).toBe("people");
    expect(row?.npcKey).toBeUndefined();
  });
});

describe("the flag that says the opening is done", () => {
  it("records which door was taken", async () => {
    await chooseOpening(bundle(), "walk_the_block");
    expect(setCampaignFlag).toHaveBeenCalledWith("c1", OPENING_FLAG, "walk_the_block");
  });

  it("is written last, so a failed consequence leaves the opening retryable", async () => {
    upsertSituations.mockRejectedValueOnce(new Error("the write failed"));
    await expect(chooseOpening(bundle(), "handle_business")).rejects.toThrow("the write failed");
    // No flag means needsOpening is still true, so the player gets the screen
    // back rather than a campaign that recorded a choice nothing acted on.
    expect(setCampaignFlag).not.toHaveBeenCalled();
  });
});
