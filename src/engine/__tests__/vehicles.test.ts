/**
 * The Family Motorpool.
 *
 * The Rank tiers are PARSED out of the Nomad's own rules text rather than
 * restated, so the first thing worth testing is that the parse found all of
 * them — a silent parse failure would leave every Nomad on foot and look like a
 * design decision.
 */
import { describe, expect, it } from "vitest";
import rolesData from "@/data/rules/roles.json";
import {
  MOTORPOOL_TIERS,
  VEHICLES,
  VEHICLE_SPECS_ARE_HOUSE_RULE,
  canDrive,
  getVehicle,
  motorpoolFor,
  vehicleIdFor,
  vehicleTravelRule,
} from "../vehicles";

const NOMAD_TEXT =
  (rolesData as unknown as { roles: Record<string, { roleAbility?: { mechanicalText?: string } }> })
    .roles["nomad"]?.roleAbility?.mechanicalText ?? "";

describe("parsing the printed motorpool", () => {
  it("finds all four Rank tiers", () => {
    expect(MOTORPOOL_TIERS.map((t) => t.minRank)).toEqual([1, 5, 7, 9]);
  });

  it("loses no vehicle between the rules text and the specs", () => {
    // Every name the printed list mentions has to resolve to a spec, or a
    // Nomad quietly cannot drive something the book says they can.
    const listed = NOMAD_TEXT.slice(NOMAD_TEXT.indexOf("Family Motorpool by Rank:"))
      .split(".")[0]!
      .split(":")
      .slice(1)
      .flatMap((chunk) => chunk.split(";")[0]!.split(","))
      .map((name) => vehicleIdFor(name))
      .filter((id) => id.length > 0 && !/^\d/.test(id));
    const known = new Set(VEHICLES.map((v) => v.id));
    for (const id of listed) expect([...known], id).toContain(id);
  });

  it("says plainly that the specs are ours and the list is not", () => {
    expect(VEHICLE_SPECS_ARE_HOUSE_RULE).toBe(true);
  });
});

describe("what a Rank reaches", () => {
  it("gives a starting Nomad the first tier and nothing above it", () => {
    const ids = motorpoolFor(4).map((v) => v.id);
    expect(ids).toContain("roadbike");
    expect(ids).not.toContain("helicopter");
  });

  it("accumulates upward — a Rank 7 Nomad has not lost their Roadbike", () => {
    const ids = motorpoolFor(7).map((v) => v.id);
    expect(ids).toContain("roadbike");
    expect(ids).toContain("helicopter");
    expect(ids).toContain("av_4");
    expect(ids).not.toContain("av_9");
  });

  it("reaches everything at Rank 10 and nothing at Rank 0", () => {
    expect(motorpoolFor(10).length).toBe(VEHICLES.length);
    expect(motorpoolFor(0)).toEqual([]);
  });

  it("answers canDrive off the same list", () => {
    expect(canDrive(4, "roadbike")).toBe(true);
    expect(canDrive(4, "av_9")).toBe(false);
    expect(canDrive(10, "av_9")).toBe(true);
    expect(canDrive(10, "hovertank")).toBe(false);
  });
});

describe("vehicleIdFor", () => {
  it("turns a printed name into the id the specs are keyed by", () => {
    expect(vehicleIdFor("AV-4")).toBe("av_4");
    expect(vehicleIdFor(" High Performance Groundcar ")).toBe("high_performance_groundcar");
    expect(vehicleIdFor("Roadbike")).toBe("roadbike");
  });
});

describe("getting about in it", () => {
  it("waits for nothing, because it is parked where you left it", () => {
    const rule = vehicleTravelRule(getVehicle("roadbike")!);
    expect(rule.readyMinutes).toBe(0);
    expect(rule.kmh).toBeGreaterThan(20); // better than the atlas's cab
    expect(rule.label).toBe("by roadbike");
  });

  it("pays nothing to cross a bridge when it does not use one", () => {
    expect(vehicleTravelRule(getVehicle("av_4")!).spanMinutes).toBe(0);
    expect(vehicleTravelRule(getVehicle("roadbike")!).spanMinutes).toBeGreaterThan(0);
  });

  it("has no vehicle that would be slower than walking", () => {
    for (const vehicle of VEHICLES) {
      expect(vehicleTravelRule(vehicle).kmh, vehicle.name).toBeGreaterThan(4.5);
    }
  });
});

describe("getVehicle", () => {
  it("is null for anything the specs do not know", () => {
    expect(getVehicle("hovertank")).toBeNull();
    expect(getVehicle(null)).toBeNull();
    expect(getVehicle(undefined)).toBeNull();
  });
});
