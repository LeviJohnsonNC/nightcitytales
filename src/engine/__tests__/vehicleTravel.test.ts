/**
 * Getting about in something you own.
 *
 * The property that matters most is the one that is easy to break: a character
 * with no vehicle must be priced EXACTLY as they always were. A Nomad going
 * faster is the feature; everybody else going faster would be a regression
 * nobody would notice for weeks.
 */
import { describe, expect, it } from "vitest";
import {
  DISTRICTS,
  getVehicle,
  resolveTravelIntent,
  travelMinutes,
  travelTrip,
  vehicleTravelRule,
} from "@/engine";

const from = DISTRICTS[0]!.key;
/** Somewhere far enough away that the route crosses the city. */
const to = DISTRICTS[DISTRICTS.length - 1]!.key;
const bike = vehicleTravelRule(getVehicle("roadbike")!);
const av = vehicleTravelRule(getVehicle("av_4")!);

describe("a trip in your own vehicle", () => {
  it("beats the cab the atlas prices by default", () => {
    expect(travelMinutes(from, to, bike)).toBeLessThan(travelMinutes(from, to));
  });

  it("is quicker still in something that does not use the bridges", () => {
    expect(travelMinutes(from, to, av)).toBeLessThan(travelMinutes(from, to, bike));
  });

  it("is recorded under the vehicle's own name, not a mode the atlas owns", () => {
    expect(travelTrip(from, to, bike).mode).toBe("by roadbike");
  });
});

describe("everybody without one", () => {
  it("is priced exactly as before, on every pair of districts", () => {
    for (const district of DISTRICTS.slice(0, 12)) {
      const plain = travelMinutes(from, district.key);
      expect(travelMinutes(from, district.key, undefined), district.name).toBe(plain);
      expect(travelMinutes(from, district.key, null), district.name).toBe(plain);
    }
  });

  it("still walks when a walk is what the atlas was asked for", () => {
    expect(travelMinutes(from, to, "foot")).toBeGreaterThan(travelMinutes(from, to, "cab"));
  });
});

describe("resolveTravelIntent with wheels outside", () => {
  const arrive = (intent: Parameters<typeof resolveTravelIntent>[0]) => {
    const decision = resolveTravelIntent(intent);
    expect(decision.ok).toBe(true);
    return decision as Extract<typeof decision, { ok: true }>;
  };

  it("rides the vehicle for a trip nobody said was a walk", () => {
    const onFoot = arrive({ from, destination: to });
    const driven = arrive({ from, destination: to, vehicle: bike });
    expect(driven.minutes).toBeLessThan(onFoot.minutes);
    expect(driven.mode).toBe("by roadbike");
  });

  it("still walks when the player says they walk", () => {
    const walked = arrive({ from, destination: to, mode: "walk", vehicle: bike });
    expect(walked.mode).toBe("foot");
    expect(walked.minutes).toBe(arrive({ from, destination: to, mode: "walk" }).minutes);
  });

  it("rides it when the player says they drive, which is the same thing", () => {
    expect(arrive({ from, destination: to, mode: "drive", vehicle: bike }).mode).toBe(
      "by roadbike",
    );
  });

  it("changes nothing for a character who has none", () => {
    const decision = arrive({ from, destination: to, vehicle: null });
    expect(decision.minutes).toBe(arrive({ from, destination: to }).minutes);
  });
});
