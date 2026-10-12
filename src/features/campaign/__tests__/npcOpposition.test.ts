/**
 * The campaign's memory of who pushes back and how hard. The rule under test is
 * that memory beats improvisation: once a fixer has resisted with a COOL of 6,
 * every later check uses 6, whatever the model says that turn.
 */
import { describe, expect, it } from "vitest";
import type { Opposition } from "@/engine";
import type { CampaignNpc } from "@/lib/backend";
import {
  oppositionProfileOf,
  profileWith,
  reconcileFacedown,
  reconcileOpposition,
} from "../npcOpposition";

const npc = (data: unknown): CampaignNpc =>
  ({ id: "n1", campaign_id: "c1", npc_id: "trace", name: "Trace Santiago", data }) as CampaignNpc;

const proposed: Opposition = {
  name: "Trace Santiago",
  skillId: "human_perception", // printed under EMP
  skillLevel: 3,
  statValue: 5,
};

describe("oppositionProfileOf", () => {
  it("reads remembered stats and skills", () => {
    const profile = oppositionProfileOf(
      npc({ opposition: { stats: { emp: 7 }, skills: { human_perception: 5 } } }),
    );
    expect(profile).toEqual({ stats: { emp: 7 }, skills: { human_perception: 5 } });
  });

  it("is empty for an NPC nobody has measured", () => {
    expect(oppositionProfileOf(npc({}))).toEqual({ stats: {}, skills: {} });
    expect(oppositionProfileOf(null)).toEqual({ stats: {}, skills: {} });
  });

  it("ignores junk values rather than trusting them as numbers", () => {
    const profile = oppositionProfileOf(
      npc({ opposition: { stats: { emp: "high" }, skills: { human_perception: null } } }),
    );
    expect(profile).toEqual({ stats: {}, skills: {} });
  });
});

describe("reconcileOpposition", () => {
  it("uses what the campaign remembers over what the GM improvised", () => {
    const { opposition, remembered } = reconcileOpposition(proposed, {
      stats: { emp: 7 },
      skills: { human_perception: 5 },
    });
    expect(opposition.statValue).toBe(7);
    expect(opposition.skillLevel).toBe(5);
    expect(remembered).toBe(true);
  });

  it("takes the proposal when this NPC has never been measured", () => {
    const { opposition, remembered } = reconcileOpposition(proposed, { stats: {}, skills: {} });
    expect(opposition).toEqual(proposed);
    expect(remembered).toBe(false);
  });

  it("fills only the gaps: a known STAT with a skill they have never used", () => {
    const { opposition, remembered } = reconcileOpposition(proposed, {
      stats: { emp: 7 },
      skills: {},
    });
    expect(opposition.statValue).toBe(7); // remembered
    expect(opposition.skillLevel).toBe(3); // new information
    expect(remembered).toBe(true);
  });

  it("keeps a remembered zero rather than treating it as unknown", () => {
    const { opposition } = reconcileOpposition(proposed, {
      stats: { emp: 7 },
      skills: { human_perception: 0 },
    });
    expect(opposition.skillLevel).toBe(0);
  });
});

describe("profileWith", () => {
  it("files the numbers under the skill's printed STAT", () => {
    const profile = profileWith({ stats: {}, skills: {} }, proposed);
    expect(profile).toEqual({ stats: { emp: 5 }, skills: { human_perception: 3 } });
  });

  it("adds to what is already known without dropping it", () => {
    const profile = profileWith(
      { stats: { cool: 8 }, skills: { persuasion: 6 } },
      { ...proposed, skillId: "concentration", statValue: 4, skillLevel: 2 }, // WILL
    );
    expect(profile.stats).toEqual({ cool: 8, will: 4 });
    expect(profile.skills).toEqual({ persuasion: 6, concentration: 2 });
  });
});

describe("a Facedown's numbers", () => {
  const stare: Opposition = { name: "Rogue", skillId: "facedown", skillLevel: 6, statValue: 8 };

  it("is remembered without being read as a Skill, which used to throw after the roll", () => {
    const profile = profileWith({ stats: {}, skills: {} }, stare);
    expect(profile).toEqual({ stats: { cool: 8 }, skills: {}, reputation: 6 });
  });

  it("stares back with the person's own COOL and Reputation once they are on file", () => {
    const npc = {
      npc_id: "fixer",
      name: "Rogue",
      data: { opposition: { stats: { cool: 8 }, skills: {}, reputation: 6 } },
    } as unknown as CampaignNpc;
    const profile = oppositionProfileOf(npc);
    // The model says Reputation 0 tonight; she is still Rogue.
    expect(reconcileFacedown({ cool: 3, reputation: 0 }, profile)).toEqual({
      cool: 8,
      reputation: 6,
      remembered: true,
    });
  });

  it("takes the proposal for a stranger, and shares COOL with their other checks", () => {
    expect(reconcileFacedown({ cool: 5, reputation: 2 }, { stats: {}, skills: {} })).toEqual({
      cool: 5,
      reputation: 2,
      remembered: false,
    });
    // COOL measured on a Persuasion check is the COOL they stare with.
    expect(
      reconcileFacedown({ cool: 2, reputation: 1 }, { stats: { cool: 7 }, skills: {} }),
    ).toMatchObject({ cool: 7, reputation: 1, remembered: true });
  });
});
