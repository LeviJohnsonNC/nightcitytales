import { describe, expect, it } from "vitest";
import {
  advance,
  availableExits,
  currentBeat,
  failMission,
  getBeat,
  isTerminal,
  missionOffer,
  runtimeAtBeat,
  startMission,
  validateMission,
  type Beat,
  type BeatExit,
  type Mission,
} from "../mission";
import { NIGHT_AT_THE_OPERA, getMission, listMissions } from "../missions";

const demo: Mission = {
  id: "demo",
  title: "Demo",
  source: "test",
  startBeatId: "a",
  beats: [
    {
      id: "a",
      type: "hook",
      title: "A",
      gmBrief: "",
      objectives: ["Start the job"],
      exits: [
        { to: "b", label: "go to b", sets: ["key"] },
        { to: "c", label: "locked shortcut", requires: ["key"] },
      ],
    },
    {
      id: "b",
      type: "dev",
      title: "B",
      gmBrief: "",
      objectives: ["Do the thing"],
      exits: [{ to: "c", label: "finish" }],
    },
    { id: "c", type: "resolution", title: "C", gmBrief: "", exits: [] },
  ],
};

describe("startMission", () => {
  it("starts at the start beat with its objectives, active", () => {
    const rt = startMission(demo);
    expect(rt.currentBeatId).toBe("a");
    expect(rt.status).toBe("active");
    expect(rt.completedBeats).toEqual([]);
    expect(rt.objectives).toEqual([{ id: "a.0", text: "Start the job", status: "active" }]);
  });
});

describe("availableExits", () => {
  it("hides exits whose required flags are not yet set", () => {
    const rt = startMission(demo);
    expect(availableExits(demo, rt).map((e) => e.to)).toEqual(["b"]); // c requires "key"
  });
});

describe("advance", () => {
  it("marks the beat completed, sets flags, records the choice, and merges objectives", () => {
    const rt = advance(demo, startMission(demo), "b");
    expect(rt.currentBeatId).toBe("b");
    expect(rt.completedBeats).toEqual(["a"]);
    expect(rt.flags).toContain("key");
    expect(rt.branchChoices).toEqual({ a: "b" });
    expect(rt.objectives.map((o) => o.text)).toEqual(["Start the job", "Do the thing"]);
    expect(rt.status).toBe("active");
  });

  it("completes the mission when moving into a Resolution beat", () => {
    const rt = advance(demo, advance(demo, startMission(demo), "b"), "c");
    expect(rt.currentBeatId).toBe("c");
    expect(rt.status).toBe("completed");
  });

  it("throws when the exit is not currently available", () => {
    expect(() => advance(demo, startMission(demo), "c")).toThrow(/not an available exit/);
  });
});

describe("failMission", () => {
  it("marks the runtime failed", () => {
    expect(failMission(startMission(demo)).status).toBe("failed");
  });
});

describe("getBeat", () => {
  it("throws on an unknown beat id", () => {
    expect(() => getBeat(demo, "nope")).toThrow(/no beat/);
  });
});

describe("mission registry", () => {
  it("resolves A Night at the Opera and rejects unknown ids", () => {
    expect(getMission("night-at-the-opera")).toBe(NIGHT_AT_THE_OPERA);
    expect(listMissions().length).toBeGreaterThan(0);
    expect(() => getMission("nope")).toThrow(/No registered mission/);
  });
});

describe("A Night at the Opera — content integrity", () => {
  const m = NIGHT_AT_THE_OPERA;

  it("has a valid start beat and unique beat ids", () => {
    const ids = m.beats.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(m.startBeatId);
  });

  it("every exit points at an existing beat", () => {
    const ids = new Set(m.beats.map((b) => b.id));
    for (const beat of m.beats) {
      for (const exit of beat.exits) {
        expect(ids.has(exit.to)).toBe(true);
      }
    }
  });

  it("only Resolution beats are dead ends", () => {
    for (const beat of m.beats) {
      if (beat.type === "resolution") expect(beat.exits.length).toBe(0);
      else expect(beat.exits.length).toBeGreaterThan(0);
    }
  });

  it("is playable start-to-finish along the main line", () => {
    let rt = startMission(m);
    const mainLine = [
      "hook",
      "getting_tickets",
      "night_at_opera",
      "noodles_and_info",
      "darkness_and_light",
      "monster_hunt",
      "epilogue",
    ];
    for (const to of mainLine) rt = advance(m, rt, to);
    expect(rt.status).toBe("completed");
    expect(isTerminal(currentBeat(m, rt))).toBe(true);
    expect(rt.completedBeats).toContain("monster_hunt");
  });

  it("supports the optional professor branch shortcutting to the climax", () => {
    let rt = startMission(m);
    rt = advance(m, rt, "hook");
    rt = advance(m, rt, "getting_tickets");
    rt = advance(m, rt, "empty_office_hours");
    expect(rt.flags).toContain("investigated_professor");
    // From the office, the Crew can go straight for Ruthven.
    rt = advance(m, rt, "monster_hunt");
    expect(rt.flags).toContain("knows_ruthven");
    rt = advance(m, rt, "epilogue");
    expect(rt.status).toBe("completed");
  });
});

/**
 * Standing on a beat without playing to it. Only a developer harness does this;
 * the play loop still moves through `advance`.
 */
describe("runtimeAtBeat", () => {
  it("parks on the named beat with that beat's own objectives", () => {
    const runtime = runtimeAtBeat(NIGHT_AT_THE_OPERA, "monster_hunt");
    expect(runtime.currentBeatId).toBe("monster_hunt");
    expect(runtime.missionId).toBe(NIGHT_AT_THE_OPERA.id);
    expect(currentBeat(NIGHT_AT_THE_OPERA, runtime).id).toBe("monster_hunt");
  });

  it("claims no history, because none was played", () => {
    const runtime = runtimeAtBeat(NIGHT_AT_THE_OPERA, "monster_hunt");
    expect(runtime.completedBeats).toEqual([]);
    expect(runtime.branchChoices).toEqual({});
    expect(runtime.flags).toEqual([]);
    expect(runtime.status).toBe("active");
  });

  it("produces a runtime the rest of the engine accepts", () => {
    // The point of going through the engine rather than hand-writing the object:
    // the exits read from it have to be real ones.
    const runtime = runtimeAtBeat(NIGHT_AT_THE_OPERA, "monster_hunt");
    const exits = availableExits(NIGHT_AT_THE_OPERA, runtime);
    expect(exits.length).toBeGreaterThan(0);
    expect(exits.every((e) => typeof e.to === "string")).toBe(true);
  });

  it("throws on a beat the mission does not have", () => {
    expect(() => runtimeAtBeat(NIGHT_AT_THE_OPERA, "not_a_beat")).toThrow();
  });

  it("agrees with startMission when asked for the opening beat", () => {
    expect(runtimeAtBeat(demo, "a")).toEqual(startMission(demo));
  });
});

/**
 * Objectives that can actually close.
 *
 * `MissionObjective.status` was written "active" when a beat was entered and
 * never written again by anything, anywhere. The renderer drew a checkmark that
 * could not appear, and settlement reported "0/N objectives closed" on every job
 * ever finished. These are the tests that stop that being true again.
 */
describe("closing objectives", () => {
  const mission: Mission = {
    id: "test-objectives",
    title: "Test",
    source: "test",
    startBeatId: "start",
    beats: [
      {
        id: "start",
        type: "background",
        title: "Start",
        gmBrief: "",
        objectives: [
          { key: "get_the_thing", text: "Get the thing" },
          { key: "nobody_dies", text: "Nobody dies" },
        ],
        // Separate Resolutions, because advance() identifies an exit by its
        // target: two exits from one beat to the same beat cannot be told apart,
        // which validateMission now rejects outright.
        exits: [
          { to: "clean", label: "Clean", completes: ["get_the_thing", "nobody_dies"] },
          { to: "messy", label: "Messy", completes: ["get_the_thing"], fails: ["nobody_dies"] },
        ],
      },
      { id: "clean", type: "resolution", title: "Clean", gmBrief: "", exits: [] },
      { id: "messy", type: "resolution", title: "Messy", gmBrief: "", exits: [] },
    ],
  };

  function walk(to: string) {
    return advance(mission, startMission(mission), to);
  }

  it("starts every objective active", () => {
    expect(startMission(mission).objectives.map((o) => o.status)).toEqual(["active", "active"]);
  });

  it("completes what the exit completes", () => {
    const done = walk("clean").objectives;
    expect(done.every((o) => o.status === "done")).toBe(true);
  });

  it("fails what the exit fails, in the same move", () => {
    const objectives = walk("messy").objectives;
    expect(objectives.find((o) => o.id === "get_the_thing")?.status).toBe("done");
    expect(objectives.find((o) => o.id === "nobody_dies")?.status).toBe("failed");
  });

  it("identifies a keyed objective by its key, not its position", () => {
    // The whole reason keys exist: "start.0" re-points the moment an objective
    // is inserted above it, silently closing the wrong one.
    expect(startMission(mission).objectives.map((o) => o.id)).toEqual([
      "get_the_thing",
      "nobody_dies",
    ]);
  });

  it("gives an unkeyed objective a positional id, as before", () => {
    const positional: Mission = {
      ...mission,
      beats: [
        {
          ...(mission.beats[0] as Beat),
          objectives: ["Do it"],
          exits: [{ to: "clean", label: "x", completes: ["start.0"] }],
        },
        mission.beats[1] as Beat,
      ],
    };
    expect(startMission(positional).objectives[0]?.id).toBe("start.0");
    expect(validateMission(positional)).toEqual([]);
  });

  it("closes an objective from a beat the player never stood on", () => {
    // The board only ever held what was entered. An exit that fails an
    // objective declared elsewhere must ADD it closed rather than no-op, or the
    // silent zero comes straight back.
    const elsewhere: Mission = {
      ...mission,
      beats: [
        {
          id: "start",
          type: "background",
          title: "Start",
          gmBrief: "",
          exits: [{ to: "end", label: "Go", fails: ["never_seen"] }],
        },
        {
          id: "unvisited",
          type: "dev",
          title: "Unvisited",
          gmBrief: "",
          objectives: [{ key: "never_seen", text: "Never seen" }],
          exits: [{ to: "end", label: "Onward" }],
        },
        { id: "end", type: "resolution", title: "End", gmBrief: "", exits: [] },
      ],
    };
    const runtime = advance(elsewhere, startMission(elsewhere), "end");
    expect(runtime.objectives).toEqual([
      { id: "never_seen", text: "Never seen", status: "failed" },
    ]);
  });

  it("throws on an exit naming an objective the mission does not declare", () => {
    const broken: Mission = {
      ...mission,
      beats: [
        {
          ...(mission.beats[0] as Beat),
          exits: [{ to: "clean", label: "x", completes: ["typo"] }],
        },
        mission.beats[1] as Beat,
      ],
    };
    expect(() => advance(broken, startMission(broken), "clean")).toThrow(/no objective "typo"/);
  });

  it("fails everything still open when the mission fails", () => {
    // A dead Edgerunner does not leave a job with objectives eternally active.
    const partly = walk("messy");
    const dead = failMission({
      ...partly,
      objectives: [...partly.objectives, { id: "extra", text: "Extra", status: "active" }],
    });
    expect(dead.status).toBe("failed");
    expect(dead.objectives.find((o) => o.id === "extra")?.status).toBe("failed");
    // What was already achieved stays achieved.
    expect(dead.objectives.find((o) => o.id === "get_the_thing")?.status).toBe("done");
  });
});

describe("validateMission, on objectives", () => {
  const base: Mission = {
    id: "v",
    title: "V",
    source: "test",
    startBeatId: "start",
    beats: [
      {
        id: "start",
        type: "background",
        title: "Start",
        gmBrief: "",
        objectives: [{ key: "o", text: "O" }],
        exits: [{ to: "end", label: "x", completes: ["o"] }],
      },
      { id: "end", type: "resolution", title: "End", gmBrief: "", exits: [] },
    ],
  };

  it("accepts a mission whose objectives can close", () => {
    expect(validateMission(base)).toEqual([]);
  });

  it("rejects an exit closing an objective no beat declares", () => {
    const broken = structuredClone(base);
    (broken.beats[0] as Beat).exits = [{ to: "end", label: "x", completes: ["o", "ghost"] }];
    expect(validateMission(broken).join("\n")).toMatch(/"ghost", which no beat declares/);
  });

  it("rejects an objective no exit ever closes", () => {
    // The bug this phase exists to fix, stated as a structural rule: an
    // objective nothing can close is an objective that is active forever.
    const broken = structuredClone(base);
    (broken.beats[0] as Beat).exits = [{ to: "end", label: "x" }];
    expect(validateMission(broken).join("\n")).toMatch(/"o" is never completed or failed/);
  });

  it("rejects an exit both completing and failing the same objective", () => {
    const broken = structuredClone(base);
    (broken.beats[0] as Beat).exits = [{ to: "end", label: "x", completes: ["o"], fails: ["o"] }];
    expect(validateMission(broken).join("\n")).toMatch(/both completing and failing/);
  });

  it("rejects two beats declaring the same objective id", () => {
    const broken = structuredClone(base);
    (broken.beats[1] as Beat).objectives = [{ key: "o", text: "Also O" }];
    expect(validateMission(broken).join("\n")).toMatch(/declared more than once/);
  });

  it("rejects two exits from one beat to the same beat", () => {
    // advance() takes a target id, so these are the same move as far as it is
    // concerned and the first always wins — which would quietly close the wrong
    // objectives on the branch nobody can actually reach.
    const broken = structuredClone(base);
    (broken.beats[0] as Beat).exits = [
      { to: "end", label: "Clean", completes: ["o"] },
      { to: "end", label: "Messy", fails: ["o"] },
    ];
    expect(validateMission(broken).join("\n")).toMatch(/more than one exit to "end"/);
  });
});

describe("the offer a mission with no authored offer falls back to", () => {
  it("still asks for the objective in words, not the object holding it", () => {
    // The keyed objective form made `objectives[0]` an object. Read raw, the
    // pitch on the phone would have asked for "[object Object]".
    expect(missionOffer(NIGHT_AT_THE_OPERA).ask).toBe("Recover Lucy Rhinemeyer");
  });
});

describe("a job played end to end", () => {
  it("finishes with its objective closed rather than eternally active", () => {
    // The regression in one test: walk the authored opener from its first beat
    // to its Resolution and count what settlement would count.
    let runtime = startMission(NIGHT_AT_THE_OPERA);
    const seen = new Set<string>();
    while (!isTerminal(currentBeat(NIGHT_AT_THE_OPERA, runtime))) {
      const exits = availableExits(NIGHT_AT_THE_OPERA, runtime);
      const exit = exits[0];
      expect(exit, `no exit from ${runtime.currentBeatId}`).toBeDefined();
      expect(seen.has(runtime.currentBeatId), "walked in a circle").toBe(false);
      seen.add(runtime.currentBeatId);
      runtime = advance(NIGHT_AT_THE_OPERA, runtime, (exit as BeatExit).to);
    }
    expect(runtime.status).toBe("completed");
    expect(runtime.objectives.length).toBeGreaterThan(0);
    const done = runtime.objectives.filter((o) => o.status === "done").length;
    expect(done).toBe(runtime.objectives.length);
  });
});
