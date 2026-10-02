/**
 * Being recognised: Reputation's two printed uses at the table, end to end.
 *
 * The recognition roll (somebody new has heard of the character when 1d10
 * comes in under their Reputation) and the Facedown (COOL + Reputation + 1d10
 * each, the loser backs down). Both are dice the engine rolls; the narrator
 * proposes a Facedown and is told how a recognition came out, and decides
 * neither. These follow each from the model's wire to the roll.
 */
import { describe, expect, it } from "vitest";
import {
  FACEDOWN_CHECK_ID,
  facedown,
  OPPOSED_CHECK_TIE_GOES_TO,
  recognitionRoll,
  REPUTATION,
  seededRng,
  type ReputationStanding,
} from "@/engine";
import type { CampaignEvent, FullCharacter } from "@/lib/backend";
import { normalizeGmResponse } from "@/features/gm/gmResponse";
import { GM_SYSTEM_PROMPT } from "@/features/gm/gmSystemPrompt";
import { normalizeLifeResponse } from "@/features/life/lifeResponse";
import { LIFE_SYSTEM_PROMPT } from "@/features/life/lifeSystemPrompt";
import { REPUTATION_RULE } from "@/features/narration/narratorRules";
import {
  describePendingCheck,
  facedownOutcomeLine,
  facedownPrompt,
} from "@/features/play/checkPrompt";
import { reputationProp } from "../recognition";

const quiet = { onWarn: () => {} };

describe("the recognition roll", () => {
  it("is never rolled for a nobody", () => {
    expect(recognitionRoll(0, seededRng(1))).toEqual({ reputation: 0, roll: 0, heardOf: false });
  });

  it("is heard of exactly when the d10 comes in under the Reputation", () => {
    const rng = seededRng(5);
    for (let i = 0; i < 200; i += 1) {
      const r = recognitionRoll(4, rng);
      expect(r.roll).toBeGreaterThanOrEqual(1);
      expect(r.roll).toBeLessThanOrEqual(10);
      expect(r.heardOf).toBe(r.roll < 4);
    }
  });

  it("reaches the narrator as a fact, with no die in it, and says nothing for a nobody", () => {
    const rep = (level: number): ReputationStanding => ({
      level,
      whoKnows: REPUTATION.levels.find((l) => l.level === level)?.whoKnows ?? null,
      deeds: 1,
    });
    expect(reputationProp(rep(0), { reputation: 0, roll: 0, heardOf: false })).toEqual({});
    const heard = reputationProp(rep(3), { reputation: 3, roll: 2, heardOf: true });
    expect(heard).toEqual({
      reputation: expect.stringContaining("HAS heard of them"),
    });
    const not = reputationProp(rep(3), { reputation: 3, roll: 7, heardOf: false });
    expect((not as { reputation: string }).reputation).toContain("has NOT heard of them");
    expect((not as { reputation: string }).reputation).not.toContain("7");
  });
});

describe("a Facedown", () => {
  it("is COOL + Reputation on both sides", () => {
    const result = facedown(
      {
        actorName: "Red",
        actorCool: 7,
        actorReputation: 4,
        opponentName: "Bouncer",
        opponentCool: 5,
        opponentReputation: 1,
      },
      seededRng(9),
    );
    expect(result.actorSide).toMatchObject({
      statLabel: "COOL",
      statValue: 7,
      skillLabel: "Reputation",
      skillValue: 4,
    });
    expect(result.opponentSide).toMatchObject({
      statLabel: "COOL",
      statValue: 5,
      skillLabel: "Reputation",
      skillValue: 1,
    });
    expect(result.success).toBe(result.actor.total > result.opponent.total);
  });

  it("gives a tie to the side the rules give every tie to", () => {
    // Search for a seed that ties, so the rule is exercised rather than assumed.
    for (let seed = 1; seed < 5000; seed += 1) {
      const r = facedown(
        {
          actorName: "A",
          actorCool: 5,
          actorReputation: 2,
          opponentName: "B",
          opponentCool: 5,
          opponentReputation: 2,
        },
        seededRng(seed),
      );
      if (r.tie) {
        expect(r.success).toBe(OPPOSED_CHECK_TIE_GOES_TO !== "defender");
        return;
      }
    }
    throw new Error("No tie found in 5000 seeds.");
  });

  it("is proposed by either narrator, with the other side clamped to a person", () => {
    const gm = normalizeGmResponse(
      {
        narration: "He fills the doorway.",
        proposedActions: [
          {
            kind: "stare_down",
            npcName: "Bouncer",
            opposingCool: 14,
            opposingReputation: -3,
            intent: "get past",
          },
        ],
      },
      quiet,
    );
    expect(gm.proposedActions).toEqual([
      {
        kind: "facedown",
        npcKey: "Bouncer",
        npcName: "Bouncer",
        opposingCool: 10,
        opposingReputation: 0,
        intent: "get past",
      },
    ]);

    const life = normalizeLifeResponse(
      {
        situation: { title: "The bar", description: "A rival at the bar." },
        proposedActions: [
          {
            kind: "facedown",
            npcKey: "rival",
            npcName: "Vex",
            opposingCool: 6,
            opposingReputation: 2,
            intent: "make her leave",
          },
        ],
      },
      quiet,
    );
    expect(life.proposedActions).toContainEqual({
      kind: "facedown",
      npcKey: "rival",
      npcName: "Vex",
      opposingCool: 6,
      opposingReputation: 2,
      intent: "make her leave",
    });
  });

  it("becomes a card that reads the character's own Reputation from the engine, not the model", () => {
    const prompt = facedownPrompt({
      npcKey: "bouncer",
      npcName: "Bouncer",
      opposingCool: 5,
      opposingReputation: 1,
      intent: "get past",
    });
    const event = {
      id: "e1",
      type: "check_prompt",
      data: prompt.data,
      beat_id: null,
    } as unknown as CampaignEvent;
    const character = {
      stats: { cool: 7 },
      skills: [],
      character: { name: "Red", role: "solo" },
    } as unknown as FullCharacter;
    const card = describePendingCheck(event, character, "none", {
      vitals: { humanity_current: 50, humanity_max: 50 } as never,
      inventory: [],
      reputation: 4,
    });
    expect(card).toMatchObject({
      skillId: FACEDOWN_CHECK_ID,
      skillName: "Facedown",
      statValue: 7,
      skillLevel: 4,
      base: 11,
      dv: null,
      reads: null,
      opposition: {
        npcName: "Bouncer",
        skillName: "Reputation",
        statValue: 5,
        skillLevel: 1,
        base: 6,
      },
    });
  });

  it("tells the narrator who backed down, and says nothing for any other check", () => {
    const pending = { skillId: FACEDOWN_CHECK_ID, opposition: { npcName: "Bouncer" } } as never;
    expect(facedownOutcomeLine(pending, true)).toContain("Bouncer backs down");
    expect(facedownOutcomeLine(pending, false)).toContain(
      "the character is the one who backs down",
    );
    expect(facedownOutcomeLine({ skillId: "persuasion", opposition: null } as never, true)).toBe(
      "",
    );
  });
});

describe("the rule", () => {
  it("is one text, in both narrators' prompts", () => {
    expect(GM_SYSTEM_PROMPT).toContain(REPUTATION_RULE);
    expect(LIFE_SYSTEM_PROMPT).toContain(REPUTATION_RULE);
  });

  it("is offered as an action shape in both", () => {
    expect(GM_SYSTEM_PROMPT).toMatch(/"kind": "facedown"/);
    expect(LIFE_SYSTEM_PROMPT).toMatch(/"kind":"facedown"/);
  });
});

describe("rolling a Facedown card", () => {
  it("rolls COOL + Reputation against theirs, with wounds but no Role bonus", async () => {
    const { rollPendingCheck } = await import("@/features/play/rollCheck");
    const roll = rollPendingCheck({
      campaign: { id: "c", role_state: {}, location_key: null } as never,
      // A Solo, whose Threat Detection would ride on a Perception check.
      character: {
        character: { name: "Red", role: "solo" },
        stats: { cool: 7, luck: 5 },
        skills: [],
        roleAbility: { rank: 4 },
      } as never,
      vitals: { wound_state: "serious", luck_current: 5 } as never,
      inventory: [],
      pending: {
        eventId: "e1",
        skillId: FACEDOWN_CHECK_ID,
        skillName: "Facedown",
        stat: "cool",
        statValue: 7,
        skillLevel: 4,
        base: 11,
        woundPenalty: -2,
        dv: null,
        bandName: null,
        needed: null,
        opposition: {
          npcKey: "b",
          npcName: "Bouncer",
          skillId: FACEDOWN_CHECK_ID,
          skillName: "Reputation",
          stat: "cool",
          statValue: 5,
          skillLevel: 1,
          base: 6,
          remembered: false,
        },
        target: null,
        reads: null,
        intent: "get past",
        beatId: null,
      },
    });
    expect(roll.kind).toBe("opposed");
    if (roll.kind !== "opposed") return;
    expect(roll.result.actorSide).toMatchObject({
      skillLabel: "Reputation",
      skillValue: 4,
      statValue: 7,
    });
    expect(roll.result.opponentSide).toMatchObject({
      name: "Bouncer",
      statValue: 5,
      skillValue: 1,
    });
    expect(roll.result.actorSide.modifiers?.map((m) => m.label)).toEqual(["Wounds"]);
  });
});
