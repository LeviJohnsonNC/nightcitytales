import { describe, expect, it } from "vitest";
import {
  appointmentDelayDays,
  atPractice,
  practicePlaces,
  planCyberwareInstall,
  planCyberwarePlacement,
  rollHumanityLoss,
  type InstalledCyberware,
} from "../cyberwareInstall";

const eye = (id: string): InstalledCyberware => ({ id, itemId: "cybereye", foundationId: null });

describe("cyberware installation", () => {
  it("places a paired option into two different foundations", () => {
    const result = planCyberwarePlacement([eye("left"), eye("right")], "anti_dazzle");
    expect(result).toEqual({
      ok: true,
      placements: [{ foundationId: "left" }, { foundationId: "right" }],
    });
  });

  it("refuses a paired option when only one foundation exists", () => {
    const result = planCyberwarePlacement([eye("left")], "anti_dazzle");
    expect(result.ok).toBe(false);
  });

  it("counts existing Option Slots on a particular foundation", () => {
    const installed: InstalledCyberware[] = [
      { id: "link", itemId: "neural_link", foundationId: null },
      { id: "socket", itemId: "chipware_socket", foundationId: "link" },
      { id: "plugs", itemId: "interface_plugs", foundationId: "link" },
    ];
    const result = planCyberwarePlacement(installed, "kerenzikov", 1);
    expect(result).toEqual({ ok: true, placements: [{ foundationId: "link" }] });
  });

  it("enforces the one-speedware rule", () => {
    const installed: InstalledCyberware[] = [
      { id: "link", itemId: "neural_link", foundationId: null },
      { id: "speed", itemId: "kerenzikov", foundationId: "link" },
    ];
    expect(planCyberwarePlacement(installed, "sandevistan", 1)).toEqual({
      ok: false,
      reason: "Only one speedware system can be installed at a time.",
    });
  });

  it("rolls half a d6 rounded up", () => {
    expect(rollHumanityLoss("1d6/2", () => 0.66)).toEqual({
      expression: "1d6/2",
      rolls: [4],
      divisor: 2,
      total: 2,
    });
  });

  it("uses disposition for access rather than price", () => {
    expect(appointmentDelayDays(-3)).toBeNull();
    expect(appointmentDelayDays(-1)).toBe(2);
    expect(appointmentDelayDays(0)).toBe(1);
    expect(appointmentDelayDays(1)).toBe(0);
  });

  it("plans money, Humanity, surgery, recovery, and a pending hook together", () => {
    const plan = planCyberwareInstall({
      installed: [],
      itemId: "cyberarm",
      humanityCurrent: 50,
      eurobucks: 500,
      disposition: 1,
      phase: "hook",
      clock: { day: 4, minute: 600 },
      rng: () => 0,
    });
    expect(plan.cost).toBe(500);
    expect(plan.humanity.humanityCurrent).toBe(48);
    expect(plan.procedureMinutes).toBe(240);
    expect(plan.recoveryDays).toBe(3);
    expect(plan.clockAfter).toEqual({ day: 7, minute: 840 });
    expect(plan.passesHook).toBe(true);
  });
});

describe("where chrome goes in", () => {
  it("is only at a place the ripperdoc works out of", () => {
    expect(atPractice(["i3", "j5"], "i3")).toBe(true);
    expect(atPractice(["i3", "j5"], "a1")).toBe(false);
    expect(atPractice(["i3"], null)).toBe(false);
  });

  it("recognises the place when the character is standing at a spot in it", () => {
    expect(atPractice(["i3"], "i3@12.5,40")).toBe(true);
  });

  it("never locks anybody out when the atlas found the ripperdoc nowhere", () => {
    expect(atPractice([], "a1")).toBe(true);
    expect(atPractice([], null)).toBe(true);
  });

  it("lists the places nearest first, priced as the atlas prices the trip", () => {
    const places = practicePlaces(["j5", "i3", "t8"], "i3");
    expect(places.map((p) => p.placeKey)[0]).toBe("i3");
    expect(places[0]!.minutes).toBe(0);
    for (let i = 1; i < places.length; i++) {
      expect(places[i]!.minutes).toBeGreaterThanOrEqual(places[i - 1]!.minutes);
    }
    expect(places.find((p) => p.placeKey === "i3")!.name).toBe("Savage Docs");
  });
});
