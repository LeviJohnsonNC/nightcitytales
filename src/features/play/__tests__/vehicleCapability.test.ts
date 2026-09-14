/**
 * A Nomad's vehicle, as the narrator sees it.
 *
 * The narrator cannot offer a getaway, a stakeout from the cab of something, or
 * a lift for a wounded friend without knowing whether there is a machine parked
 * outside — and must not offer any of it when there is not. So the vehicle goes
 * in the capability block beside the weapons and the chrome, which is the one
 * list the prompt is told never to propose outside of.
 */
import { describe, expect, it } from "vitest";
import type { FullCharacter } from "@/lib/backend";
import { buildCapabilitySnapshot, renderCapabilityLines } from "../capabilityModel";

const character = (role: string, rank: number): FullCharacter =>
  ({
    character: { name: "Santiago Cruz", role },
    stats: { body: 6, ref: 6, move: 6, luck: 3 },
    skills: [],
    gear: [],
    roleAbility: { rank },
  }) as unknown as FullCharacter;

const snapshotFor = (full: FullCharacter, roleState: unknown) =>
  buildCapabilitySnapshot({
    character: full,
    vitals: {
      hp_current: 40,
      hp_max: 40,
      wound_state: "none",
      eurobucks: 100,
      luck_current: 3,
    } as never,
    inventory: [],
    cyberware: [],
    roleState,
    encounter: null,
    events: [],
    beatId: null,
  });

describe("the vehicle line", () => {
  it("names what is parked outside for a Nomad", () => {
    const snapshot = snapshotFor(character("nomad", 4), {});
    expect(snapshot.vehicle).not.toBeNull();
    const line = renderCapabilityLines(snapshot).find((l) => l.startsWith("Vehicle:"));
    expect(line).toBeDefined();
    expect(line).toContain(snapshot.vehicle!.name);
    expect(line).toContain("seat");
  });

  it("names the one they chose", () => {
    const snapshot = snapshotFor(character("nomad", 7), { moto: { vehicleId: "helicopter" } });
    expect(snapshot.vehicle?.name).toBe("Helicopter");
  });

  it("falls back rather than naming something their Rank cannot reach", () => {
    const snapshot = snapshotFor(character("nomad", 4), { moto: { vehicleId: "av_9" } });
    expect(snapshot.vehicle).not.toBeNull();
    expect(snapshot.vehicle?.name).not.toBe("AV-9");
  });

  it("says nothing at all for every other Role", () => {
    for (const role of ["solo", "fixer", "media", "tech"]) {
      const snapshot = snapshotFor(character(role, 4), {});
      expect(snapshot.vehicle, role).toBeNull();
      expect(
        renderCapabilityLines(snapshot).some((l) => l.startsWith("Vehicle:")),
        role,
      ).toBe(false);
    }
  });

  it("says nothing when no role state was handed in at all", () => {
    const snapshot = buildCapabilitySnapshot({
      character: character("solo", 4),
      vitals: {
        hp_current: 40,
        hp_max: 40,
        wound_state: "none",
        eurobucks: 0,
        luck_current: 0,
      } as never,
      inventory: [],
      cyberware: [],
      encounter: null,
      events: [],
      beatId: null,
    });
    expect(snapshot.vehicle).toBeNull();
  });
});
