import { describe, expect, it } from "vitest";
import {
  advance,
  availableExits,
  currentBeat,
  failMission,
  getBeat,
  isTerminal,
  runtimeAtBeat,
  startMission,
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
