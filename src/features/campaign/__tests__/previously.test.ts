/**
 * "Previously" is only worth showing while it is news. These hold the rules
 * that stop it being a stale card: the newest job only, never a quiet job's
 * older sibling, gone once the player acts or puts it away — and, in Aftermath,
 * never the PREVIOUS job's frame while this one's settlement is still in flight.
 */
import { describe, expect, it } from "vitest";
import type { ClosingFrame } from "@/engine";
import type { CampaignEvent } from "@/lib/backend";
import { clippingsFor, frameOfCurrentJob, latestClosingFrame, previouslyFor } from "../previously";

let seq = 0;
const ev = (type: string, data: unknown = {}, at?: number): CampaignEvent =>
  ({
    id: `id${at ?? (seq += 1)}`,
    seq: at ?? seq,
    type,
    data,
    created_at: "2026-10-04T00:00:00Z",
    summary: null,
    roll: null,
    beat_id: null,
  }) as unknown as CampaignEvent;

const FRAME: ClosingFrame = {
  title: "A Night at the Opera",
  peak: { kind: "close_call", headline: "Gunman's Shotgun left you at 2 Hit Points.", trace: null },
  thread: { kind: "survivor", text: "Gunman walked away from it, and is still out there." },
};
const settled = (at: number, frame: ClosingFrame | null = FRAME) =>
  ev("job_settled", { findings: [], ...(frame ? { frame } : {}) }, at);

describe("latestClosingFrame", () => {
  it("is the newest job's frame", () => {
    const older = { ...FRAME, title: "Older" };
    const latest = latestClosingFrame([settled(10, older), settled(30), settled(20, older)]);
    expect(latest?.frame.title).toBe("A Night at the Opera");
    expect(latest?.settledSeq).toBe(30);
  });

  it("is nothing when the newest job closed quietly, however loud the one before", () => {
    expect(latestClosingFrame([settled(10), settled(20, null)])).toBeNull();
  });

  it("is nothing for a campaign that has settled no job, or only receipts from before frames", () => {
    expect(latestClosingFrame([])).toBeNull();
    expect(latestClosingFrame([ev("milestone", {}, 5)])).toBeNull();
    expect(latestClosingFrame([ev("job_settled", { findings: [] }, 5)])).toBeNull();
  });
});

describe("previouslyFor", () => {
  const latest = latestClosingFrame([settled(30)]);

  it("shows the frame while nothing has happened since the job closed", () => {
    expect(
      previouslyFor({
        latest,
        events: [ev("mission_completed", {}, 29), ev("milestone", {}, 31)],
        dismissedId: null,
      }),
    ).toEqual(FRAME);
  });

  it("goes the moment the player does anything in Life", () => {
    expect(
      previouslyFor({ latest, events: [ev("player_input", {}, 40)], dismissedId: null }),
    ).toBeNull();
  });

  it("is not put out by what the player did BEFORE the job closed", () => {
    expect(
      previouslyFor({ latest, events: [ev("player_input", {}, 12)], dismissedId: null }),
    ).toEqual(FRAME);
  });

  it("stays put away once dismissed, for that job only", () => {
    expect(previouslyFor({ latest, events: [], dismissedId: "id30" })).toBeNull();
    expect(previouslyFor({ latest, events: [], dismissedId: "id10" })).toEqual(FRAME);
  });

  it("is nothing when there is no frame", () => {
    expect(previouslyFor({ latest: null, events: [], dismissedId: null })).toBeNull();
  });
});

describe("frameOfCurrentJob", () => {
  it("is this job's frame once it has settled", () => {
    expect(
      frameOfCurrentJob({
        events: [ev("mission_started", {}, 20), ev("job_settled", {}, 30)],
        settled: [settled(30)],
      }),
    ).toEqual(FRAME);
  });

  it("is not the PREVIOUS job's frame while this one is still settling", () => {
    expect(
      frameOfCurrentJob({
        events: [ev("mission_started", {}, 50), ev("mission_completed", {}, 60)],
        settled: [settled(30)],
      }),
    ).toBeNull();
  });

  it("will not guess when the window no longer reaches the job's start", () => {
    // The old receipt is nowhere in the window: it cannot be this job's.
    expect(
      frameOfCurrentJob({ events: [ev("player_input", {}, 90)], settled: [settled(30)] }),
    ).toBeNull();
    // This one is in the window: it can.
    expect(
      frameOfCurrentJob({
        events: [ev("player_input", {}, 28), ev("job_settled", {}, 30)],
        settled: [settled(30)],
      }),
    ).toEqual(FRAME);
  });
});

describe("clippingsFor", () => {
  const receipt = (at: number, noticed: Record<string, number>) =>
    ev(
      "job_settled",
      {
        findings: Object.entries(noticed).map(([observation, count]) => ({
          observation,
          count,
          because: "x",
        })),
        payment: { agreed: 500, paid: 500 },
        day: 6,
        placeKey: "a1",
      },
      at,
    );

  it("is the headline this job earned, and the fame it brought, from its own receipt", () => {
    const loud = receipt(30, { loud: 1, seen: 1 });
    const cuttings = clippingsFor({
      events: [ev("mission_started", {}, 20), loud],
      settled: [loud],
      handle: "Velvet",
    });
    expect(cuttings.map((c) => c.kind)).toEqual(["job", "fame"]);
    expect(cuttings.every((c) => c.seq === 30)).toBe(true);
    expect(cuttings[0]?.day).toBe(6);
  });

  it("is nothing for a job nobody could place the character at", () => {
    const clean = receipt(30, { clean: 1 });
    expect(
      clippingsFor({
        events: [ev("mission_started", {}, 20), clean],
        settled: [clean],
        handle: "V",
      }),
    ).toEqual([]);
  });

  it("is not the PREVIOUS job's cutting while this one is still settling", () => {
    const old = receipt(30, { killed: 2 });
    expect(
      clippingsFor({
        events: [ev("mission_started", {}, 50), ev("mission_completed", {}, 60)],
        settled: [old],
        handle: "V",
      }),
    ).toEqual([]);
  });

  it("only ever carries the newest job, however many came before", () => {
    const first = receipt(10, { killed: 2, seen: 1, loud: 1 });
    const second = receipt(30, { favour: 1 });
    const cuttings = clippingsFor({
      events: [ev("mission_started", {}, 20), second],
      settled: [first, second],
      handle: "V",
    });
    expect(cuttings.every((c) => c.seq === 30)).toBe(true);
    expect(cuttings[0]?.tone).toBe("good");
  });
});
