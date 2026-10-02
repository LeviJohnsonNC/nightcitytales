/**
 * The climb, told: what a settled job did for the character's name, and the
 * Life log's lines for each step up. Reputation and the tier of work move at
 * settlement, where no Life turn can see them change, so these are read off
 * the ledger rather than diffed between turns.
 */
import { describe, expect, it } from "vitest";
import { JOB_TIERS, LEDGER_EVENTS, milestoneEventData, REPUTATION } from "@/engine";
import type { CampaignEvent } from "@/lib/backend";
import { climbLogLine, climbNews, milestoneWritten } from "../climbNews";

let seq = 0;
/** A `job_settled` receipt as settlement writes it: findings and a payment. */
const settled = (noticed: Record<string, number>, agreed = 500): CampaignEvent =>
  ({
    id: `s${++seq}`,
    type: "job_settled",
    data: {
      findings: Object.entries(noticed).map(([observation, count]) => ({ observation, count })),
      payment: { agreed },
    },
  }) as unknown as CampaignEvent;

describe("what the job did for your name", () => {
  it("says a clean job left the name where it was, and writes no milestone", () => {
    const news = climbNews({ events: [settled({ clean: 1 })], jobsFinished: 1, npcs: [] })!;
    expect(news.lines.map((l) => l.text)).toEqual([expect.stringMatching(/^A clean job/)]);
    expect(news.milestone).toBeNull();
  });

  it("calls a rise a rise, with who knows now", () => {
    const news = climbNews({
      events: [settled({ seen: 1, loud: 1 })],
      jobsFinished: 1,
      npcs: [],
    })!;
    const who = REPUTATION.levels.find((l) => l.level === 3)!.whoKnows;
    expect(news.lines[0]).toEqual({ text: `Reputation 0 → 3. ${who}`, tone: "good" });
    expect(news.milestone).toBe(`Reputation 0 → 3. ${who}`);
  });

  it("says when a deed was not the loudest, without a milestone", () => {
    const news = climbNews({
      events: [settled({ seen: 1, loud: 1 }), settled({})],
      jobsFinished: 2,
      npcs: [],
    })!;
    expect(news.lines[0]!.text).toMatch(/done louder\. Reputation stays 3/);
    expect(news.milestone).toBeNull();
  });

  it("announces a new tier of work", () => {
    const steady = JOB_TIERS[1]!;
    const events = [
      ...Array.from({ length: steady.minJobsFinished - 1 }, () => settled({})),
      settled({ seen: 1, named: 1 }, 3000),
    ];
    const news = climbNews({ events, jobsFinished: steady.minJobsFinished, npcs: [] })!;
    expect(news.milestone).toContain(`Fixers offer you ${steady.name.toLowerCase()} now`);
  });

  it("is written once per settled job", () => {
    const events = [settled({ loud: 1 })];
    const news = climbNews({ events, jobsFinished: 1, npcs: [] })!;
    expect(milestoneWritten(events, news.settledEventId)).toBe(false);
    const written = {
      id: "m1",
      type: LEDGER_EVENTS.milestone,
      data: milestoneEventData({ settledEventId: news.settledEventId }),
    } as unknown as CampaignEvent;
    expect(milestoneWritten([...events, written], news.settledEventId)).toBe(true);
  });
});

describe("the Life log's lines for the climb", () => {
  const who = { roleId: "solo", homeDistrictKey: null };

  it("names a Skill raise from its payload, not the SQL's spelling", () => {
    expect(
      climbLogLine(
        {
          type: "skill_raised",
          data: {
            skill_id: "handgun",
            specialization: null,
            from_level: 4,
            to_level: 5,
            cost: 100,
          },
        },
        who,
      ),
    ).toBe("Handgun 4 → 5.");
    expect(
      climbLogLine(
        {
          type: "skill_raised",
          data: {
            skill_id: "first_aid",
            specialization: null,
            from_level: 0,
            to_level: 1,
            cost: 20,
          },
        },
        who,
      ),
    ).toBe("Learned First Aid: Level 1.");
  });

  it("names the Role Ability for a Rank, and says what an award was for", () => {
    expect(
      climbLogLine(
        {
          type: "role_rank_raised",
          data: { ability_id: "combat_awareness", from_rank: 4, to_rank: 5, cost: 300 },
        },
        who,
      ),
    ).toBe("Combat Awareness Rank 4 → 5.");
    expect(
      climbLogLine(
        {
          type: "ip_awarded",
          data: { award: { ip: 30, source: "group", descriptor: "x" }, kind: "job", day: 4 },
        },
        who,
      ),
    ).toBe("30 Improvement Points earned on the job.");
  });

  it("leaves anything it cannot read to the summary", () => {
    expect(climbLogLine({ type: "skill_raised", data: null }, who)).toBeNull();
    expect(climbLogLine({ type: "purchase", data: {} }, who)).toBeNull();
  });
});
