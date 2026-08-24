import { describe, expect, it } from "vitest";
import {
  advance,
  availableExits,
  currentBeat,
  generateJob,
  getMission,
  isGeneratedJobId,
  jobFromId,
  jobIdForSeed,
  missionPayout,
  rollJobSeed,
  seedFromJobId,
  startMission,
  validateMission,
  NIGHT_AT_THE_OPERA,
  type Mission,
} from "../index";
import { seededRng } from "../dice";
import { fillSlots } from "../missions/generator";

/** A spread of seeds, fixed so a failure is always reproducible. */
const SEEDS = Array.from({ length: 250 }, (_, i) => i * 7919 + 13);

describe("job ids carry their own seed", () => {
  it("round-trips a seed through an id", () => {
    for (const seed of [0, 1, 42, 0xdeadbeef, 0xffffffff]) {
      expect(seedFromJobId(jobIdForSeed(seed))).toBe(seed >>> 0);
    }
  });

  it("recognises generated ids and rejects authored ones", () => {
    expect(isGeneratedJobId(jobIdForSeed(7))).toBe(true);
    expect(isGeneratedJobId("night-at-the-opera")).toBe(false);
    expect(isGeneratedJobId("job-")).toBe(false);
    expect(isGeneratedJobId("job-nothex!")).toBe(false);
    expect(isGeneratedJobId("job-1234567")).toBe(false); // too short
    expect(seedFromJobId("night-at-the-opera")).toBeNull();
  });

  it("gives every job an id that regenerates it", () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const job = generateJob(seed);
      expect(jobFromId(job.id)).toEqual(job);
    }
  });
});

describe("generation is deterministic", () => {
  it("produces an identical mission for the same seed", () => {
    for (const seed of SEEDS.slice(0, 40)) {
      expect(generateJob(seed)).toEqual(generateJob(seed));
    }
  });

  it("does not depend on call order", () => {
    const a = generateJob(101);
    generateJob(999); // advance nothing shared
    expect(generateJob(101)).toEqual(a);
  });

  it("truncates a seed to 32 bits consistently", () => {
    expect(generateJob(0)).toEqual(generateJob(0x100000000));
  });
});

describe("every generated job is walkable", () => {
  it("passes structural validation for every seed tried", () => {
    for (const seed of SEEDS) {
      const problems = validateMission(generateJob(seed));
      expect(problems, `seed ${seed}: ${problems.join("; ")}`).toEqual([]);
    }
  });

  it("can be played from start to a completed Resolution down either branch", () => {
    for (const seed of SEEDS.slice(0, 60)) {
      const mission = generateJob(seed);
      for (const branch of [0, 1]) {
        let runtime = startMission(mission);
        let guard = 0;
        while (runtime.status === "active" && guard < 20) {
          const exits = availableExits(mission, runtime);
          if (exits.length === 0) break;
          const exit = exits[Math.min(branch, exits.length - 1)];
          runtime = advance(mission, runtime, exit!.to);
          guard += 1;
        }
        expect(runtime.status, `seed ${seed} branch ${branch}`).toBe("completed");
        expect(currentBeat(mission, runtime).type).toBe("resolution");
      }
    }
  });

  it("offers a real choice at the legwork beat, and the two lead somewhere different", () => {
    const mission = generateJob(2024);
    const legwork = mission.beats.find((b) => b.id === "legwork");
    expect(legwork?.exits).toHaveLength(2);
    expect(legwork?.exits[0]?.to).not.toBe(legwork?.exits[1]?.to);
    expect(legwork?.exits[0]?.sets).not.toEqual(legwork?.exits[1]?.sets);
  });

  it("always carries an objective and a payout", () => {
    for (const seed of SEEDS.slice(0, 60)) {
      const mission = generateJob(seed);
      const start = mission.beats.find((b) => b.id === mission.startBeatId);
      expect(start?.objectives?.length).toBeGreaterThan(0);
      const payout = missionPayout(mission);
      expect(payout?.total).toBeGreaterThan(0);
      expect(payout!.upfront).toBeLessThan(payout!.total);
    }
  });
});

describe("generated prose is fully filled in", () => {
  it("leaves no unresolved {slot} anywhere in any job", () => {
    for (const seed of SEEDS) {
      const mission = generateJob(seed);
      const text = JSON.stringify(mission);
      expect(text, `seed ${seed}`).not.toMatch(/\{[a-zA-Z_]\w*\}/);
    }
  });

  it("throws on a template naming a slot that was never supplied", () => {
    expect(() => fillSlots("a {nope} b", { patron: "x" })).toThrow(/unknown slot/);
  });

  it("never starts a sentence with a lowercase word", () => {
    // Slot values spliced after a period used to read "...turns. it was never
    // meant to be edited". Structure tests cannot see that; this can.
    for (const seed of SEEDS) {
      const mission = generateJob(seed);
      for (const beat of mission.beats) {
        for (const prose of [beat.readAloud, beat.gmBrief]) {
          if (!prose) continue;
          const bad = prose.match(/[.!?]\s+[a-z]\w+/g) ?? [];
          expect(bad, `seed ${seed}, beat ${beat.id}`).toEqual([]);
        }
      }
    }
  });

  it("does not splice the full target name where a short reference belongs", () => {
    // "a room with a braindance master recording in it" reads like a stutter;
    // the later beats use the short form ({the}) instead.
    for (const seed of SEEDS.slice(0, 80)) {
      const mission = generateJob(seed);
      const climax = mission.beats.find((b) => b.id === "climax");
      expect(climax?.gmBrief).not.toMatch(/\ba (?:sealed|prototype|crate|braindance|witness)/);
    }
  });

  it("does not claim a book as its source", () => {
    const mission = generateJob(5);
    expect(mission.source).toBe("Procedurally generated job");
    expect(mission.source).not.toMatch(/pg\.|page/i);
  });
});

describe("generated checks stay inside the printed rules", () => {
  it("names only printed Skills and published DVs", () => {
    // checkFrom throws on either, so a clean run over many seeds is the
    // assertion; this also pins the DVs to the published set explicitly.
    const published = new Set([9, 13, 15, 17, 21, 24, 29]);
    for (const seed of SEEDS) {
      for (const beat of generateJob(seed).beats) {
        for (const check of beat.checks ?? []) {
          expect(published.has(check.dv), `seed ${seed}: DV ${check.dv}`).toBe(true);
        }
      }
    }
  });
});

describe("getMission resolves generated and authored alike", () => {
  it("returns an authored mission unchanged", () => {
    expect(getMission(NIGHT_AT_THE_OPERA.id)).toBe(NIGHT_AT_THE_OPERA);
  });

  it("rebuilds a generated job from its id alone", () => {
    const id = jobIdForSeed(31337);
    expect(getMission(id).id).toBe(id);
    expect(getMission(id)).toEqual(generateJob(31337));
  });

  it("still throws on an id that is neither", () => {
    expect(() => getMission("no-such-mission")).toThrow(/No registered mission/);
  });
});

describe("the authored mission is well-formed too", () => {
  it("validates, which is what makes the validator worth trusting", () => {
    expect(validateMission(NIGHT_AT_THE_OPERA)).toEqual([]);
  });
});

describe("validateMission catches what it claims to", () => {
  const base = (): Mission => ({
    id: "t",
    title: "T",
    source: "test",
    startBeatId: "a",
    beats: [
      { id: "a", type: "hook", title: "A", gmBrief: "", exits: [{ to: "b", label: "on" }] },
      { id: "b", type: "resolution", title: "B", gmBrief: "", exits: [] },
    ],
  });

  it("accepts a sound graph", () => {
    expect(validateMission(base())).toEqual([]);
  });

  it("catches an exit to nowhere", () => {
    const m = base();
    m.beats[0]!.exits = [{ to: "ghost", label: "on" }];
    expect(validateMission(m).join()).toMatch(/does not exist/);
  });

  it("catches a start beat that is not in the mission", () => {
    const m = base();
    m.startBeatId = "elsewhere";
    expect(validateMission(m).join()).toMatch(/not a beat/);
  });

  it("catches an unreachable beat", () => {
    const m = base();
    m.beats.push({ id: "orphan", type: "dev", title: "O", gmBrief: "", exits: [] });
    expect(validateMission(m).join()).toMatch(/unreachable/);
  });

  it("catches a mission that can never complete", () => {
    const m = base();
    m.beats[1]!.type = "dev";
    m.beats[1]!.exits = [{ to: "a", label: "back" }];
    expect(validateMission(m).join()).toMatch(/never complete/);
  });

  it("catches a duplicate beat id", () => {
    const m = base();
    m.beats.push({ id: "a", type: "dev", title: "dupe", gmBrief: "", exits: [] });
    expect(validateMission(m).join()).toMatch(/Duplicate beat id/);
  });
});

describe("rollJobSeed", () => {
  it("is a 32-bit unsigned integer", () => {
    for (const value of [0, 0.5, 0.999999]) {
      const seed = rollJobSeed(() => value);
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it("produces ids that regenerate, drawn from a seeded stream", () => {
    const rng = seededRng(4);
    for (let i = 0; i < 25; i += 1) {
      const id = jobIdForSeed(rollJobSeed(rng));
      expect(validateMission(getMission(id))).toEqual([]);
    }
  });
});

describe("variety", () => {
  it("does not hand every player the same job", () => {
    const titles = new Set(SEEDS.map((seed) => generateJob(seed).title));
    expect(titles.size).toBeGreaterThan(5);
    const signatures = new Set(
      SEEDS.map((seed) => {
        const m = generateJob(seed);
        return `${m.title}|${m.subtitle}|${m.patron}`;
      }),
    );
    // Distinct jobs across 250 seeds — the pools multiply out to far more.
    expect(signatures.size).toBeGreaterThan(100);
  });
});
