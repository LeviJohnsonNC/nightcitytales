/**
 * The odds chip on a check card must be made of the numbers the die is rolled
 * with. These roll for real and hold the preview to what actually happened:
 * if the card and the roll ever assemble a check differently — a Role bonus the
 * chip never saw, a wound penalty applied the wrong way round, as the card's
 * outlook text once did — this is where it shows.
 */
import { describe, expect, it } from "vitest";
import { FACEDOWN_CHECK_ID, checkPercent, getSkill, opposedPercent } from "@/engine";
import type { Campaign, CampaignVitals, FullCharacter } from "@/lib/backend";
import type { PendingCheck } from "../checkPrompt";
import { previewPendingCheck, rollPendingCheck, type RollCheckInput } from "../rollCheck";

const STATS = {
  int: 6,
  ref: 6,
  dex: 6,
  tech: 6,
  cool: 6,
  will: 6,
  luck: 6,
  move: 6,
  body: 6,
  emp: 6,
};

const character = (role: string, rank: number, skills: [string, number][] = []): FullCharacter =>
  ({
    character: { name: "Vincent Kang", role },
    stats: STATS,
    skills: skills.map(([skill_id, level]) => ({ skill_id, level, specialization: null })),
    roleAbility: { rank },
  }) as unknown as FullCharacter;

const campaign = (roleState: unknown = {}): Campaign =>
  ({ id: "c1", role_state: roleState, location_key: null }) as unknown as Campaign;

const vitals = (wound: string, luck = 4): CampaignVitals =>
  ({ wound_state: wound, luck_current: luck }) as unknown as CampaignVitals;

/** A pending check whose carried numbers agree with the character it is for. */
function pendingFor(
  skillId: string,
  char: FullCharacter,
  over: Partial<PendingCheck>,
): PendingCheck {
  const skill = getSkill(skillId);
  const statValue = (STATS as Record<string, number>)[skill.stat]!;
  const skillLevel = char.skills.find((s) => s.skill_id === skillId)?.level ?? 0;
  return {
    eventId: "e1",
    skillId,
    skillName: skill.name,
    stat: skill.stat,
    statValue,
    skillLevel,
    base: statValue + skillLevel,
    woundPenalty: 0,
    dv: 15,
    bandName: null,
    needed: null,
    opposition: null,
    target: null,
    reads: null,
    intent: "",
    beatId: null,
    ...over,
  } as PendingCheck;
}

const input = (
  char: FullCharacter,
  pending: PendingCheck,
  v: CampaignVitals,
  luckSpend: number,
  camp = campaign(),
): RollCheckInput => ({
  campaign: camp,
  character: char,
  vitals: v,
  inventory: [],
  pending,
  luckSpend,
});

describe("the odds chip against a DV", () => {
  it("previews the very base each roll is made from — Role bonus, Luck and wounds included", () => {
    // A Fixer's Operator Rank rides on Trading; a wounded, lucky one is the
    // case that used to disagree.
    const fixer = character("fixer", 5, [["trading", 3]]);
    for (const wound of ["unwounded", "serious", "mortal"]) {
      for (const luckSpend of [0, 1, 3]) {
        const pending = pendingFor("trading", fixer, { dv: 17 });
        const args = input(fixer, pending, vitals(wound), luckSpend);
        const preview = previewPendingCheck(args)!;
        for (let i = 0; i < 12; i += 1) {
          const roll = rollPendingCheck(args);
          if (roll.kind !== "dv") throw new Error("expected a DV roll");
          expect(roll.result.modifier).toBe(preview.base);
        }
        expect(preview.percent).toBe(checkPercent(preview.base, 17));
      }
    }
  });

  it("takes a wound penalty OFF the chance, and Luck on", () => {
    const solo = character("solo", 4, [["perception", 2]]);
    const pending = pendingFor("perception", solo, { dv: 13 });
    const base = previewPendingCheck(input(solo, pending, vitals("unwounded"), 0))!;
    const hurt = previewPendingCheck(input(solo, pending, vitals("serious"), 0))!;
    const mortal = previewPendingCheck(input(solo, pending, vitals("mortal"), 0))!;
    const lucky = previewPendingCheck(input(solo, pending, vitals("serious"), 2))!;
    expect(hurt.base).toBe(base.base - 2);
    expect(mortal.base).toBe(base.base - 4);
    expect(hurt.percent).toBeLessThan(base.percent);
    expect(lucky.base).toBe(hurt.base + 2);
    expect(lucky.percent).toBeGreaterThan(hurt.percent);
  });

  it("sees a Solo's Threat Detection on Perception and not on anything else", () => {
    const solo = character("solo", 6, [
      ["perception", 2],
      ["persuasion", 2],
    ]);
    const camp = campaign({ combat_awareness: { allocation: { threat_detection: 2 } } });
    const see = previewPendingCheck(
      input(solo, pendingFor("perception", solo, { dv: 15 }), vitals("unwounded"), 0, camp),
    )!;
    const talk = previewPendingCheck(
      input(solo, pendingFor("persuasion", solo, { dv: 15 }), vitals("unwounded"), 0, camp),
    )!;
    expect(see.modifiers).toContainEqual({ label: "Threat Detection", value: 2 });
    expect(see.base).toBe(6 + 2 + 2);
    expect(talk.modifiers).toEqual([]);
    expect(talk.base).toBe(6 + 2);
  });

  it("clamps Luck to what is left, as the roll does", () => {
    const solo = character("solo", 4, [["perception", 2]]);
    const pending = pendingFor("perception", solo, { dv: 15 });
    const args = input(solo, pending, vitals("unwounded", 1), 5);
    const preview = previewPendingCheck(args)!;
    const roll = rollPendingCheck(args);
    expect(roll.luckSpent).toBe(1);
    if (roll.kind !== "dv") throw new Error("expected a DV roll");
    expect(roll.result.modifier).toBe(preview.base);
  });

  it("reads what is true now, not the number the card was drawn with", () => {
    const solo = character("solo", 4, [["perception", 2]]);
    const stale = pendingFor("perception", solo, { dv: 15, base: 99 });
    const args = input(solo, stale, vitals("unwounded"), 0);
    const preview = previewPendingCheck(args)!;
    const roll = rollPendingCheck(args);
    if (roll.kind !== "dv") throw new Error("expected a DV roll");
    expect(preview.base).toBe(roll.result.modifier);
  });

  it("has nothing to say when there is neither a DV nor an opponent", () => {
    const solo = character("solo", 4);
    const pending = pendingFor("perception", solo, { dv: null });
    expect(previewPendingCheck(input(solo, pending, vitals("unwounded"), 0))).toBeNull();
  });
});

describe("the odds chip against a person", () => {
  const opposition = {
    npcKey: "n1",
    npcName: "Trace",
    skillId: "persuasion",
    skillName: "Persuasion",
    stat: "cool",
    statValue: 5,
    skillLevel: 3,
    base: 8,
    remembered: false,
  };

  it("previews both totals the opposed roll is made from", () => {
    const fixer = character("fixer", 5, [["trading", 4]]);
    const pending = pendingFor("trading", fixer, { dv: null, opposition });
    for (const luckSpend of [0, 2]) {
      const args = input(fixer, pending, vitals("serious"), luckSpend);
      const preview = previewPendingCheck(args)!;
      for (let i = 0; i < 12; i += 1) {
        const roll = rollPendingCheck(args);
        if (roll.kind !== "opposed") throw new Error("expected an opposed roll");
        expect(roll.result.actor.modifier).toBe(preview.base);
        expect(roll.result.opponent.modifier).toBe(preview.against);
      }
      expect(preview.percent).toBe(opposedPercent(preview.base, preview.against));
    }
  });

  it("prices a Facedown from COOL + Reputation, with Luck and wounds but no Role bonus", () => {
    const fixer = character("fixer", 5);
    const pending = pendingFor("persuasion", fixer, {
      skillId: FACEDOWN_CHECK_ID,
      skillName: "Facedown",
      stat: "cool",
      statValue: 6,
      skillLevel: 3,
      base: 9,
      dv: null,
      opposition: { ...opposition, statValue: 5, skillLevel: 2, base: 7 },
    });
    const args = input(fixer, pending, vitals("serious"), 1);
    const preview = previewPendingCheck(args)!;
    expect(preview.base).toBe(9 - 2 + 1);
    expect(preview.against).toBe(7);
    for (let i = 0; i < 12; i += 1) {
      const roll = rollPendingCheck(args);
      if (roll.kind !== "opposed") throw new Error("expected an opposed roll");
      expect(roll.result.actor.modifier).toBe(preview.base);
      expect(roll.result.opponent.modifier).toBe(preview.against);
    }
  });
});

describe("what the kit prints", () => {
  const medscanner = [
    { id: "r1", item_id: "medscanner", kind: "gear", quantity: 1 },
  ] as unknown as RollCheckInput["inventory"];

  it("rides a Medscanner's +2 on First Aid, in the chip and in the roll alike", () => {
    const medtech = character("medtech", 2, [["first_aid", 4]]);
    const pending = pendingFor("first_aid", medtech, { dv: 15 });
    const bare = previewPendingCheck(input(medtech, pending, vitals("unwounded"), 0))!;
    const args = { ...input(medtech, pending, vitals("unwounded"), 0), inventory: medscanner };
    const kitted = previewPendingCheck(args)!;
    expect(kitted.base).toBe(bare.base + 2);
    expect(kitted.modifiers).toContainEqual({ label: "Medscanner", value: 2 });
    const roll = rollPendingCheck(args);
    if (roll.kind !== "dv") throw new Error("expected a DV roll");
    expect(roll.result.modifier).toBe(kitted.base);
  });

  it("adds nothing to a Skill the item does not name, or once it is used up", () => {
    const solo = character("solo", 2, [["perception", 4]]);
    const pending = pendingFor("perception", solo, { dv: 15 });
    const bare = previewPendingCheck(input(solo, pending, vitals("unwounded"), 0))!;
    const kitted = previewPendingCheck({
      ...input(solo, pending, vitals("unwounded"), 0),
      inventory: medscanner,
    })!;
    expect(kitted.base).toBe(bare.base);
    const medtech = character("medtech", 2, [["first_aid", 4]]);
    const fa = pendingFor("first_aid", medtech, { dv: 15 });
    const none = [{ ...medscanner[0]!, quantity: 0 }];
    expect(
      previewPendingCheck({ ...input(medtech, fa, vitals("unwounded"), 0), inventory: none })!
        .modifiers,
    ).not.toContainEqual({ label: "Medscanner", value: 2 });
  });
});
