import { describe, expect, it } from "vitest";
import { roleRankRaiseCost, skillRaiseTotal } from "../advancement";
import { getCyberware } from "../catalog";
import { installQuantity } from "../cyberwareInstall";
import {
  goalKey,
  goalProgress,
  MAX_PINNED_GOALS,
  nextBandFloor,
  reachList,
  withoutPinned,
  withPinned,
  type Goal,
  type GoalState,
} from "../goals";

function state(over: Partial<GoalState> = {}): GoalState {
  return {
    ip: 0,
    eurobucks: 0,
    skills: [{ skillId: "handgun", level: 4, specialization: null }],
    roleId: "solo",
    rank: 4,
    installed: [],
    standings: [],
    ...over,
  };
}

describe("a Skill goal", () => {
  const goal: Goal = { kind: "skill", skillId: "handgun", specialization: null, level: 6 };

  it("costs every Level between here and the target", () => {
    const p = goalProgress(goal, state({ ip: 40 }));
    expect(p.need).toBe(skillRaiseTotal("handgun", 4, 6));
    expect(p.gap).toBe(p.need - 40);
    expect(p).toMatchObject({ currency: "ip", status: "far", label: "Handgun 6" });
  });

  it("is ready once the points cover all of it", () => {
    expect(goalProgress(goal, state({ ip: 1000 })).status).toBe("ready");
  });

  it("is done when the Skill reaches the Level aimed at, not merely the next one", () => {
    const at5 = state({ skills: [{ skillId: "handgun", level: 5, specialization: null }] });
    expect(goalProgress(goal, at5).status).not.toBe("done");
    const at6 = state({ skills: [{ skillId: "handgun", level: 6, specialization: null }] });
    expect(goalProgress(goal, at6)).toMatchObject({ status: "done", gap: 0, need: 0 });
  });
});

describe("a Rank goal", () => {
  it("sums each Rank's printed price", () => {
    const p = goalProgress({ kind: "rank", rank: 6 }, state({ ip: 100 }));
    expect(p.need).toBe(roleRankRaiseCost(5) + roleRankRaiseCost(6));
    expect(p.label).toBe("Combat Awareness Rank 6");
  });
});

describe("a chrome goal", () => {
  it("prices the implant and carries its Humanity cost", () => {
    const p = goalProgress(
      { kind: "chrome", itemId: "cybereye", owned: 0 },
      state({ eurobucks: 40 }),
    );
    expect(p.need).toBe(getCyberware("cybereye").cost * installQuantity("cybereye"));
    expect(p.status).toBe("far");
    expect(p.note).toMatch(/Humanity/);
  });

  it("says what stands in the way when money is not the problem", () => {
    const p = goalProgress(
      { kind: "chrome", itemId: "kerenzikov", owned: 0 },
      state({ eurobucks: 100_000 }),
    );
    expect(p.status).toBe("blocked");
    expect(p.note).toMatch(/Neural Link/i);
  });

  it("is done once one more is installed than when it was pinned", () => {
    const installed = [{ id: "a", itemId: "neural_link", foundationId: null }];
    const goal: Goal = { kind: "chrome", itemId: "neural_link", owned: 0 };
    expect(goalProgress(goal, state({ installed })).status).toBe("done");
    expect(goalProgress({ ...goal, owned: 1 }, state({ installed })).status).not.toBe("done");
  });
});

describe("a standing goal", () => {
  it("climbs to the bottom of the next band and is never 'ready' — standing is earned", () => {
    const floor = nextBandFloor(3)!;
    const goal: Goal = { kind: "standing", factionId: "tyger_claws", atLeast: floor };
    const p = goalProgress(goal, state({ standings: [{ factionId: "tyger_claws", standing: 3 }] }));
    expect(p).toMatchObject({ currency: "standing", gap: floor - 3, status: "far" });
    const there = goalProgress(
      goal,
      state({ standings: [{ factionId: "tyger_claws", standing: floor }] }),
    );
    expect(there.status).toBe("done");
  });

  it("has nowhere further to go at the top band", () => {
    expect(nextBandFloor(10)).toBeNull();
  });
});

describe("reachList", () => {
  it("is one step out in each direction, cheapest first", () => {
    const list = reachList(
      state({
        ip: 0,
        eurobucks: 0,
        skills: [
          { skillId: "handgun", level: 6, specialization: null },
          { skillId: "athletics", level: 2, specialization: null },
          { skillId: "perception", level: 10, specialization: null },
        ],
        standings: [
          { factionId: "tyger_claws", standing: -5 },
          { factionId: "ncpd", standing: 0 },
        ],
      }),
    );
    expect(list.rank?.label).toBe("Combat Awareness Rank 5");
    expect(list.skills.map((s) => s.label)).toEqual(["Athletics 3", "Handgun 7"]);
    expect(list.standing).toHaveLength(1); // nobody with no opinion, nobody at zero
    expect(list.chrome.length).toBeGreaterThan(0);
    expect(list.chrome.every((c) => c.status !== "blocked")).toBe(true);
    for (let i = 1; i < list.chrome.length; i += 1) {
      expect(list.chrome[i]!.need).toBeGreaterThanOrEqual(list.chrome[i - 1]!.need);
    }
  });

  it("does not offer the Rank of an ability that is not built", () => {
    expect(reachList(state({ roleId: "netrunner" })).rank).toBeNull();
  });
});

describe("pinning", () => {
  const a: Goal = { kind: "rank", rank: 5 };
  const b: Goal = { kind: "skill", skillId: "handgun", specialization: null, level: 5 };
  const c: Goal = { kind: "chrome", itemId: "cybereye", owned: 0 };
  const d: Goal = { kind: "standing", factionId: "ncpd", atLeast: 2 };

  it("keeps each goal once and stops at the cap", () => {
    let pins = withPinned([], a);
    pins = withPinned(pins, a);
    expect(pins).toHaveLength(1);
    pins = withPinned(withPinned(pins, b), c);
    expect(pins).toHaveLength(MAX_PINNED_GOALS);
    expect(withPinned(pins, d)).toBe(pins);
  });

  it("unpins by key", () => {
    expect(withoutPinned([a, b], goalKey(a))).toEqual([b]);
  });
});
