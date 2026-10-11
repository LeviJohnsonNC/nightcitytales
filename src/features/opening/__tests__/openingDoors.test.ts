/**
 * The cold open's remaining contract, beside openingOps.test.ts.
 *
 * That file holds the four doors apart. This one holds the ordering and the
 * edges: the flag is the last write for EVERY door, a door re-taken writes the
 * same keys (so a retry cannot double-seed), only take_work touches the phase,
 * and the bundle refuses to load half a campaign.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Campaign, CampaignVitals, FullCharacter } from "@/lib/backend";
import type { CastMember, OpeningChoice } from "@/engine";

type Situation = {
  situationKey: string;
  category: string;
  dueDay?: number;
  data?: Record<string, unknown>;
};

const calls: string[] = [];
const upsertSituations = vi.fn(async (_id: string, _rows: Situation[]) => {
  calls.push("situations");
  return {};
});
const setCampaignFlag = vi.fn(async (_id: string, _flag: string, _value: unknown) => {
  calls.push("flag");
  return {};
});
const setCampaignPhase = vi.fn(async (_id: string, _phase: string) => {
  calls.push("phase");
  return {};
});
const appendCampaignEvent = vi.fn(async (_row: Record<string, unknown>) => {
  calls.push("event");
  return {};
});
const getCampaign = vi.fn();
const getCharacter = vi.fn();
const listCampaignFlags = vi.fn(async () => []);
const listCampaignNpcs = vi.fn(async () => []);
const ensureCast = vi.fn(async () => ({ npcs: [] }));
const openingFn = vi.fn(async (_input: { data: { userPrompt: string } }) => ({ prose: "x" }));

vi.mock("@/lib/backend", () => ({
  upsertSituations: (id: string, rows: Situation[]) => upsertSituations(id, rows),
  setCampaignFlag: (id: string, flag: string, value: unknown) => setCampaignFlag(id, flag, value),
  setCampaignPhase: (id: string, phase: string) => setCampaignPhase(id, phase),
  appendCampaignEvent: (row: Record<string, unknown>) => appendCampaignEvent(row),
  getCampaign: (id: string) => getCampaign(id),
  getCharacter: (id: string) => getCharacter(id),
  listCampaignFlags: () => listCampaignFlags(),
  listCampaignNpcs: () => listCampaignNpcs(),
}));
vi.mock("@/features/campaign/castSeeding", () => ({
  castFrom: () => [],
  ensureCast: () => ensureCast(),
}));
vi.mock("../openingContext", () => ({
  buildOpeningFacts: () => ({ facts: true }),
  renderOpeningPrompt: () => "THE PROMPT",
}));
vi.mock("../opening.server", () => ({
  openingFn: (input: { data: { userPrompt: string } }) => openingFn(input),
}));

const {
  OPENING_FLAG,
  chooseOpening,
  generateOpening,
  loadOpeningBundle,
  needsOpening,
  openingJobId,
} = await import("../openingOps");
const { NIGHT_AT_THE_OPERA } = await import("@/engine");

const DOORS: OpeningChoice[] = ["take_work", "see_someone", "just_living", "role_action"];

const campaign = (over: Partial<Campaign> = {}): Campaign =>
  ({
    id: "c1",
    day: 5,
    phase: "life",
    current_mission_id: null,
    character_id: "ch",
    ...over,
  }) as Campaign;

const bundle = (over: Partial<Campaign> = {}, cast: CastMember[] = []) => ({
  campaign: campaign(over),
  vitals: {} as CampaignVitals,
  character: { character: { role: "solo" } } as unknown as FullCharacter,
  cast,
});

beforeEach(() => {
  calls.length = 0;
  for (const fn of [upsertSituations, setCampaignFlag, setCampaignPhase, appendCampaignEvent])
    fn.mockClear();
});

describe("needsOpening", () => {
  it("reads a campaign with no phase recorded as Life", () => {
    // Rows written before phases existed have none; phaseOf reads them as Life.
    expect(needsOpening(campaign({ phase: undefined } as unknown as Partial<Campaign>), [])).toBe(
      true,
    );
  });

  it("ignores flags that are not the opening's", () => {
    expect(needsOpening(campaign(), [{ flag: "something_else" }])).toBe(true);
  });

  it("is false in the Hook phase, which is where take_work leaves a campaign", () => {
    expect(needsOpening(campaign({ phase: "hook" } as Partial<Campaign>), [])).toBe(false);
  });
});

describe("chooseOpening", () => {
  it.each(DOORS)("%s writes the opening flag last, naming the door", async (door) => {
    await chooseOpening(bundle(), door);
    expect(calls.at(-1)).toBe("flag");
    expect(calls.filter((c) => c === "flag")).toHaveLength(1);
    expect(setCampaignFlag).toHaveBeenCalledWith("c1", OPENING_FLAG, door);
  });

  it("only take_work moves the phase, and only to Hook", async () => {
    for (const door of DOORS) {
      setCampaignPhase.mockClear();
      await chooseOpening(bundle(), door);
      if (door === "take_work") expect(setCampaignPhase.mock.calls).toEqual([["c1", "hook"]]);
      else expect(setCampaignPhase, door).not.toHaveBeenCalled();
    }
  });

  it("take_work offers the authored opener and records the offer before the phase moves", async () => {
    await chooseOpening(bundle(), "take_work");
    expect(calls).toEqual(["situations", "event", "phase", "flag"]);
    const event = appendCampaignEvent.mock.calls[0]![0];
    expect(event).toMatchObject({ campaign_id: "c1", type: "hook_offered" });
    expect((event["data"] as { missionId: string }).missionId).toBe(NIGHT_AT_THE_OPERA.id);
    expect(openingJobId()).toBe(NIGHT_AT_THE_OPERA.id);
  });

  it("take_work does not force an illegal phase move outside Life", async () => {
    // nextPhase refuses offer_hook from a Job; the door must not write one anyway.
    await chooseOpening(bundle({ phase: "job" } as Partial<Campaign>), "take_work");
    expect(setCampaignPhase).not.toHaveBeenCalled();
    expect(calls.at(-1)).toBe("flag");
  });

  it("a failed phase write leaves no flag, so the opening can be taken again", async () => {
    setCampaignPhase.mockRejectedValueOnce(new Error("phase write failed"));
    await expect(chooseOpening(bundle(), "take_work")).rejects.toThrow("phase write failed");
    expect(setCampaignFlag).not.toHaveBeenCalled();
  });

  it("writes the same situation keys when a door is taken twice", async () => {
    for (const door of DOORS) {
      upsertSituations.mockClear();
      await chooseOpening(bundle(), door);
      await chooseOpening(bundle(), door);
      const [first, second] = upsertSituations.mock.calls.map((c) =>
        c[1].map((r) => r.situationKey),
      );
      expect(second, door).toEqual(first);
    }
  });

  it("gives the three Life doors distinct, door-named keys", async () => {
    const keys: string[] = [];
    for (const door of ["see_someone", "just_living", "role_action"] as const) {
      upsertSituations.mockClear();
      await chooseOpening(bundle(), door);
      keys.push(upsertSituations.mock.calls[0]![1][0]!.situationKey);
    }
    expect(keys).toEqual(["opening_see_someone", "opening_just_living", "opening_role_action"]);
  });

  it("dates see_someone and role_action to today, and leaves just_living undated as a premise", async () => {
    const rowFor = async (door: OpeningChoice) => {
      upsertSituations.mockClear();
      await chooseOpening(bundle({ day: 9 }), door);
      return upsertSituations.mock.calls[0]![1][0]!;
    };
    expect((await rowFor("see_someone")).dueDay).toBe(9);
    expect((await rowFor("role_action")).dueDay).toBe(9);
    const living = await rowFor("just_living");
    expect(living.dueDay).toBeUndefined();
    expect(living.data).toEqual({ premise: true });
  });

  it("treats a campaign with no day as day zero", async () => {
    await chooseOpening(bundle({ day: null } as unknown as Partial<Campaign>), "see_someone");
    expect(upsertSituations.mock.calls[0]![1][0]!.dueDay).toBe(0);
  });
});

describe("loadOpeningBundle", () => {
  it("refuses a campaign that does not exist", async () => {
    getCampaign.mockResolvedValueOnce(null);
    await expect(loadOpeningBundle("c1")).rejects.toThrow("Campaign not found.");
  });

  it("refuses a campaign with no vitals row", async () => {
    getCampaign.mockResolvedValueOnce({ campaign: campaign(), vitals: null });
    await expect(loadOpeningBundle("c1")).rejects.toThrow("no vitals row");
  });

  it("refuses a campaign with no character", async () => {
    getCampaign.mockResolvedValueOnce({ campaign: campaign(), vitals: {} });
    getCharacter.mockResolvedValueOnce(null);
    await expect(loadOpeningBundle("c1")).rejects.toThrow("no character");
  });

  it("seeds the cast before handing the bundle back", async () => {
    ensureCast.mockClear();
    getCampaign.mockResolvedValueOnce({ campaign: campaign(), vitals: { hp: 1 } });
    getCharacter.mockResolvedValueOnce({ character: { role: "solo" } });
    const out = await loadOpeningBundle("c1");
    expect(ensureCast).toHaveBeenCalledTimes(1);
    expect(out.campaign.id).toBe("c1");
    expect(out.cast).toEqual([]);
  });
});

describe("generateOpening", () => {
  it("sends only the rendered user prompt to the server function", async () => {
    openingFn.mockClear();
    await generateOpening(bundle());
    expect(openingFn).toHaveBeenCalledWith({ data: { userPrompt: "THE PROMPT" } });
  });
});
