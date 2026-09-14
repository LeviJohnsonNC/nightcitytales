/**
 * The Family Motorpool.
 *
 * A Nomad's Role Ability had exactly one consequence in this build: Moto Rank
 * rode on Drive and the vehicle Tech Skills. Nothing in the game ever handed
 * them a vehicle, so the bonus applied to a Skill the game rarely asked for, on
 * a machine that did not exist. The Role was a modifier looking for a subject.
 *
 * What is printed, and is parsed here rather than restated:
 *
 *   "Family Motorpool by Rank: 1-4: Compact Groundcar, Gyrocopter, Jetski,
 *    Roadbike; 5-6: Helicopter, High Performance Groundcar, Speedboat; ..."
 *
 * The list and its Rank tiers come out of the Nomad's own mechanicalText in
 * roles.json, the same discipline priceCategory.ts and haggle.ts use on the
 * Tech's and the Fixer's. Only the SPECS are this app's own, and vehicles.json
 * says so beside them.
 *
 * What is deliberately not here: SDP, SP and vehicle combat. Nothing in this
 * build can damage a vehicle, so a durability number would be a field nobody
 * reads and the printed 500eb/one-week Family repair would be a rule nothing
 * can trigger — the exact shape of dead code this pass exists to remove.
 *
 * Pure TypeScript: a Rank in, a motorpool out.
 */
import rolesData from "@/data/rules/roles.json";
import vehicleData from "@/data/rules/vehicles.json";
import type { TravelModeRule } from "./geography";

type RawVehicle = { name: string; kind: string; kmh: number; seats: number };

const FILE = vehicleData as unknown as {
  houseRule: boolean;
  vehicles: Record<string, RawVehicle>;
  travel: { readyMinutes: number; spanMinutes: number; airSpanMinutes: number };
  swap: { arrivesAtHour: number };
};

const NOMAD_TEXT =
  (rolesData as unknown as { roles: Record<string, { roleAbility?: { mechanicalText?: string } }> })
    .roles["nomad"]?.roleAbility?.mechanicalText ?? "";

/** True when the specs are what they claim to be: tunable house rules. */
export const VEHICLE_SPECS_ARE_HOUSE_RULE: boolean = FILE.houseRule;

export type VehicleKind = "land" | "air" | "sea";

export type Vehicle = {
  id: string;
  name: string;
  kind: VehicleKind;
  /** How fast it crosses the map, at the atlas's own scale. */
  kmh: number;
  seats: number;
};

/** The id a printed vehicle name is stored under: "AV-4" is "av_4". */
export function vehicleIdFor(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function vehicleFrom(id: string): Vehicle | null {
  const raw = FILE.vehicles[id];
  if (!raw) return null;
  const kind: VehicleKind = raw.kind === "air" ? "air" : raw.kind === "sea" ? "sea" : "land";
  return { id, name: raw.name, kind, kmh: raw.kmh, seats: raw.seats };
}

/** Every vehicle the specs know, whether or not any Rank reaches it. */
export const VEHICLES: Vehicle[] = Object.keys(FILE.vehicles).flatMap((id) => {
  const vehicle = vehicleFrom(id);
  return vehicle ? [vehicle] : [];
});

export function getVehicle(id: string | null | undefined): Vehicle | null {
  return id ? vehicleFrom(id) : null;
}

// ---------------------------------------------------------------------------
// The motorpool, parsed from the printed list.
// ---------------------------------------------------------------------------

export type MotorpoolTier = {
  /** The lowest Moto Rank this tier opens at. */
  minRank: number;
  vehicleIds: string[];
};

/**
 * The Rank tiers, read out of the Nomad's rules text.
 *
 * The sentence is "Family Motorpool by Rank: 1-4: A, B; 5-6: C, D; ...", with
 * an en dash in the printed ranges. A name the specs file does not know is
 * dropped rather than invented — the parse reports what it found and the tests
 * hold it to finding all of them.
 */
export const MOTORPOOL_TIERS: MotorpoolTier[] = (() => {
  const start = NOMAD_TEXT.indexOf("Family Motorpool by Rank:");
  if (start === -1) return [];
  const tail = NOMAD_TEXT.slice(start + "Family Motorpool by Rank:".length);
  const end = tail.indexOf(".");
  const body = tail.slice(0, end === -1 ? tail.length : end);
  const out: MotorpoolTier[] = [];
  for (const segment of body.split(";")) {
    const match = /^\s*(\d+)(?:\s*[–—-]\s*\d+)?\s*:\s*(.+)$/.exec(segment);
    if (!match) continue;
    const vehicleIds = (match[2] ?? "")
      .split(",")
      .map((name) => vehicleIdFor(name))
      .filter((id) => FILE.vehicles[id] !== undefined);
    if (vehicleIds.length) out.push({ minRank: Number(match[1]), vehicleIds });
  }
  return out.sort((a, b) => a.minRank - b.minRank);
})();

/**
 * Which vehicles a Nomad of this Rank may have out.
 *
 * Cumulative, because the printed rule is that a rising Rank ADDS a vehicle of
 * that Rank or lower to the ones they may use — a Rank 7 Nomad has not lost
 * their Roadbike.
 */
export function motorpoolFor(rank: number): Vehicle[] {
  const value = Math.max(0, Math.trunc(rank));
  const ids = MOTORPOOL_TIERS.filter((tier) => value >= tier.minRank).flatMap((t) => t.vehicleIds);
  return ids.flatMap((id) => {
    const vehicle = vehicleFrom(id);
    return vehicle ? [vehicle] : [];
  });
}

/** True when this Rank may have that particular vehicle out. */
export function canDrive(rank: number, vehicleId: string): boolean {
  return motorpoolFor(rank).some((vehicle) => vehicle.id === vehicleId);
}

// ---------------------------------------------------------------------------
// Getting about in it.
// ---------------------------------------------------------------------------

/**
 * The travel rule a vehicle moves at, shaped like the atlas's own modes.
 *
 * Two things separate it from the cab the travel table already prices: it is
 * waiting where you left it, so there is no wait; and an air vehicle pays
 * nothing to cross a bridge, because it does not use one. That is most of what
 * owning an AV is for, and it falls out of the route the engine already walks.
 */
export function vehicleTravelRule(vehicle: Vehicle): TravelModeRule {
  return {
    label: `by ${vehicle.name.toLowerCase()}`,
    kmh: vehicle.kmh,
    readyMinutes: FILE.travel.readyMinutes,
    spanMinutes: vehicle.kind === "air" ? FILE.travel.airSpanMinutes : FILE.travel.spanMinutes,
  };
}

/** The hour the Family drops off a swapped vehicle: the next morning. */
export const MOTORPOOL_SWAP_HOUR: number = FILE.swap.arrivesAtHour;
