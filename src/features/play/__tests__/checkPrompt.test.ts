import { describe, expect, it } from "vitest";
import type { CampaignEvent, FullCharacter } from "@/lib/backend";
import {
  pendingCheckFrom,
  pendingChecksFrom,
  rollHistory,
  snapToPublishedDv,
  dvBandName,
} from "../checkPrompt";

const event = (over: Partial<CampaignEvent>): CampaignEvent =>
  ({
    id: "e1",
    seq: 1,
    campaign_id: "c1",
    type: "gm_narration",
    beat_id: "b1",
    summary: "",
    roll: null,
    data: {},
    created_at: new Date().toISOString(),
    ...over,
  }) as CampaignEvent;

const character = {
  character: { name: "Red", role: "Solo" },
  stats: { int: 6 },
  skills: [{ skill_id: "perception", level: 4 }],
} as unknown as FullCharacter;

describe("checkPrompt", () => {
  it("snaps an off-table DV to the nearest published band", () => {
    expect(snapToPublishedDv(14)).toBe(13);
    expect(snapToPublishedDv(16)).toBe(15);
    expect(dvBandName(15)).toBe("Difficult");
  });

  it("finds an unresolved check prompt", () => {
    const events = [
      event({ id: "a", type: "gm_narration" }),
      event({
        id: "b",
        type: "check_prompt",
        data: { skillId: "perception", dv: 15, intent: "spot the tail" } as never,
      }),
    ];
    const pending = pendingCheckFrom(events, character);
    expect(pending?.skillName).toBe("Perception");
    expect(pending?.base).toBe(10);
    expect(pending?.dv).toBe(15);
    expect(pending?.needed).toBe(5);
  });

  it("treats a prompt followed by a roll as resolved", () => {
    const events = [
      event({
        id: "b",
        type: "check_prompt",
        data: { skillId: "perception", dv: 15 } as never,
      }),
      event({ id: "c", type: "skill_check" }),
    ];
    expect(pendingCheckFrom(events, character)).toBeNull();
  });
});

describe("pendingChecksFrom — more than one check on the table", () => {
  const twoSkilled = {
    character: { name: "Red", role: "Solo" },
    stats: { int: 6, tech: 5 },
    skills: [
      { skill_id: "perception", level: 4 },
      { skill_id: "pick_lock", level: 3 },
    ],
  } as unknown as FullCharacter;

  const prompt = (id: string, skillId: string) =>
    event({ id, type: "check_prompt", data: { skillId, dv: 15 } as never });

  it("keeps both prompts from one turn outstanding, oldest first", () => {
    const events = [prompt("p1", "pick_lock"), prompt("p2", "perception")];
    const pending = pendingChecksFrom(events, twoSkilled);
    expect(pending.map((p) => p.skillId)).toEqual(["pick_lock", "perception"]);
    expect(pendingCheckFrom(events, twoSkilled)?.skillId).toBe("pick_lock");
  });

  it("strikes off only the prompt the roll names, leaving the other live", () => {
    const events = [
      prompt("p1", "pick_lock"),
      prompt("p2", "perception"),
      event({ id: "r1", type: "skill_check", data: { prompt_event_id: "p1" } as never }),
    ];
    const pending = pendingChecksFrom(events, twoSkilled);
    expect(pending.map((p) => p.skillId)).toEqual(["perception"]);
  });

  it("clears the table once both prompts are answered", () => {
    const events = [
      prompt("p1", "pick_lock"),
      prompt("p2", "perception"),
      event({ id: "r1", type: "skill_check", data: { prompt_event_id: "p1" } as never }),
      event({ id: "r2", type: "skill_check", data: { prompt_event_id: "p2" } as never }),
    ];
    expect(pendingChecksFrom(events, twoSkilled)).toEqual([]);
  });

  it("resolves the roll out of order the prompts were posted in", () => {
    const events = [
      prompt("p1", "pick_lock"),
      prompt("p2", "perception"),
      event({ id: "r1", type: "skill_check", data: { prompt_event_id: "p2" } as never }),
    ];
    expect(pendingChecksFrom(events, twoSkilled).map((p) => p.skillId)).toEqual(["pick_lock"]);
  });

  it("falls back to matching an unlinked legacy roll by skill", () => {
    const events = [
      prompt("p1", "pick_lock"),
      prompt("p2", "perception"),
      event({ id: "r1", type: "skill_check", data: { skill_id: "pick_lock" } as never }),
    ];
    expect(pendingChecksFrom(events, twoSkilled).map((p) => p.skillId)).toEqual(["perception"]);
  });
});

const talker = {
  character: { name: "Red", role: "Solo" },
  stats: { cool: 6, int: 6 },
  skills: [{ skill_id: "persuasion", level: 4 }],
} as unknown as FullCharacter;

const opposedPrompt = (over: Record<string, unknown> = {}) =>
  event({
    id: "op",
    type: "check_prompt",
    data: {
      skillId: "persuasion",
      intent: "talk the fixer round",
      opposition: {
        npcKey: "trace-santiago",
        npcName: "Trace Santiago",
        skillId: "human_perception",
        skillLevel: 3,
        statValue: 5,
        ...over,
      },
    } as never,
  });

describe("opposed check prompts", () => {
  it("describes both sides and sets no DV", () => {
    const pending = pendingCheckFrom([opposedPrompt()], talker);
    expect(pending).not.toBeNull();
    expect(pending?.dv).toBeNull();
    expect(pending?.needed).toBeNull();
    expect(pending?.bandName).toBeNull();
    expect(pending?.base).toBe(10); // COOL 6 + Persuasion 4
    expect(pending?.opposition).toMatchObject({
      npcKey: "trace-santiago",
      npcName: "Trace Santiago",
      skillName: "Human Perception",
      stat: "emp", // the printed STAT for that skill, not one the prompt chose
      statValue: 5,
      skillLevel: 3,
      base: 8,
      remembered: false,
    });
  });

  it("marks numbers the campaign already knew", () => {
    const pending = pendingCheckFrom([opposedPrompt({ remembered: true })], talker);
    expect(pending?.opposition?.remembered).toBe(true);
  });

  it("drops an opposed prompt whose opposing skill is not a printed one", () => {
    const pending = pendingCheckFrom([opposedPrompt({ skillId: "mind_reading" })], talker);
    expect(pending).toBeNull();
  });

  it("drops an opposed prompt with no opposing numbers", () => {
    const bad = event({
      id: "op",
      type: "check_prompt",
      data: {
        skillId: "persuasion",
        opposition: { npcName: "Trace Santiago", skillId: "human_perception" },
      } as never,
    });
    expect(pendingCheckFrom([bad], talker)).toBeNull();
  });

  it("still requires a DV when there is no opposition", () => {
    const bad = event({ id: "x", type: "check_prompt", data: { skillId: "persuasion" } as never });
    expect(pendingCheckFrom([bad], talker)).toBeNull();
  });

  it("queues opposed and DV prompts together, oldest first", () => {
    const events = [
      opposedPrompt(),
      event({
        id: "dv",
        type: "check_prompt",
        data: { skillId: "perception", dv: 15, intent: "watch the door" } as never,
      }),
    ];
    const queue = pendingChecksFrom(events, talker);
    expect(queue.map((c) => c.skillId)).toEqual(["persuasion", "perception"]);
  });
});

describe("rollHistory", () => {
  it("reads an opposed roll as the player's total against the total they faced", () => {
    const rolls = rollHistory([
      event({
        id: "r1",
        type: "skill_check",
        data: { skill_name: "Persuasion" } as never,
        roll: {
          actor: { total: 17, critical: null },
          opponent: { total: 12, critical: null },
          opponentSide: { name: "Trace Santiago" },
          success: true,
          tie: false,
          margin: 5,
        } as never,
      }),
    ]);
    expect(rolls[0]).toMatchObject({
      skillName: "Persuasion",
      total: 17,
      dv: 12,
      success: true,
      opposedBy: "Trace Santiago",
    });
  });

  it("still reads a plain DV roll", () => {
    const rolls = rollHistory([
      event({
        id: "r2",
        type: "skill_check",
        data: { skill_name: "Perception" } as never,
        roll: { total: 18, dv: 15, success: true, critical: null } as never,
      }),
    ]);
    expect(rolls[0]).toMatchObject({ total: 18, dv: 15, success: true, opposedBy: null });
  });

  it("shows attacks, which it used to leave out entirely", () => {
    const rolls = rollHistory([
      event({
        id: "a1",
        type: "attack",
        data: {
          weapon: "Heavy Pistol",
          target: "Scav",
          damage: 16,
          sp_before: 7,
          sp_after: 6,
          hp_before: 30,
          hp_after: 21,
          critical_injury: false,
          target_wound_state: "serious",
        } as never,
        roll: {
          total: 22,
          dv: 15,
          success: true,
          critical: null,
          formula: "1d10(8) + REF(8) + Handgun(6) = 22 vs DV15 → SUCCESS by 7",
        } as never,
      }),
    ]);
    expect(rolls[0]).toMatchObject({
      skillName: "Heavy Pistol → Scav",
      total: 22,
      dv: 15,
      success: true,
    });
  });

  it("carries the working and what the hit cost, for the row to open onto", () => {
    const rolls = rollHistory([
      event({
        id: "a2",
        type: "attack",
        data: {
          weapon: "Heavy Pistol",
          target: "Scav",
          damage: 16,
          sp_before: 7,
          sp_after: 6,
          hp_before: 30,
          hp_after: 21,
          critical_injury: true,
        } as never,
        roll: { total: 22, dv: 15, success: true, formula: "the working" } as never,
      }),
    ]);
    // The engine's own formula, never rebuilt here, and the cost in the shape
    // PRODUCT asks for.
    expect(rolls[0]?.detail).toEqual([
      "the working",
      "16 damage · SP 7 → 6 · 9 HP lost",
      "Critical Injury — +5 straight to HP",
    ]);
  });

  it("says nothing about armor that did not ablate", () => {
    const rolls = rollHistory([
      event({
        id: "a3",
        type: "attack",
        data: {
          weapon: "Bat",
          target: "Scav",
          damage: 4,
          sp_before: 7,
          sp_after: 7,
          hp_before: 30,
          hp_after: 26,
        } as never,
        roll: { total: 14, dv: 13, success: true, formula: "w" } as never,
      }),
    ]);
    expect(rolls[0]?.detail).toEqual(["w", "4 damage · 4 HP lost"]);
  });

  it("has nothing to open when the roll carried no working", () => {
    const rolls = rollHistory([
      event({
        id: "r3",
        type: "skill_check",
        data: { skill_name: "Perception" } as never,
        roll: { total: 12, dv: 15, success: false } as never,
      }),
    ]);
    expect(rolls[0]?.detail).toEqual([]);
  });
});

describe("wound penalties on checks", () => {
  const prompt = event({
    id: "w",
    type: "check_prompt",
    data: { skillId: "perception", dv: 15, intent: "spot the tail" } as never,
  });

  it("leaves an unwounded check exactly as it was", () => {
    const pending = pendingCheckFrom([prompt], character, "none");
    expect(pending).toMatchObject({ woundPenalty: 0, base: 10, needed: 5 });
  });

  it("does not penalise a Lightly Wounded character", () => {
    // Lightly Wounded is any damage at all; the penalty starts at Serious.
    expect(pendingCheckFrom([prompt], character, "light")?.woundPenalty).toBe(0);
  });

  it("costs a Seriously Wounded character 2, raising the number they need", () => {
    const pending = pendingCheckFrom([prompt], character, "serious");
    expect(pending?.woundPenalty).toBe(-2);
    expect(pending?.base).toBe(10); // STAT + Skill is untouched
    expect(pending?.needed).toBe(7); // the die has to cover it instead
  });

  it("costs a Mortally Wounded character 4", () => {
    const pending = pendingCheckFrom([prompt], character, "mortal");
    expect(pending?.woundPenalty).toBe(-4);
    expect(pending?.needed).toBe(9);
  });

  it("rides on an opposed check too, where there is no DV to raise", () => {
    const pending = pendingCheckFrom([opposedPrompt()], talker, "serious");
    expect(pending?.woundPenalty).toBe(-2);
    expect(pending?.needed).toBeNull();
    expect(pending?.dv).toBeNull();
  });
});
