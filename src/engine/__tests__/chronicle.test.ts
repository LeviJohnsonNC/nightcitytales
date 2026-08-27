import { describe, expect, it } from "vitest";
import {
  CHRONICLE_MAX_LINES,
  CHRONICLE_MIN_DAYS,
  chronicle,
  hasChronicle,
  type ChronicleInput,
} from "../chronicle";
import type { FactionStanding } from "../factions";

function input(over: Partial<ChronicleInput> = {}): ChronicleInput {
  return {
    day: 20,
    jobsTaken: 0,
    jobsFinished: 0,
    jobsDeclined: 0,
    bodies: 0,
    standings: [],
    pressure: [],
    people: [],
    stillLooking: [],
    ...over,
  };
}

const standing = (factionId: string, value: number): FactionStanding =>
  ({ factionId, standing: value }) as FactionStanding;

const text = (over: Partial<ChronicleInput> = {}) => chronicle(input(over)).join("\n");

describe("a campaign that has not happened yet", () => {
  it("says nothing on day one with no work taken", () => {
    expect(chronicle(input({ day: 1 }))).toEqual([]);
    expect(hasChronicle(input({ day: 1 }))).toBe(false);
  });

  it("starts talking once there is a campaign to talk about", () => {
    expect(chronicle(input({ day: CHRONICLE_MIN_DAYS }))).not.toEqual([]);
    expect(chronicle(input({ day: 1, jobsTaken: 1 }))).not.toEqual([]);
  });
});

describe("the work", () => {
  it("counts jobs taken and finished", () => {
    expect(text({ jobsTaken: 6, jobsFinished: 4 })).toContain("6 jobs taken, 4 finished");
  });

  it("names what was left unfinished", () => {
    expect(text({ jobsTaken: 6, jobsFinished: 4 })).toContain("2 left unfinished");
  });

  it("says nothing about unfinished work when there is none", () => {
    expect(text({ jobsTaken: 4, jobsFinished: 4 })).not.toContain("unfinished");
  });

  it("says so plainly when no work has been taken", () => {
    expect(text({ day: 9 })).toContain("no work taken yet");
  });

  it("counts what was turned down", () => {
    expect(text({ jobsTaken: 1, jobsDeclined: 3 })).toContain("3 offers turned down");
    expect(text({ jobsTaken: 1, jobsDeclined: 1 })).toContain("1 offer turned down");
  });

  it("counts the dead", () => {
    expect(text({ jobsTaken: 2, bodies: 11 })).toContain("11 people died");
    expect(text({ jobsTaken: 2, bodies: 1 })).toContain("1 person died");
  });

  it("says nothing about bodies when nobody died", () => {
    expect(text({ jobsTaken: 2 })).not.toContain("died");
  });
});

describe("who has an opinion", () => {
  it("names a faction and where it stands", () => {
    expect(text({ standings: [standing("militech", -6)] })).toMatch(/Militech: .*\(-6\)/);
  });

  it("leads with whoever feels most strongly", () => {
    const lines = chronicle(
      input({ standings: [standing("tyger_claws", -2), standing("militech", -8)] }),
    );
    const militech = lines.findIndex((l) => l.startsWith("Militech"));
    const claws = lines.findIndex((l) => l.startsWith("Tyger Claws"));
    expect(militech).toBeLessThan(claws);
  });

  it("leaves out anybody with no opinion", () => {
    expect(text({ standings: [standing("arasaka", 0)] })).not.toContain("Arasaka");
  });

  it("does not list every faction in Night City", () => {
    const many = [
      standing("militech", -9),
      standing("arasaka", -8),
      standing("tyger_claws", -7),
      standing("maelstrom", -6),
      standing("valentinos", -5),
      standing("sixth_street", -4),
    ];
    const named = chronicle(input({ standings: many })).filter((l) => /\(-\d+\)/.test(l));
    expect(named.length).toBeLessThanOrEqual(4);
  });

  it("ignores a standing for something that is not a faction", () => {
    expect(() => chronicle(input({ standings: [standing("the_moon", -5)] }))).not.toThrow();
    expect(text({ standings: [standing("the_moon", -5)] })).not.toContain("the_moon");
  });
});

describe("the people", () => {
  const person = (name: string, disposition: number, jobsBrought?: number) => ({
    name,
    disposition,
    ...(jobsBrought === undefined ? {} : { jobsBrought }),
  });

  it("names who keeps bringing the work", () => {
    const line = text({ jobsTaken: 6, people: [person("Kiro", 2, 4), person("Nix", 0, 1)] });
    expect(line).toContain("Kiro has brought 4 jobs");
  });

  it("names only the busiest broker, not everyone who ever called", () => {
    const lines = chronicle(
      input({ jobsTaken: 6, people: [person("Kiro", 2, 4), person("Nix", 0, 2)] }),
    ).filter((l) => l.includes("has brought"));
    expect(lines).toHaveLength(1);
  });

  it("says who the character is close to, and who cannot stand them", () => {
    const line = text({ people: [person("Kiro", 3), person("Vex", -3), person("Nix", 0)] });
    expect(line).toContain("Close to the character: Kiro");
    expect(line).toContain("Wants nothing to do with them: Vex");
    expect(line).not.toContain("Nix");
  });

  it("names anybody still owed a reckoning", () => {
    expect(text({ stillLooking: ["Vex", "Royce"] })).toContain("Vex, Royce");
  });

  it("says nothing about people when the campaign knows none", () => {
    const line = text({ jobsTaken: 1 });
    expect(line).not.toContain("Close to");
    expect(line).not.toContain("has brought");
  });
});

describe("the dials", () => {
  it("carries the pressure lines the engine already worded", () => {
    expect(text({ pressure: ["Militech Investigation: 4/6", "NCPD Heat: 3/8"] })).toContain(
      "Militech Investigation: 4/6",
    );
  });

  it("does not print a wall of clocks", () => {
    const many = Array.from({ length: 9 }, (_, i) => `Clock ${i}: 1/6`);
    const shown = chronicle(input({ pressure: many })).filter((l) => l.startsWith("Clock"));
    expect(shown.length).toBeLessThanOrEqual(4);
  });
});

describe("the shape of the whole thing", () => {
  it("stays short enough to sit in a prompt", () => {
    const busy = input({
      day: 60,
      jobsTaken: 12,
      jobsFinished: 9,
      jobsDeclined: 5,
      bodies: 30,
      standings: [
        standing("militech", -9),
        standing("arasaka", -8),
        standing("tyger_claws", 4),
        standing("maelstrom", -6),
        standing("ncpd", -3),
      ],
      pressure: ["A: 1/6", "B: 2/6", "C: 3/6", "D: 4/6", "E: 5/6"],
      people: [
        { name: "Kiro", disposition: 3, jobsBrought: 7 },
        { name: "Vex", disposition: -3 },
      ],
      stillLooking: ["Royce"],
    });
    const lines = chronicle(busy);
    expect(lines.length).toBeGreaterThan(5);
    expect(lines.length).toBeLessThanOrEqual(CHRONICLE_MAX_LINES);
    for (const line of lines) expect(line.length).toBeLessThan(200);
  });

  it("never grows past its ceiling, however long the campaign runs", () => {
    const enormous = input({
      day: 400,
      jobsTaken: 90,
      jobsFinished: 80,
      jobsDeclined: 40,
      bodies: 300,
      standings: Array.from({ length: 11 }, (_, i) => standing("militech", -(i + 1))),
      pressure: Array.from({ length: 20 }, (_, i) => `Clock ${i}: 5/6`),
      people: Array.from({ length: 30 }, (_, i) => ({
        name: `Person ${i}`,
        disposition: i % 2 ? 3 : -3,
        jobsBrought: i,
      })),
      stillLooking: Array.from({ length: 12 }, (_, i) => `Survivor ${i}`),
    });
    expect(chronicle(enormous).length).toBeLessThanOrEqual(CHRONICLE_MAX_LINES);
  });

  it("is deterministic — the same state always reads the same", () => {
    const state = input({ jobsTaken: 3, standings: [standing("militech", -4)] });
    expect(chronicle(state)).toEqual(chronicle(state));
  });

  it("survives nonsense without throwing", () => {
    expect(() =>
      chronicle(input({ day: -5, jobsTaken: -1, jobsFinished: 99, bodies: -3 })),
    ).not.toThrow();
  });
});
