import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CampaignFlag, Json } from "@/lib/backend";

/**
 * A campaign_flags table small enough to hold in one hand, plus a ledger. The
 * point of mocking rather than stubbing pure inputs is that the interesting
 * behaviour here IS the reading and writing: whether the wire re-rolls, whether
 * a secret roll stays out of the visible log.
 */
const flags = new Map<string, Json>();
const ledger: { type: string; summary: string; data: Record<string, unknown> }[] = [];

vi.mock("@/lib/backend", () => ({
  listCampaignFlags: vi.fn(async () =>
    [...flags.entries()].map(([flag, value]) => ({ flag, value }) as unknown as CampaignFlag),
  ),
  setCampaignFlag: vi.fn(async (_campaignId: string, flag: string, value: Json) => {
    flags.set(flag, value);
    return { flag, value } as unknown as CampaignFlag;
  }),
  appendCampaignEvent: vi.fn(async (row: Record<string, unknown>) => {
    ledger.push({
      type: row["type"] as string,
      summary: row["summary"] as string,
      data: (row["data"] ?? {}) as Record<string, unknown>,
    });
    return row;
  }),
}));

const {
  BROKE_BELOW,
  COMPLICATION_FLAG,
  PENDING_QUESTION_FLAG,
  STREET_ORACLE_FLAG,
  WIRE_ORACLE_FLAG,
  answerPendingQuestion,
  askOracle,
  complicationFrom,
  complicationIsReal,
  consultStreet,
  consultWire,
  pendingQuestionFrom,
  revealComplication,
  rollComplicationFor,
  spendWire,
  secretComplicationFor,
  wireIsOpenOn,
  wireMemoryFrom,
} = await import("../oracles");

function rows(): CampaignFlag[] {
  return [...flags.entries()].map(([flag, value]) => ({ flag, value }) as unknown as CampaignFlag);
}

/** An RNG pinned to one face of a die of the given size. */
function face(die: number, value: number): () => number {
  return () => (value - 0.5) / die;
}

const RICH = BROKE_BELOW + 5000;

beforeEach(() => {
  flags.clear();
  ledger.length = 0;
});

describe("reading the stored answers", () => {
  it("reads nothing out of an empty campaign", () => {
    expect(wireMemoryFrom([])).toBeNull();
    expect(complicationFrom([])).toBeNull();
    expect(pendingQuestionFrom([])).toBeNull();
  });

  it("refuses a stored value that is the wrong shape", () => {
    const bad = (value: unknown): CampaignFlag[] =>
      [{ flag: WIRE_ORACLE_FLAG, value }] as unknown as CampaignFlag[];
    for (const value of [
      "offer",
      6,
      null,
      [],
      { key: "offer" },
      { day: 3 },
      { day: "3", key: 1 },
    ]) {
      expect(wireMemoryFrom(bad(value))).toBeNull();
    }
  });

  it("only calls the wire open on the day it was actually rolled", async () => {
    await consultWire({ campaignId: "c", day: 4, eurobucks: RICH, rng: face(6, 6) });
    expect(wireIsOpenOn(rows(), 4)).toBe(true);
    expect(wireIsOpenOn(rows(), 5)).toBe(false);
  });
});

describe("consultWire", () => {
  it("offers work on a six and nothing on a one", async () => {
    const offered = await consultWire({
      campaignId: "c",
      day: 1,
      eurobucks: RICH,
      rng: face(6, 6),
    });
    expect(offered).toEqual({ offered: true, key: "offer", rolled: true });

    flags.clear();
    const quiet = await consultWire({ campaignId: "c", day: 1, eurobucks: RICH, rng: face(6, 1) });
    expect(quiet).toEqual({ offered: false, key: "nothing", rolled: true });
  });

  it("asks once a day, and reads the same answer back for the rest of it", async () => {
    const first = await consultWire({ campaignId: "c", day: 7, eurobucks: RICH, rng: face(6, 1) });
    expect(first.rolled).toBe(true);
    // A six on the second call: if it rolled again, this would come back an offer.
    const second = await consultWire({ campaignId: "c", day: 7, eurobucks: RICH, rng: face(6, 6) });
    expect(second).toEqual({ offered: false, key: "nothing", rolled: false });
  });

  it("asks again when the day turns over", async () => {
    await consultWire({ campaignId: "c", day: 7, eurobucks: RICH, rng: face(6, 1) });
    const tomorrow = await consultWire({
      campaignId: "c",
      day: 8,
      eurobucks: RICH,
      rng: face(6, 6),
    });
    expect(tomorrow).toEqual({ offered: true, key: "offer", rolled: true });
  });

  it("gives a second ask to a character who goes out looking", async () => {
    await consultWire({ campaignId: "c", day: 2, eurobucks: RICH, rng: face(6, 1) });
    const chased = await consultWire({
      campaignId: "c",
      day: 2,
      eurobucks: RICH,
      chasing: true,
      rng: face(6, 4),
    });
    // A four plus the asking-around bonus reads as a six.
    expect(chased).toEqual({ offered: true, key: "offer", rolled: true });
  });

  it("only gives that second ask once in a day", async () => {
    await consultWire({ campaignId: "c", day: 2, eurobucks: RICH, rng: face(6, 1) });
    await consultWire({ campaignId: "c", day: 2, eurobucks: RICH, chasing: true, rng: face(6, 1) });
    const again = await consultWire({
      campaignId: "c",
      day: 2,
      eurobucks: RICH,
      chasing: true,
      rng: face(6, 4),
    });
    expect(again.rolled).toBe(false);
    expect(again.offered).toBe(false);
  });

  it("stops offering once tonight's work has been put on the table", async () => {
    await consultWire({ campaignId: "c", day: 5, eurobucks: RICH, rng: face(6, 6) });
    await spendWire("c", 5);
    expect(wireIsOpenOn(rows(), 5)).toBe(false);
    // Even going out looking again finds nothing more tonight.
    const chased = await consultWire({
      campaignId: "c",
      day: 5,
      eurobucks: RICH,
      chasing: true,
      rng: face(6, 6),
    });
    expect(chased).toEqual({ offered: false, key: "spent", rolled: false });
  });

  it("never rolls an offer away again — the phone does not un-ring", async () => {
    await consultWire({ campaignId: "c", day: 3, eurobucks: RICH, rng: face(6, 6) });
    const chased = await consultWire({
      campaignId: "c",
      day: 3,
      eurobucks: RICH,
      chasing: true,
      rng: face(6, 1),
    });
    expect(chased).toEqual({ offered: true, key: "offer", rolled: false });
  });

  it("makes work easier to find when the character is broke", async () => {
    const broke = await consultWire({
      campaignId: "c",
      day: 1,
      eurobucks: BROKE_BELOW - 1,
      rng: face(6, 5),
    });
    expect(broke.offered).toBe(true);

    flags.clear();
    const solvent = await consultWire({
      campaignId: "c",
      day: 1,
      eurobucks: BROKE_BELOW,
      rng: face(6, 5),
    });
    expect(solvent.offered).toBe(false);
  });

  it("puts the roll in the visible log, with the face and the circumstance", async () => {
    await consultWire({
      campaignId: "c",
      day: 1,
      eurobucks: BROKE_BELOW - 1,
      chasing: true,
      rng: face(6, 1),
    });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]!.type).toBe("oracle_roll");
    expect(ledger[0]!.summary).toContain("1d6(1)");
    expect(ledger[0]!.summary).toContain("Broke(1)");
    expect(ledger[0]!.summary).toContain("Asked around(2)");
  });

  it("does not write a second ledger line for an answer it merely read back", async () => {
    await consultWire({ campaignId: "c", day: 1, eurobucks: RICH, rng: face(6, 1) });
    await consultWire({ campaignId: "c", day: 1, eurobucks: RICH, rng: face(6, 1) });
    expect(ledger).toHaveLength(1);
  });
});

describe("the complication", () => {
  it("rolls one on accept and keeps it out of the visible log", async () => {
    const memory = await rollComplicationFor("c", "job-1", face(6, 1));
    expect(memory.key).toBe("employer_lied");
    expect(memory.missionId).toBe("job-1");
    expect(memory.revealed).toBe(false);
    expect(ledger).toHaveLength(1);
    expect(ledger[0]!.type).toBe("oracle_secret");
    expect(ledger[0]!.data["secret"]).toBe(true);
  });

  it("shows the GM the secret only for the job it belongs to", async () => {
    await rollComplicationFor("c", "job-1", face(6, 2));
    expect(secretComplicationFor(rows(), "job-1")?.key).toBe("rival_crew");
    expect(secretComplicationFor(rows(), "job-2")).toBeNull();
    expect(secretComplicationFor(rows(), null)).toBeNull();
  });

  it("shows the GM nothing when the die said the brief was clean", async () => {
    const memory = await rollComplicationFor("c", "job-1", face(6, 6));
    expect(memory.key).toBe("none");
    expect(complicationIsReal(memory)).toBe(false);
    expect(secretComplicationFor(rows(), "job-1")).toBeNull();
  });

  it("puts it in the visible log once the job is over", async () => {
    await rollComplicationFor("c", "job-1", face(6, 3));
    ledger.length = 0;
    const revealed = await revealComplication("c", "job-1");
    expect(revealed?.key).toBe("target_moved");
    expect(ledger).toHaveLength(1);
    expect(ledger[0]!.type).toBe("oracle_roll");
    expect(ledger[0]!.summary).toContain("The target is not where the brief said");
  });

  it("reveals a clean brief too, because that is the evidence the die was real", async () => {
    await rollComplicationFor("c", "job-1", face(6, 6));
    ledger.length = 0;
    expect((await revealComplication("c", "job-1"))?.key).toBe("none");
    expect(ledger).toHaveLength(1);
  });

  it("reveals it once and then stops", async () => {
    await rollComplicationFor("c", "job-1", face(6, 3));
    await revealComplication("c", "job-1");
    ledger.length = 0;
    expect(await revealComplication("c", "job-1")).toBeNull();
    expect(ledger).toHaveLength(0);
  });

  it("stops the GM being shown one it has already been told", async () => {
    await rollComplicationFor("c", "job-1", face(6, 3));
    await revealComplication("c", "job-1");
    expect(secretComplicationFor(rows(), "job-1")).toBeNull();
  });

  it("does not reveal another job's complication", async () => {
    await rollComplicationFor("c", "job-1", face(6, 3));
    expect(await revealComplication("c", "job-2")).toBeNull();
    expect(complicationFrom(rows())?.revealed).toBe(false);
  });

  it("replaces the previous job's complication when the next one is taken", async () => {
    await rollComplicationFor("c", "job-1", face(6, 1));
    await rollComplicationFor("c", "job-2", face(6, 4));
    expect(flags.size).toBe(1);
    expect(complicationFrom(rows())).toMatchObject({ missionId: "job-2", key: "police" });
  });
});

describe("the street", () => {
  it("rolls the evening and shows the roll", async () => {
    const quiet = await consultStreet({
      campaignId: "c",
      day: 1,
      part: "evening",
      rng: face(6, 2),
    });
    expect(quiet?.result.key).toBe("quiet");
    expect(quiet?.rolled).toBe(true);
    expect(ledger[0]!.type).toBe("oracle_roll");
    expect(ledger[0]!.summary).toContain("The street tonight");
  });

  it("rolls once for a part of the day, not once per turn", async () => {
    await consultStreet({ campaignId: "c", day: 1, part: "evening", rng: face(6, 1) });
    // A six on the second call: if it rolled again, something would intrude.
    const again = await consultStreet({
      campaignId: "c",
      day: 1,
      part: "evening",
      rng: face(6, 6),
    });
    expect(again).toBeNull();
    expect(ledger).toHaveLength(1);
  });

  it("rolls again when the evening turns into the night", async () => {
    await consultStreet({ campaignId: "c", day: 1, part: "evening", rng: face(6, 1) });
    const night = await consultStreet({ campaignId: "c", day: 1, part: "night", rng: face(6, 6) });
    expect(night?.result.key).toBe("intrudes");
  });

  it("rolls again the next day", async () => {
    await consultStreet({ campaignId: "c", day: 1, part: "evening", rng: face(6, 1) });
    const tomorrow = await consultStreet({
      campaignId: "c",
      day: 2,
      part: "evening",
      rng: face(6, 6),
    });
    expect(tomorrow?.result.key).toBe("intrudes");
  });
});

describe("questions", () => {
  it("holds a real question for next turn", async () => {
    expect(await askOracle("c", "Is Kiro already at the bar?")).toBe(true);
    expect(pendingQuestionFrom(rows())).toBe("Is Kiro already at the bar?");
    // Asking is not answering: nothing was rolled and nothing was logged.
    expect(ledger).toHaveLength(0);
  });

  it("refuses a question the dice cannot answer", async () => {
    for (const bad of [null, "", "What is in the crate?", "Is it?"]) {
      expect(await askOracle("c", bad)).toBe(false);
    }
    expect(flags.has(PENDING_QUESTION_FLAG)).toBe(false);
  });

  it("answers it with a secret roll and clears it", async () => {
    await askOracle("c", "Is the side door already unlocked?");
    const answered = await answerPendingQuestion("c", face(10, 10));
    expect(answered).toEqual({
      question: "Is the side door already unlocked?",
      answer: "Yes, and more than that.",
      key: "yes_and",
    });
    expect(ledger[0]!.type).toBe("oracle_secret");
    expect(pendingQuestionFrom(rows())).toBeNull();
  });

  it("answers each question once", async () => {
    await askOracle("c", "Is the side door already unlocked?");
    await answerPendingQuestion("c", face(10, 10));
    expect(await answerPendingQuestion("c", face(10, 10))).toBeNull();
  });

  it("answers nothing when nothing was asked", async () => {
    expect(await answerPendingQuestion("c", face(10, 10))).toBeNull();
    expect(ledger).toHaveLength(0);
  });

  it("keeps only the most recent question", async () => {
    await askOracle("c", "Is the side door already unlocked?");
    await askOracle("c", "Is the guard's partner still awake?");
    expect(pendingQuestionFrom(rows())).toBe("Is the guard's partner still awake?");
    expect(flags.size).toBe(1);
  });

  it("survives a flag written as a bare string by an older build", () => {
    const legacy = [
      { flag: PENDING_QUESTION_FLAG, value: "Is the elevator still powered?" },
    ] as unknown as CampaignFlag[];
    expect(pendingQuestionFrom(legacy)).toBe("Is the elevator still powered?");
  });
});

describe("what the flags are called", () => {
  it("keeps the stored names stable, because live campaigns are holding them", () => {
    expect(WIRE_ORACLE_FLAG).toBe("oracle_wire");
    expect(COMPLICATION_FLAG).toBe("job_complication");
    expect(PENDING_QUESTION_FLAG).toBe("oracle_question");
    expect(STREET_ORACLE_FLAG).toBe("oracle_street");
  });
});
