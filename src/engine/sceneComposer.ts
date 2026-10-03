/** Bounded cluster placement over semantic parcels. No model calls, free-cell scattering or retries. */
import type { Arena, Point, Rect } from "./battlefield";
import { battlefieldProp, placeProp } from "./battlefieldProps";
import { snapshotBattlefield } from "./battlefieldSnapshot";
import { reachableTiles, tileKey, tileOf } from "./grid";
import type { AuthoredScene, SceneActor } from "./authoredScene";
import { threatFor } from "./threats";
import {
  rectInside,
  rectsOverlap,
  type SceneEnvironment,
  type SceneZone,
  type EnvironmentArt,
  type ZoneKind,
} from "./sceneEnvironment";

type ClusterDefinition = {
  zones: ZoneKind[];
  reason: string;
  members: {
    key: string;
    id: string;
    x: number;
    y: number;
    rotation?: 0 | 90;
    art: EnvironmentArt[];
  }[];
  dressing: { kind: SceneEnvironment["dressing"][number]["kind"]; x: number; y: number }[];
};
/** Offsets describe relationships inside a cluster, never arbitrary world positions. */
const CLUSTERS: Record<string, ClusterDefinition> = {
  parking: {
    zones: ["road"],
    reason: "Vehicles parked in the curb lane outside businesses",
    members: [
      { key: "sedan", id: "car", x: 0, y: 0, rotation: 90, art: ["sedan-engine", "sedan-cabin"] },
    ],
    dressing: [{ kind: "drain", x: 1.8, y: 4.6 }],
  },
  vendor: {
    zones: ["sidewalk"],
    reason: "Food service beside a shop with supplies and waiting space",
    members: [{ key: "food_cart", id: "cart", x: 0, y: 0, art: ["food-cart"] }],
    dressing: [
      { kind: "supplies", x: 0.5, y: -0.6 },
      { kind: "stools", x: 2.8, y: 0.7 },
      { kind: "sign", x: 0.4, y: 2.7 },
      { kind: "litter", x: 0.6, y: 3.2 },
    ],
  },
  service: {
    zones: ["loading", "frontage"],
    reason: "Waste and utilities beside a building's service entrance",
    members: [
      { key: "service_dumpster", id: "bin", x: 0, y: 0, art: ["dumpster"] },
      { key: "service_generator", id: "power", x: 0, y: 4, art: ["generator"] },
    ],
    dressing: [
      { kind: "litter", x: 2.7, y: 0.6 },
      { kind: "supplies", x: 2.6, y: 4.7 },
      { kind: "lamp", x: 0.3, y: 2.8 },
    ],
  },
  loading: {
    zones: ["loading", "frontage"],
    reason: "Delivered freight grouped beside a loading entrance",
    members: [
      { key: "freight_crate", id: "crate", x: 0, y: 0, art: ["cargo"] },
      { key: "freight_pallet", id: "pallet", x: 0, y: 4, art: ["pallet"] },
    ],
    dressing: [
      { kind: "supplies", x: 2.7, y: 1.2 },
      { kind: "litter", x: 2.5, y: 4.8 },
      { kind: "sign", x: 0.3, y: 2.6 },
    ],
  },
  frontage: {
    zones: ["sidewalk", "frontage", "loading"],
    reason: "Street furniture follows the building frontage, leaving the walking lane open",
    members: [],
    dressing: [
      { kind: "lamp", x: 0.4, y: 0.4 },
      { kind: "sign", x: 0.4, y: 2 },
      { kind: "litter", x: 0.7, y: 3.2 },
      { kind: "bollards", x: 1.3, y: 5.2 },
    ],
  },
};
const rect = (x: number, y: number, width: number, height: number): Rect => ({
  x,
  y,
  width,
  height,
});
const zone = (id: string, kind: ZoneKind, r: Rect, axis: "x" | "y" = "y"): SceneZone => ({
  id,
  kind,
  rect: r,
  axis,
});
type Slot = {
  label?: string;
  id: string;
  kind: string;
  zone: string;
  at: Point;
  required?: boolean;
};
function recipe(kind: SceneEnvironment["recipe"]) {
  if (kind === "intersection")
    return {
      zones: [
        zone("street", "road", rect(12, -8, 10, 48)),
        zone("cross-street", "road", rect(-8, 14, 48, 8), "x"),
        zone("junction", "intersection", rect(12, 14, 10, 8)),
        zone("west-walk", "sidewalk", rect(6, 0, 6, 14)),
        zone("east-walk", "sidewalk", rect(22, 0, 4, 14)),
        zone("south-west-walk", "sidewalk", rect(6, 22, 6, 10)),
        zone("south-east-walk", "sidewalk", rect(22, 22, 4, 10)),
        zone("west-service", "frontage", rect(0, 10, 6, 4), "x"),
        zone("south-service", "loading", rect(0, 22, 6, 8)),
        zone("north-crossing", "crosswalk", rect(12, 12, 10, 2), "x"),
        zone("south-crossing", "crosswalk", rect(12, 22, 10, 2), "x"),
      ],
      structures: [
        rect(-8, -8, 14, 18),
        rect(26, -8, 14, 18),
        rect(-8, 30, 14, 12),
        rect(26, 26, 14, 16),
      ],
      slots: [
        {
          id: "thorton",
          label: "Olive-drab Thorton cruiser",
          kind: "parking",
          zone: "street",
          at: { x: 20, y: 2 },
          required: true,
        },
        { id: "curb_north", kind: "parking", zone: "street", at: { x: 20, y: 8 }, required: true },
        { id: "curb_west", kind: "parking", zone: "street", at: { x: 12, y: 2 } },
        { id: "curb_south", kind: "parking", zone: "street", at: { x: 12, y: 26 }, required: true },
        {
          id: "broth_cart",
          label: "Broth cart",
          kind: "vendor",
          zone: "west-walk",
          at: { x: 8, y: 6 },
          required: true,
        },
        { id: "shop_west", kind: "frontage", zone: "west-walk", at: { x: 6, y: 0 } },
        { id: "shop_east", kind: "frontage", zone: "east-walk", at: { x: 24, y: 0 } },
        { id: "shop_south", kind: "frontage", zone: "south-east-walk", at: { x: 24, y: 24 } },
        { id: "workshop_service", kind: "service", zone: "west-service", at: { x: 0, y: 10 } },
        { id: "evening_vendor", kind: "vendor", zone: "south-west-walk", at: { x: 8, y: 24 } },
        { id: "deliveries", kind: "loading", zone: "south-service", at: { x: 2, y: 22 } },
      ] as Slot[],
      player: { x: 17, y: 23 },
      actors: [
        { x: 23, y: 3 },
        { x: 23, y: 9 },
        { x: 9, y: 11 },
        { x: 11, y: 11 },
      ],
    };
  return {
    zones: [
      zone("passage", "alley", rect(8, -8, 16, 48)),
      zone("west-service", "loading", rect(8, 0, 6, 32)),
      zone("east-service", "loading", rect(20, 0, 4, 32)),
    ],
    structures: [
      rect(-8, -8, 16, 22),
      rect(-8, 14, 16, 26),
      rect(24, -8, 16, 26),
      rect(24, 18, 16, 22),
    ],
    slots: [
      {
        id: "delivery_north",
        kind: "loading",
        zone: "west-service",
        at: { x: 8, y: 2 },
        required: true,
      },
      {
        id: "waste_south",
        kind: "service",
        zone: "west-service",
        at: { x: 8, y: 22 },
        required: true,
      },
      {
        id: "service_east",
        kind: "service",
        zone: "east-service",
        at: { x: 20, y: 10 },
        required: true,
      },
      { id: "alley_lights", kind: "frontage", zone: "west-service", at: { x: 8, y: 12 } },
      { id: "delivery_south", kind: "loading", zone: "east-service", at: { x: 20, y: 24 } },
    ] as Slot[],
    player: { x: 17, y: 29 },
    actors: [
      { x: 15, y: 7 },
      { x: 21, y: 9 },
      { x: 13, y: 19 },
      { x: 13, y: 21 },
    ],
  };
}

export function composeScene(kind: SceneEnvironment["recipe"], seed = 1): AuthoredScene {
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295)
    throw new Error("Invalid scene seed.");
  const plan = recipe(kind);
  const cast = [
    {
      id: "rifle_ganger",
      name: "6th Street rifleman",
      side: "hostile" as const,
      profile: { ...threatFor("enforcer") },
    },
    {
      id: "lookout",
      name: "6th Street lookout",
      side: "hostile" as const,
      profile: { ...threatFor("ganger") },
    },
    { id: "worker_one", name: "Maintenance worker", side: "neutral" as const, profile: null },
    { id: "worker_two", name: "Worker with a tool bag", side: "neutral" as const, profile: null },
  ];
  const actors: SceneActor[] = cast.map((a, i) => ({ ...a, position: plan.actors[i]! }));
  const env: SceneEnvironment = {
    version: 1,
    recipe: kind,
    recipeVersion: 1,
    seed,
    zones: plan.zones,
    structures: plan.structures.map((r, i) => ({
      id: `building_${i}`,
      label: kind === "alley" ? "Service building" : "Corner storefront",
      rect: r,
      height: 3 + ((seed + i) % 3),
      style: kind === "alley" ? "warehouse" : i % 2 ? "workshop" : "shop",
      blocksMovement: true,
      blocksShots: true,
    })),
    clusters: [],
    props: [],
    dressing: [],
  };
  const arena: Arena = {
    key: `scene:composed-${kind}:v1:${seed}`,
    label:
      kind === "intersection"
        ? "North Heywood · commercial intersection"
        : "North Heywood · service alley",
    extent: { width: 32, height: 32 },
    playerStart: plan.player,
    hostileSlots: actors.filter((a) => a.side === "hostile").map((a) => a.position),
    cover: [],
    environment: env,
  };
  const reserved = [plan.player, ...plan.actors].map((p) => rect(p.x - 1, p.y - 1, 2, 2));
  const crossings = env.zones
    .filter((z) => z.kind === "crosswalk" || z.kind === "intersection")
    .map((z) => z.rect);
  let randomState = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  };
  for (const slot of plan.slots) {
    const definition = CLUSTERS[slot.kind]!;
    const z = env.zones.find((z) => z.id === slot.zone)!;
    if (!definition.zones.includes(z.kind)) throw new Error(`Illegal cluster zone: ${slot.id}`);
    // Optional service clusters change contents; the required story facts always win.
    const variant =
      !slot.required && random() > 0.5 && ["service", "loading"].includes(slot.kind)
        ? CLUSTERS[slot.kind === "service" ? "loading" : "service"]!
        : definition;
    const entries = variant.members.flatMap((m) => {
      const prop = battlefieldProp(m.key);
      if (!prop) throw new Error(`Missing composition prop ${m.key}`);
      const rotation = z.axis === "x" ? (m.rotation === 90 ? 0 : 90) : (m.rotation ?? 0);
      const at = {
        x: slot.at.x + (z.axis === "x" ? m.y : m.x),
        y: slot.at.y + (z.axis === "x" ? m.x : m.y),
      };
      return placeProp(prop, at, `${slot.id}_${m.id}`, rotation).map((piece, i) => ({
        piece: slot.label ? { ...piece, label: `${slot.label} · ${piece.label}` } : piece,
        art: m.art[i]!,
        rotation,
      }));
    });
    const legal = entries.every(
      ({ piece }) =>
        rectInside(piece.rect, z.rect) &&
        rectInside(piece.rect, rect(0, 0, 32, 32)) &&
        ![
          ...reserved,
          ...crossings,
          ...env.structures.map((s) => s.rect),
          ...arena.cover!.map((c) => c.rect),
        ].some((r) => rectsOverlap(r, piece.rect)),
    );
    if (!legal) {
      if (slot.required) throw new Error(`Required cluster cannot fit: ${slot.id}`);
      continue;
    }
    env.clusters.push({ id: slot.id, kind: slot.kind, zoneId: z.id, reason: variant.reason });
    for (const { piece, art, rotation } of entries) {
      arena.cover!.push(piece);
      env.props.push({ coverId: piece.id, art, rotation, clusterId: slot.id });
    }
    for (const [i, d] of variant.dressing.entries()) {
      const position = {
        x: slot.at.x + (z.axis === "x" ? d.y : d.x),
        y: slot.at.y + (z.axis === "x" ? d.x : d.y),
      };
      if (rectInside({ ...position, width: 0, height: 0 }, z.rect))
        env.dressing.push({
          id: `${slot.id}_detail_${i}`,
          kind: d.kind,
          position,
          clusterId: slot.id,
        });
    }
  }
  const reachable = reachableTiles({
    arena,
    cover: {},
    from: tileOf(arena, arena.playerStart),
    allowance: 1000,
  });
  if (actors.some((a) => !reachable.has(tileKey(tileOf(arena, a.position)))))
    throw new Error("Composed actors are not connected to circulation.");
  return {
    locationKey: "north_heywood",
    template: `composed-${kind}`,
    templateVersion: 1,
    anchor: `composition-${kind}-${seed}`,
    narration:
      kind === "intersection"
        ? "At a North Heywood intersection, parked cars line the curb outside shuttered workshops. A broth vendor has set up beside a corner shop, with stools and supplies tucked against the frontage. Across the crossing, a rifleman stands beside an olive-drab cruiser; his lookout watches farther along the curb. Two maintenance workers linger by the vendor."
        : "You enter a North Heywood service alley between high workshop walls. Loading doors, stacked freight, waste bins and utility equipment line its edges, leaving a clear central passage. A 6th Street rifleman watches from farther up the alley; a lookout stands near the eastern service bay. Two maintenance workers shelter beside a loading entrance.",
    layout: snapshotBattlefield(arena),
    actors,
  };
}
