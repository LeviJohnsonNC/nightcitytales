import { describe, expect, it } from "vitest";
import {
  DIFFICULTY_VALUES,
  NIGHT_AT_THE_OPERA,
  SKILLS,
  generateJob,
  knownTruths,
  truthsInBeat,
  truthsRevealedAt,
  type Mission,
} from "@/engine";

/** Every mission the app can put in front of a player: authored and generated. */
const MISSIONS: Mission[] = [
  NIGHT_AT_THE_OPERA,
  ...Array.from({ length: 12 }, (_, seed) => generateJob(seed)),
];

describe("the concealed half of a beat", () => {
  it("names a printed Skill and a published difficulty, every time", () => {
    const skillIds = new Set(SKILLS.map((s) => s.id));
    const bands = new Set(DIFFICULTY_VALUES.map((d) => d.name));
    for (const mission of MISSIONS) {
      for (const beat of mission.beats) {
        for (const truth of beat.truths ?? []) {
          expect(skillIds, `${mission.id}/${beat.id}: ${truth.skill}`).toContain(truth.skill);
          expect(bands, `${mission.id}/${beat.id}: ${truth.difficulty}`).toContain(
            truth.difficulty,
          );
        }
      }
    }
  });

  /**
   * The bug this test exists for was mine, written and caught in the same hour:
   * `revealedAt: "meeting_the_master"` named a beat that does not exist, so the
   * mission's central twist would simply never have landed. A typo here is
   * invisible in play — the reveal just quietly never happens.
   */
  it("only ever points `revealedAt` at a beat the mission actually has", () => {
    for (const mission of MISSIONS) {
      const ids = new Set(mission.beats.map((b) => b.id));
      for (const beat of mission.beats) {
        for (const truth of beat.truths ?? []) {
          if (!truth.revealedAt) continue;
          expect(ids, `${mission.id}/${beat.id}/${truth.id} → ${truth.revealedAt}`).toContain(
            truth.revealedAt,
          );
        }
      }
    }
  });

  it("gives every truth a stable, unique key", () => {
    for (const mission of MISSIONS) {
      for (const beat of mission.beats) {
        const truths = truthsInBeat({
          missionId: mission.id,
          beatId: beat.id,
          truths: beat.truths,
        });
        const keys = truths.map((t) => t.key);
        expect(new Set(keys).size, `${mission.id}/${beat.id}`).toBe(keys.length);
        expect(
          truthsInBeat({ missionId: mission.id, beatId: beat.id, truths: beat.truths }).map(
            (t) => t.key,
          ),
        ).toEqual(keys);
      }
    }
  });

  it("is absent from the prompt until it is found", () => {
    // The invariant. With nothing discovered there is nothing to hand over.
    for (const mission of MISSIONS) {
      for (const beat of mission.beats) {
        const truths = truthsInBeat({
          missionId: mission.id,
          beatId: beat.id,
          truths: beat.truths,
        });
        expect(knownTruths(truths, [])).toEqual([]);
      }
    }
  });
});

/**
 * The leak, as a regression guard.
 *
 * `gmBrief` reaches the model every turn of its beat, and `JobCard.tsx` has
 * always been careful never to render one to the player. These phrases were in
 * briefs: the narrator was told the whole solution of Night at the Opera on
 * beat one and asked to spend four beats of investigation not letting on.
 */
describe("no brief carries its own twist any more", () => {
  const MOVED_OUT = [
    "pawn in a scheme",
    "if searched",
    "It is not clean",
    "The answer implicates the client",
    "someone sold the schedule",
    "may not want extracting",
    "expendable was required",
    "floor plan was wrong",
    "principal is not being straight",
    "Only Lucy Rhinemeyer still lives",
  ];

  it("keeps every one of them out of every gmBrief", () => {
    for (const mission of MISSIONS) {
      for (const beat of mission.beats) {
        for (const phrase of MOVED_OUT) {
          expect(
            beat.gmBrief.toLowerCase(),
            `${mission.id}/${beat.id} still tells the narrator: "${phrase}"`,
          ).not.toContain(phrase.toLowerCase());
        }
      }
    }
  });

  it("still gives the narrator its stage directions", () => {
    // The other half has to survive: a brief stripped to nothing is a scene the
    // model has to invent from the title.
    for (const mission of MISSIONS) {
      for (const beat of mission.beats) {
        expect(beat.gmBrief.length, `${mission.id}/${beat.id}`).toBeGreaterThan(40);
      }
    }
  });
});

describe("a twist that lands on arrival", () => {
  it("is returned only for the beat that reveals it", () => {
    const mission = NIGHT_AT_THE_OPERA;
    const background = mission.beats.find((b) => b.id === "background")!;
    const args = {
      missionId: mission.id,
      beatId: background.id,
      truths: background.truths,
    };
    // The pawn twist is The Master's to confess, on his own scene.
    expect(truthsRevealedAt({ ...args, atBeatId: "background" })).toEqual([]);
    expect(truthsRevealedAt({ ...args, atBeatId: "night_at_opera" })).toEqual([]);
    const landed = truthsRevealedAt({ ...args, atBeatId: "darkness_and_light" });
    expect(landed).toHaveLength(1);
    expect(landed[0]!.fact).toContain("pawn");
  });

  it("leaves a truth with no `revealedAt` to be found by looking", () => {
    // Huntver's office: the photo, the costume and the head are searched for,
    // and no beat hands them over.
    const office = NIGHT_AT_THE_OPERA.beats.find((b) => b.id === "empty_office_hours")!;
    expect(office.truths?.length).toBeGreaterThan(2);
    for (const beat of NIGHT_AT_THE_OPERA.beats) {
      expect(
        truthsRevealedAt({
          missionId: NIGHT_AT_THE_OPERA.id,
          beatId: office.id,
          truths: office.truths,
          atBeatId: beat.id,
        }),
      ).toEqual([]);
    }
  });
});
