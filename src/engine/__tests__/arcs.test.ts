import { describe, expect, it } from "vitest";
import {
  ARCS,
  ARCS_ARE_HOUSE_RULE,
  ARC_ROLES,
  arcDone,
  arcFor,
  beatsOf,
  currentTell,
  dueArcBeat,
  fillArc,
  freshArcState,
  getArc,
  involve,
  isForkedStage,
  isNpcMove,
  readArcState,
  type ArcPerson,
} from "@/engine";

describe("the arc library", () => {
  it("is a house rule, tuned in data", () => {
    expect(ARCS_ARE_HOUSE_RULE).toBe(true);
  });

  it("gives every role in the standing cast at least two stories", () => {
    for (const role of ARC_ROLES) {
      expect(ARCS.filter((a) => a.roles.includes(role)).length, role).toBeGreaterThanOrEqual(2);
    }
  });

  it("builds every arc the same way: beats, then an ending that forks", () => {
    for (const arc of ARCS) {
      const last = arc.stages[arc.stages.length - 1]!;
      expect(isForkedStage(last), `${arc.id} ends in a fork`).toBe(true);
      for (const stage of arc.stages.slice(0, -1)) {
        expect(isForkedStage(stage), `${arc.id} forks only at the end`).toBe(false);
      }
      expect(new Set(ARCS.map((a) => a.id)).size).toBe(ARCS.length);
    }
  });

  it("only uses moves the world tick already makes", () => {
    for (const arc of ARCS)
      for (const beat of beatsOf(arc)) expect(isNpcMove(beat.move)).toBe(true);
  });

  it("puts every line on the person, and states no number", () => {
    // A number in prose is the engine's, and none of these lines is a number.
    for (const arc of ARCS) {
      for (const beat of beatsOf(arc)) {
        for (const line of [beat.title, beat.brief, beat.tell, beat.reveal ?? "{name}"]) {
          expect(line, `${arc.id}: ${line}`).toContain("{name}");
          expect(line, `${arc.id}: ${line}`).not.toMatch(/\d/);
        }
      }
    }
  });

  it("reveals the truth only in the middle, where getting involved can earn it", () => {
    for (const arc of ARCS) {
      const middle = arc.stages[arc.stages.length - 2]!;
      expect(isForkedStage(middle), arc.id).toBe(false);
      expect(beatsOf({ ...arc, stages: [middle] })[0]!.reveal, arc.id).toBeTruthy();
    }
  });

  it("warms the helped and cools the ignored", () => {
    for (const arc of ARCS) {
      const end = arc.stages[arc.stages.length - 1]!;
      if (!isForkedStage(end)) continue;
      expect(end.involved.disposition!, arc.id).toBeGreaterThan(0);
      expect(end.ignored.disposition!, arc.id).toBeLessThan(0);
    }
  });
});

describe("whose story, and where it is", () => {
  it("gives the same person the same arc in the same campaign", () => {
    expect(arcFor("friend", "c1:kiro")!.id).toBe(arcFor("friend", "c1:kiro")!.id);
    expect(arcFor("friend", "c1:kiro")!.roles).toContain("friend");
  });

  it("reads a stored state back, and refuses one that is not", () => {
    const arc = ARCS[0]!;
    const state = { ...freshArcState(arc), stage: 1, lastDay: 4, learned: ["x"] };
    expect(readArcState(state)).toEqual(state);
    expect(readArcState({ id: "no_such_arc", stage: 0, lastDay: 0 })).toBeNull();
    expect(readArcState(null)).toBeNull();
  });

  it("foreshadows before anything happens, then shows the latest tell", () => {
    const arc = getArc("the_debt")!;
    expect(currentTell(arc, freshArcState(arc))).toBe(arc.foreshadow);
    const fired = dueArcBeat([{ key: "k", name: "Kiro", arc, state: freshArcState(arc) }], 10)!;
    expect(currentTell(arc, fired.next)).toBe(fired.beat.tell);
  });
});

describe("a story, day by day", () => {
  const arc = getArc("the_debt")!;
  const kiro = (state = freshArcState(arc)): ArcPerson => ({
    key: "kiro",
    name: "Kiro",
    arc,
    state,
  });

  it("waits until a stage is due", () => {
    expect(dueArcBeat([kiro()], arc.stages[0]!.after - 1)).toBeNull();
    expect(dueArcBeat([kiro()], arc.stages[0]!.after)).not.toBeNull();
  });

  it("fires one beat a day, however many are due", () => {
    const other = getArc("the_squeeze")!;
    const sable: ArcPerson = {
      key: "sable",
      name: "Sable",
      arc: other,
      state: freshArcState(other),
    };
    const fired = dueArcBeat([kiro(), sable], 30)!;
    expect(fired).not.toBeNull();
    // Both are due; the first stage of the debt is due sooner, so it is further overdue.
    expect(["kiro", "sable"]).toContain(fired.person.key);
  });

  it("walks the stages in order and ends", () => {
    let state = freshArcState(arc);
    let day = 0;
    const titles: string[] = [];
    while (!arcDone(arc, state)) {
      day += 10;
      const fired = dueArcBeat([kiro(state)], day)!;
      titles.push(fillArc(fired.beat.title, "Kiro"));
      state = fired.next;
    }
    expect(titles).toHaveLength(arc.stages.length);
    expect(dueArcBeat([kiro(state)], day + 100)).toBeNull();
  });

  it("learns the truth only by getting involved, and forks the ending on it", () => {
    let state = freshArcState(arc);
    state = dueArcBeat([kiro(state)], 10)!.next; // gone quiet
    state = dueArcBeat([kiro(state)], 20)!.next; // needs money
    expect(state.learned).toEqual([]);

    const helped = involve(arc, state, "Kiro");
    const asked = beatsOf({ ...arc, stages: [arc.stages[1]!] })[0]!;
    expect(helped.learned).toEqual([fillArc(asked.reveal!, "Kiro")]);
    const warm = dueArcBeat([kiro(helped)], 40)!;
    expect(warm.last).toBe(true);
    expect(warm.beat.disposition).toBeGreaterThan(0);
    expect(warm.next.branch).toBe("involved");

    const cold = dueArcBeat([kiro(state)], 40)!;
    expect(cold.beat.disposition).toBeLessThan(0);
    expect(cold.next.branch).toBe("ignored");
    expect(currentTell(arc, cold.next)).toBe(cold.beat.tell);
  });

  it("does not learn the same thing twice", () => {
    let state = freshArcState(arc);
    state = dueArcBeat([kiro(state)], 10)!.next;
    state = dueArcBeat([kiro(state)], 20)!.next;
    const once = involve(arc, state, "Kiro");
    expect(involve(arc, once, "Kiro").learned).toHaveLength(1);
  });

  it("has nothing to involve before the story starts", () => {
    const state = freshArcState(arc);
    expect(involve(arc, state, "Kiro")).toBe(state);
  });
});
