/**
 * The closing frame picks one moment and one open thread out of a finished job.
 * The rows here are written by the SAME functions play uses (`attackEvent`,
 * `deathSaveEvent`, `skillCheckEvent`), so a renamed field on either side fails
 * here instead of closing every job on a blank.
 */
import { describe, expect, it } from "vitest";
import {
  BIG_HIT_DAMAGE,
  CLOSE_CALL_HP,
  HARD_CHECK_DV,
  closingFrame,
  openThread,
  peakMoment,
  readClosingFrameEventData,
  type FrameEvent,
  type ThreadInput,
} from "@/engine";
import { attackEvent, deathSaveEvent } from "../combatLog";
import { opposedCheckEvent, skillCheckEvent } from "../skillCheckLog";

const ME = "Vincent Kang";

/** A ledger row as the frame reads it, from whatever a writer produced. */
const row = (insert: { type: string; summary?: string | null; data?: unknown; roll?: unknown }) =>
  ({
    type: insert.type,
    summary: insert.summary ?? null,
    data: insert.data ?? {},
    roll: insert.roll ?? null,
  }) as FrameEvent;

const started = () => row({ type: "mission_started" });

const hitOn = (target: string, hpAfter: number, attacker = "Gunman", weapon = "Heavy Pistol") =>
  row(
    attackEvent(
      "c1",
      {
        attack: { hit: true, margin: 2, formula: `to-hit vs ${target}` } as never,
        damage: { total: 9 } as never,
        applied: {
          damageThroughArmor: 5,
          bonusDamage: 0,
          hpAfter,
          totalHpLoss: 5,
          spBefore: 7,
          spAfter: 6,
          ablated: true,
          criticalInjury: false,
        } as never,
      },
      { attackerName: attacker, targetName: target, weapon },
    ),
  );

const shot = (damage: number, target = "Gunman", weapon = "Assault Rifle") =>
  row(
    attackEvent(
      "c1",
      {
        attack: { hit: true, margin: 2, formula: "my shot" } as never,
        damage: { total: damage } as never,
        applied: {
          damageThroughArmor: damage,
          bonusDamage: 0,
          hpAfter: 3,
          totalHpLoss: damage,
          spBefore: 4,
          spAfter: 3,
          ablated: true,
          criticalInjury: false,
        } as never,
      },
      { attackerName: ME, targetName: target, weapon },
    ),
  );

const save = (died: boolean) =>
  row(
    deathSaveEvent(
      "c1",
      { roll: 3, penalty: 0, effective: 3, autoFail: false, survived: !died, penaltyAfter: 1 },
      { combatantName: ME, died },
    ),
  );

const check = (
  over: {
    dv?: number;
    success?: boolean;
    margin?: number;
    critical?: "success" | "failure" | null;
    luck?: number;
    skill?: string;
  } = {},
) =>
  row(
    skillCheckEvent(
      "c1",
      {
        success: over.success ?? true,
        margin: over.margin ?? 2,
        critical: over.critical ?? null,
        dv: over.dv ?? 13,
        formula: `1d10 + Stealth = ${over.dv ?? 13} vs DV ${over.dv ?? 13}`,
      } as never,
      {
        skillId: over.skill ?? "stealth",
        skillName: over.skill ?? "Stealth",
        ...(over.luck ? { luckSpent: over.luck } : {}),
      },
    ),
  );

const peak = (events: FrameEvent[]) =>
  peakMoment({ events: [started(), ...events], playerName: ME });

describe("the peak of a job", () => {
  it("is a Death Save survived, before anything else", () => {
    const p = peak([shot(30), check({ critical: "success" }), hitOn(ME, 1), save(false)]);
    expect(p?.kind).toBe("death_save");
    expect(p?.trace).toContain("Death Save");
  });

  it("is a close call next, naming who did it with what", () => {
    const p = peak([check({ critical: "success" }), hitOn(ME, 2, "Tyger Claw Gunman", "Shotgun")]);
    expect(p).toMatchObject({ kind: "close_call" });
    expect(p?.headline).toBe(
      "Tyger Claw Gunman's Shotgun left you at 2 Hit Points. You still got out.",
    );
    expect(p?.trace).toBe(`to-hit vs ${ME}`);
  });

  it("takes the LOWEST of several close calls", () => {
    const p = peak([hitOn(ME, 4, "A"), hitOn(ME, 1, "B"), hitOn(ME, 3, "C")]);
    expect(p?.headline).toContain("B's");
    expect(p?.headline).toContain("1 Hit Point.");
  });

  it("does not call a scratch a close call, or somebody else's wound one", () => {
    expect(peak([hitOn(ME, CLOSE_CALL_HP + 1)])).toBeNull();
    expect(peak([hitOn("Bystander", 0)])).toBeNull();
  });

  it("is a natural 10 or 1 when nothing came closer, success or ruin", () => {
    expect(peak([check({ critical: "success", skill: "Persuasion" })])?.headline).toBe(
      "A natural 10 on Persuasion.",
    );
    expect(peak([check({ critical: "success", success: false })])?.headline).toContain(
      "still was not enough",
    );
    expect(peak([check({ critical: "failure", success: false })])?.headline).toBe(
      "A natural 1 on Stealth. It came apart.",
    );
  });

  it("is the hardest call the table set, and says what Luck was burned on it", () => {
    const p = peak([check({ dv: 13 }), check({ dv: 21, margin: 1, luck: 2, skill: "Lockpick" })]);
    expect(p?.kind).toBe("hardest_check");
    expect(p?.headline).toBe(
      "The hardest call of the job: Lockpick against DV 21 — you made it by 1. You burned 2 Luck on it.",
    );
    expect(peak([check({ dv: 17, success: false, margin: -3 })])?.headline).toContain(
      "you missed it by 3",
    );
  });

  it("ignores a call that was never hard", () => {
    expect(peak([check({ dv: HARD_CHECK_DV - 2 })])).toBeNull();
  });

  it("reads an opposed check by what it was against, not as a DV", () => {
    const opposed = row(
      opposedCheckEvent(
        "c1",
        {
          success: true,
          margin: 4,
          tie: false,
          actor: { critical: "success" },
          opponent: { critical: null, total: 12 },
          opponentSide: { name: "Trace", skillLabel: "Persuasion" },
          actorSide: { name: ME },
          formula: "x",
        } as never,
        { skillId: "persuasion", skillName: "Persuasion" },
      ),
    );
    // No DV in it, so it can only be a peak by its natural 10.
    expect(peak([opposed])?.kind).toBe("critical");
  });

  it("is the biggest hit landed, last, and only when it was big", () => {
    const p = peak([shot(BIG_HIT_DAMAGE - 1), shot(BIG_HIT_DAMAGE + 4, "Boss", "Sniper Rifle")]);
    expect(p).toMatchObject({ kind: "big_hit", headline: "Your Sniper Rifle did 16 to Boss." });
    expect(peak([shot(BIG_HIT_DAMAGE - 1)])).toBeNull();
  });

  it("is nothing on a quiet job", () => {
    expect(peak([])).toBeNull();
  });

  it("only looks at this job", () => {
    // A close call in an earlier job is not this job's peak.
    const events = [started(), hitOn(ME, 0), save(false), started(), check({ dv: 13 })];
    expect(peakMoment({ events, playerName: ME })).toBeNull();
  });
});

describe("the open thread", () => {
  const none: ThreadInput = { survivors: [], clocks: [], people: [], brokerKey: null };

  it("is somebody who walked away, before anything else", () => {
    const t = openThread({
      ...none,
      survivors: ["Kiro's Courier"],
      clocks: [{ label: "Heat", before: 1, filled: 5, segments: 6, hidden: false }],
    });
    expect(t).toEqual({
      kind: "survivor",
      text: "Kiro's Courier walked away from it, and is still out there.",
    });
    expect(openThread({ ...none, survivors: ["A", "B", "C"] })?.text).toBe(
      "A and 2 others walked away from it, and are still out there.",
    );
    expect(openThread({ ...none, survivors: ["A", "B"] })?.text).toContain("A and 1 other walked");
  });

  it("is the hottest clock the job pushed, never a hidden one or one that did not move", () => {
    const t = openThread({
      ...none,
      clocks: [
        { label: "Secret", before: 0, filled: 6, segments: 6, hidden: true },
        { label: "Still", before: 4, filled: 4, segments: 6, hidden: false },
        { label: "Militech Investigation", before: 2, filled: 5, segments: 6, hidden: false },
        { label: "Low", before: 0, filled: 1, segments: 6, hidden: false },
      ],
    });
    expect(t).toEqual({
      kind: "clock",
      text: "Militech Investigation is at 5 of 6, and rising.",
    });
    expect(
      openThread({
        ...none,
        clocks: [{ label: "Low", before: 0, filled: 1, segments: 6, hidden: false }],
      }),
    ).toBeNull();
  });

  it("is a broker who came away colder, and only a broker", () => {
    const people = [
      { key: "kiro", name: "Kiro", before: 2, after: 1 },
      { key: "other", name: "Other", before: 2, after: -1 },
    ];
    expect(openThread({ ...none, people, brokerKey: "kiro" })).toEqual({
      kind: "cold",
      text: "Kiro did not like how that went.",
    });
    expect(
      openThread({
        ...none,
        people: [{ key: "kiro", name: "Kiro", before: 1, after: 2 }],
        brokerKey: "kiro",
      }),
    ).toBeNull();
    expect(openThread({ ...none, people, brokerKey: null })).toBeNull();
  });

  it("is nothing when the world is holding nothing", () => {
    expect(openThread(none)).toBeNull();
  });
});

describe("the frame as a whole", () => {
  const events = [started(), check({ dv: 21, luck: 1 })];
  const thread: ThreadInput = { survivors: ["Gunman"], clocks: [], people: [], brokerKey: null };

  it("keeps nothing from a job with nothing to keep", () => {
    expect(
      closingFrame({
        title: "A Quiet One",
        events: [started()],
        playerName: ME,
        thread: { survivors: [], clocks: [], people: [], brokerKey: null },
      }),
    ).toBeNull();
  });

  it("survives being stored in a receipt and read back", () => {
    const frame = closingFrame({ title: "Night at the Opera", events, playerName: ME, thread });
    expect(frame).toMatchObject({
      title: "Night at the Opera",
      peak: { kind: "hardest_check" },
      thread: { kind: "survivor" },
    });
    // The receipt is stored whole as jsonb: through JSON and back.
    const receipt = JSON.parse(JSON.stringify({ findings: [], frame }));
    expect(readClosingFrameEventData(receipt)).toEqual(frame);
  });

  it("is a thread alone, or a peak alone, when that is all there is", () => {
    const onlyThread = closingFrame({ title: null, events: [started()], playerName: ME, thread });
    expect(onlyThread?.peak).toBeNull();
    expect(readClosingFrameEventData({ frame: onlyThread })?.thread?.kind).toBe("survivor");
  });

  it("reads an old receipt, or a damaged one, as no frame at all", () => {
    expect(readClosingFrameEventData({ findings: [] })).toBeNull();
    expect(readClosingFrameEventData({ frame: "nope" })).toBeNull();
    expect(readClosingFrameEventData(null)).toBeNull();
    expect(
      readClosingFrameEventData({
        frame: { peak: { kind: "made_up", headline: "x" }, thread: { kind: "survivor", text: "" } },
      }),
    ).toBeNull();
    // One half damaged leaves the other standing.
    expect(
      readClosingFrameEventData({
        frame: {
          peak: { kind: "made_up", headline: "x" },
          thread: { kind: "clock", text: "Heat is at 5 of 6." },
        },
      }),
    ).toMatchObject({ peak: null, thread: { kind: "clock" } });
  });
});
