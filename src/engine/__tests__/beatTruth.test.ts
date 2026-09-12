import { describe, expect, it } from "vitest";
import {
  DEDUCTION_SKILL,
  DIFFICULTY_VALUES,
  NIGHT_AT_THE_OPERA,
  SKILLS,
  beatNeedKey,
  deducibleFrom,
  deductionOffer,
  generateJob,
  knownTruths,
  searchWith,
  searchesFor,
  truthsInBeat,
  truthsInMission,
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

  /**
   * The brief is not the only thing in a beat that reaches the model. A check's
   * `note` goes over with it, and the Opera's printed notes said what searching
   * WOULD FIND — "Desk: a photo of Barbara Dahl", "hiding a preserved human
   * head" — which handed over exactly what the truths above were extracted to
   * withhold. A note's job is to name where a character can put their hands.
   */
  it("keeps them out of the check notes too", () => {
    const FINDINGS = [
      "photo of Barbara Dahl",
      "preserved human head",
      "bloodstained clown costume",
      "Vampyres cyberware",
    ];
    for (const mission of MISSIONS) {
      for (const beat of mission.beats) {
        for (const check of beat.checks ?? []) {
          for (const phrase of [...FINDINGS, ...MOVED_OUT]) {
            expect(
              (check.note ?? "").toLowerCase(),
              `${mission.id}/${beat.id} check note still says: "${phrase}"`,
            ).not.toContain(phrase.toLowerCase());
          }
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

/**
 * Deduction: a conclusion whose prerequisites are other discoveries.
 *
 * `Truth.needs` was declared empty in the truth spine on the argument that
 * retrofitting it would cost a migration. This is the slice that fills it in,
 * and the invariant it buys is that a conclusion cannot be rolled for out of
 * nowhere: it is unreachable — not merely hard — until the pieces are in hand.
 */
describe("working something out", () => {
  /** Every mission truth, with needs already resolved to real keys. */
  const allOf = (mission: Mission) =>
    truthsInMission({ missionId: mission.id, beats: mission.beats });

  /**
   * The same class of bug as `revealedAt: "meeting_the_master"`, and quieter: a
   * `needs` entry naming a truth that does not exist makes the conclusion
   * unreachable FOREVER, with nothing in play to show why.
   */
  it("only ever names prerequisites the mission actually has", () => {
    for (const mission of MISSIONS) {
      const keys = new Set(allOf(mission).map((truth) => truth.key));
      for (const truth of allOf(mission)) {
        for (const need of truth.needs) {
          expect(keys, `${mission.id}: ${truth.key} needs ${need}`).toContain(need);
          expect(need, `${mission.id}: ${truth.key} needs itself`).not.toBe(truth.key);
        }
      }
    }
  });

  it("resolves a bare id against the same beat and a prefixed one across beats", () => {
    const opera = truthsInBeat({
      missionId: "m",
      beatId: "office",
      truths: [
        {
          id: "conclusion",
          fact: "The professor is the monster.",
          skill: "deduction",
          difficulty: "Difficult",
          needs: ["costume", "hook:tip_off"],
        },
      ],
    });
    expect(opera[0]!.needs).toEqual(["beat:m:office::costume", "beat:m:hook::tip_off"]);
    expect(opera[0]!.needs[0]).toBe(
      beatNeedKey({ missionId: "m", beatId: "office", need: "costume" }),
    );
  });

  it("holds the Opera's conclusion shut until the evidence is in hand", () => {
    const truths = allOf(NIGHT_AT_THE_OPERA);
    const conclusion = truths.find((t) => t.key.endsWith("::huntver_is_ruthven"))!;
    expect(conclusion.needs).toHaveLength(2);

    // Nothing found: the leap is not on offer at any total.
    expect(deducibleFrom(truths, [])).toHaveLength(0);
    expect(deductionOffer(truths, [])).toBeNull();
    expect(searchWith({ truths, skillId: "deduction", discovered: [], total: 99 })).toEqual({
      outcome: "nothing",
    });

    // One piece short: still shut. This is the point of the mechanism — a
    // brilliant roll is not a substitute for the legwork.
    const short = conclusion.needs.slice(0, 1);
    expect(deducibleFrom(truths, short)).toHaveLength(0);

    // Both pieces: now it is reachable, and the offer carries the engine's DV.
    const ready = [...conclusion.needs];
    expect(deducibleFrom(truths, ready).map((t) => t.key)).toEqual([conclusion.key]);
    expect(deductionOffer(truths, ready)).toEqual({ dv: conclusion.found.dv, count: 1 });

    // And the roll still has to land.
    expect(
      searchWith({
        truths,
        skillId: "deduction",
        discovered: ready,
        total: conclusion.found.dv - 1,
      }),
    ).toEqual({ outcome: "missed" });
    expect(
      searchWith({ truths, skillId: "deduction", discovered: ready, total: conclusion.found.dv }),
    ).toMatchObject({ outcome: "found", truth: { key: conclusion.key } });

    // Once drawn, it is not on offer again.
    expect(deductionOffer(truths, [...ready, conclusion.key])).toBeNull();
  });

  it("is worked out from the whole job, not from the room the character is in", () => {
    // The prerequisites live in the office beat; a conclusion has to be
    // reachable from wherever the character is standing when it clicks.
    const mission = NIGHT_AT_THE_OPERA;
    const office = mission.beats.find((b) => b.id === "empty_office_hours")!;
    const elsewhere = mission.beats.find((b) => b.id === "monster_hunt")!;
    const conclusion = allOf(mission).find((t) => t.key.endsWith("::huntver_is_ruthven"))!;
    const ready = [...conclusion.needs];

    // Pooled by beat, standing somewhere else: nothing to work out.
    const roomOnly = truthsInBeat({
      missionId: mission.id,
      beatId: elsewhere.id,
      truths: elsewhere.truths,
    });
    expect(deducibleFrom(roomOnly, ready)).toHaveLength(0);

    // Pooled by mission: the leap is available anywhere in the job.
    expect(deducibleFrom(allOf(mission), ready).map((t) => t.key)).toEqual([conclusion.key]);
    expect(office.truths?.some((t) => t.id === "huntver_is_ruthven")).toBe(true);
  });

  it("gives every conclusion in the game something to stand on", () => {
    // A deduction truth with no prerequisites is a conclusion drawn from
    // nothing, which is the thing this whole slice exists to stop.
    let checked = 0;
    for (const mission of MISSIONS) {
      for (const truth of allOf(mission)) {
        if (truth.found.skillId !== DEDUCTION_SKILL) continue;
        expect(truth.needs.length, `${mission.id}: ${truth.key}`).toBeGreaterThan(0);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("lets the story land a conclusion the player never worked out", () => {
    // `needs` gates working it out EARLY and must never gate the plot: a truth
    // with both still arrives when the story reaches the beat that exposes it.
    const gated = MISSIONS.flatMap((mission) =>
      mission.beats.flatMap((beat) =>
        (beat.truths ?? [])
          .filter((t) => t.needs?.length && t.revealedAt)
          .map((t) => ({ mission, beat, truth: t })),
      ),
    );
    expect(gated.length).toBeGreaterThan(0);
    for (const { mission, beat, truth } of gated) {
      const revealed = truthsRevealedAt({
        missionId: mission.id,
        beatId: beat.id,
        truths: beat.truths,
        atBeatId: truth.revealedAt!,
      });
      expect(revealed.map((t) => t.key)).toContain(
        truthsInBeat({ missionId: mission.id, beatId: beat.id, truths: beat.truths }).find((t) =>
          t.key.endsWith(`::${truth.id}`),
        )!.key,
      );
    }
  });

  it("keeps a Skill that finds nothing here out of the search machinery", () => {
    const truths = allOf(NIGHT_AT_THE_OPERA);
    // Athletics over a fence is not a search, whatever the total.
    expect(searchesFor("athletics", truths)).toBe(false);
    // A Skill a beat declares searches, even though the city templates are all
    // Perception — the bug that made every non-Perception beat truth unrollable.
    expect(searchesFor("human_perception", truths)).toBe(true);
    expect(searchesFor(DEDUCTION_SKILL, truths)).toBe(true);
    expect(searchesFor("perception", [])).toBe(true);
  });
});
