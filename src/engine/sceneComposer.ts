/** Bounded cluster placement over semantic parcels. No model calls, free-cell scattering or retries. */
import type { Arena, Point, Rect } from "./battlefield";
import { placeSceneClusters, type Slot } from "./sceneClusters";
import { snapshotBattlefield } from "./battlefieldSnapshot";
import { reachableTiles, tileKey, tileOf } from "./grid";
import type { AuthoredScene, SceneActor } from "./authoredScene";
import { composeResidential } from "./residentialRecipe";
import { composeInterior } from "./interiorRecipes";
import { threatFor } from "./threats";
import {
  type SceneEnvironment,
  type SceneZone,
  type ZoneKind,
  type SceneStructure,
} from "./sceneEnvironment";

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
function recipe(kind: SceneEnvironment["recipe"], variant: number) {
  const left = [10, 10, 8][variant]!;
  const right = 32 - left;
  const pocket = [12, 16, 8][variant]!;
  if (kind === "intersection") return intersectionPlan(variant);
  return {
    zones: [
      zone("passage", "alley", rect(left, -8, right - left, 48)),
      zone("west-service", "loading", rect(left, 0, 6, 32)),
      zone("east-service", "loading", rect(right - 4, 0, 4, 32)),
      zone("service-court", "frontage", rect(0, pocket, left, 6), "x"),
    ],
    structures: [
      rect(-8, -8, left + 8, pocket + 8),
      rect(-8, pocket + 6, left + 8, 34 - pocket),
      rect(right, -8, 40 - right, 26),
      rect(right, 18, 40 - right, 22),
    ],
    entrances: [
      { structureId: "building_0", position: { x: left + 1, y: 1 } },
      { structureId: "building_1", position: { x: left + 1, y: 23 } },
      { structureId: "building_2", position: { x: right - 1, y: 3 } },
      { structureId: "building_3", position: { x: right - 1, y: 23 } },
    ],
    slots: [
      {
        id: "court_delivery",
        kind: "loading",
        zone: "service-court",
        at: { x: 0, y: pocket + 2 },
        required: true,
      },
      {
        id: "delivery_north",
        kind: "loading",
        zone: "west-service",
        at: { x: left, y: 2 },
        required: true,
      },
      {
        id: "waste_south",
        kind: "service",
        zone: "west-service",
        at: { x: left, y: 24 },
        required: true,
      },
      {
        id: "service_east",
        kind: "service",
        zone: "east-service",
        at: { x: right - 4, y: 12 },
        required: true,
      },
      { id: "alley_lights", kind: "frontage", zone: "west-service", at: { x: left, y: 12 } },
      { id: "delivery_south", kind: "loading", zone: "east-service", at: { x: right - 4, y: 24 } },
    ] as Slot[],
    player: { x: 17, y: 29 },
    actors: [
      { x: left + 7, y: 7 },
      { x: right - 3, y: 9 },
      { x: left + 5, y: 19 },
      { x: left + 5, y: 21 },
    ],
  };
}

/** A compact local street section: 4m travel + two 2m curb lanes,
 * crossing a 6m street. Frontage, through-walks and landings are sized together. */
function intersectionPlan(variant: number) {
  const crossing = [14, 12, 16][variant]!;
  return {
    zones: [
      zone("street", "road", rect(12, -8, 8, 48)),
      zone("cross-street", "road", rect(-8, crossing, 48, 6), "x"),
      zone("junction", "intersection", rect(12, crossing, 8, 6)),
      zone("west-walk", "sidewalk", rect(8, -8, 4, crossing + 8)),
      zone("east-walk", "sidewalk", rect(20, -8, 4, crossing + 8)),
      zone("south-west-walk", "sidewalk", rect(8, crossing + 6, 4, 34 - crossing)),
      zone("south-east-walk", "sidewalk", rect(20, crossing + 6, 4, 34 - crossing)),
      zone("north-west-front", "sidewalk", rect(-8, crossing - 4, 16, 4), "x"),
      zone("north-east-front", "sidewalk", rect(24, crossing - 4, 16, 4), "x"),
      zone("south-west-front", "sidewalk", rect(-8, crossing + 6, 16, 4), "x"),
      zone("south-east-front", "sidewalk", rect(24, crossing + 6, 16, 4), "x"),
      zone("service-court", "loading", rect(2, crossing + 14, 6, 26 - crossing)),
      zone("north-crossing", "crosswalk", rect(12, crossing - 2, 8, 2), "x"),
      zone("south-crossing", "crosswalk", rect(12, crossing + 6, 8, 2), "x"),
      zone("west-crossing", "crosswalk", rect(10, crossing, 2, 6)),
      zone("east-crossing", "crosswalk", rect(20, crossing, 2, 6)),
      // Saved reservations protect the network during every furnishing pass.
      zone("walk-west-north", "aisle", rect(10, -8, 2, crossing + 8)),
      zone("walk-east-north", "aisle", rect(20, -8, 2, crossing + 8)),
      zone("walk-west-south", "aisle", rect(10, crossing + 6, 2, 34 - crossing)),
      zone("walk-east-south", "aisle", rect(20, crossing + 6, 2, 34 - crossing)),
      zone("walk-north", "aisle", rect(-8, crossing - 2, 48, 2), "x"),
      zone("walk-south", "aisle", rect(-8, crossing + 6, 48, 2), "x"),
      zone("travel-lane", "aisle", rect(14, -8, 4, 48)),
      zone("shop-approach", "aisle", rect(8, 6, 4, 2), "x"),
      zone("housing-approach", "aisle", rect(20, 6, 4, 2), "x"),
      zone("workshop-approach", "aisle", rect(6, crossing + 6, 2, 4)),
      zone("utility-approach", "aisle", rect(24, crossing + 6, 2, 4)),
    ],
    structures: [
      rect(-8, -8, 16, crossing + 4),
      rect(24, -8, 16, crossing + 4),
      rect(-8, crossing + 10, 16, 16),
      rect(24, crossing + 10, 16, 16),
    ],
    entrances: [
      { structureId: "building_0", position: { x: 9, y: 7 } },
      { structureId: "building_1", position: { x: 23, y: 7 } },
      { structureId: "building_2", position: { x: 7, y: crossing + 9 } },
      { structureId: "building_3", position: { x: 25, y: crossing + 9 } },
    ],
    slots: [
      {
        id: "thorton",
        label: "Olive-drab Thorton cruiser",
        kind: "parking",
        zone: "street",
        at: { x: 18, y: 2 },
        required: true,
      },
      { id: "curb_north", kind: "parking", zone: "street", at: { x: 18, y: 26 }, required: true },
      { id: "curb_south", kind: "parking", zone: "street", at: { x: 12, y: 26 }, required: true },
      { id: "curb_west", kind: "parking", zone: "street", at: { x: 12, y: 2 } },
      {
        id: "broth_cart",
        label: "Broth cart",
        kind: "vendor",
        zone: "west-walk",
        at: { x: 8, y: 2 },
        required: true,
      },
      { id: "shop_east", kind: "frontage", zone: "east-walk", at: { x: 22, y: 0 } },
      { id: "shop_south", kind: "frontage", zone: "south-east-walk", at: { x: 22, y: 26 } },
      { id: "deliveries", kind: "loading", zone: "service-court", at: { x: 2, y: crossing + 14 } },
    ] as Slot[],
    player: { x: 17, y: crossing + 7 },
    actors: [
      { x: 21, y: 3 },
      { x: 21, y: 27 },
      { x: 9, y: crossing - 1 },
      { x: 11, y: crossing - 1 },
    ],
  };
}

/** Distinct corner programmes: attached shops, housing, loading court and utility frontage. */
function intersectionStructures(footprints: Rect[], seed: number): SceneStructure[] {
  const [shops, housing, loading, utility] = footprints as [Rect, Rect, Rect, Rect];
  const structures: SceneStructure[] = [];
  const add = (
    id: string,
    label: string,
    rect: Rect,
    height: number,
    style: SceneStructure["style"],
  ) => structures.push({ id, label, rect, height, style, blocksMovement: true, blocksShots: true });
  const shopDepth = Math.floor(shops.height / 4) * 2;
  // Attached frontages share a street line, rather than repeating tower + wings.
  add(
    "building_0_rear",
    "Attached retail frontage",
    { ...shops, height: shopDepth },
    6 + (seed % 3),
    "shop",
  );
  add(
    "building_0",
    "Corner shop and vendor frontage",
    { ...shops, y: shops.y + shopDepth, height: shops.height - shopDepth },
    4,
    "shop",
  );
  add(
    "building_1",
    "Apartment frontage above local services",
    housing,
    9 + (seed % 2),
    "residential",
  );
  // A low workshop return encloses a handling court without repeating the shops.
  add(
    "building_2_rear",
    "Workshop entrance beside loading court",
    { ...loading, width: 10 },
    4,
    "workshop",
  );
  add(
    "building_2",
    "Loading court workshop return",
    { x: loading.x + 10, y: loading.y, width: loading.width - 10, height: 4 },
    3,
    "warehouse",
  );
  add(
    "building_3",
    "Low utility service building",
    { ...utility, width: 8, height: 8 },
    3,
    "workshop",
  );
  add(
    "building_3_back",
    "Neighbouring block beyond utility frontage",
    { x: utility.x + 8, y: utility.y + 4, width: utility.width - 8, height: utility.height - 4 },
    7,
    "warehouse",
  );
  return structures;
}

export function composeScene(kind: SceneEnvironment["recipe"], seed = 1): AuthoredScene {
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295)
    throw new Error("Invalid scene seed.");
  if (kind === "residential") return composeResidential(seed);
  if (kind === "office" || kind === "nightclub" || kind === "warehouse" || kind === "garage")
    return composeInterior(kind, seed);
  const variant = (seed + 2) % 3;
  const plan = recipe(kind, variant);
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
    recipeVersion: 2,
    entrances: plan.entrances.map((e, i) => ({
      ...e,
      id: `entrance_${i}`,
      label:
        kind === "intersection"
          ? ["Corner shop entrance", "Apartment entrance", "Workshop entrance", "Utility entrance"][
              i
            ]!
          : "Closed service entrance",
    })),
    seed,
    zones: plan.zones,
    structures:
      kind === "intersection"
        ? intersectionStructures(plan.structures, seed)
        : plan.structures.flatMap((r, i) => {
            // A narrow frontage wing, a rear block and a taller return retain the
            // entrance frontage while varying its architectural mass.
            const wing = 4 + 2 * ((seed + i) % 2);
            const split = Math.max(4, Math.floor(r.height / 4) * 2);
            const pieces = [
              rect(r.x + r.width - wing, r.y, wing, r.height),
              rect(r.x, r.y, r.width - wing, split),
              rect(r.x, r.y + split, r.width - wing, r.height - split),
            ];
            const entrance = plan.entrances.find(
              (e) => e.structureId === `building_${i}`,
            )?.position;
            const entryPart = entrance
              ? pieces.findIndex(
                  (p) =>
                    ((entrance.x === p.x - 1 || entrance.x === p.x + p.width + 1) &&
                      entrance.y > p.y &&
                      entrance.y < p.y + p.height) ||
                    ((entrance.y === p.y - 1 || entrance.y === p.y + p.height + 1) &&
                      entrance.x > p.x &&
                      entrance.x < p.x + p.width),
                )
              : 0;
            // Set back a non-entrance rear wing to make an actual stepped footprint.
            const setback = entryPart === 2 ? 1 : 2;
            pieces[setback] = {
              ...pieces[setback]!,
              x: pieces[setback]!.x + 2,
              width: pieces[setback]!.width - 2,
            };
            return pieces.map((piece, j) => ({
              id: j === entryPart ? `building_${i}` : `building_${i}_wing_${j}`,
              label:
                j === 0
                  ? "Street frontage wing"
                  : j === 1
                    ? "Rear workshop block"
                    : "Upper service block",
              rect: piece,
              height: [3 + (i % 2), 5 + ((seed + i) % 3), 8 + ((seed + i) % 4)][j]!,
              style: (kind === "alley"
                ? j === 0
                  ? "workshop"
                  : "warehouse"
                : (i + j) % 2
                  ? "workshop"
                  : "shop") as "workshop" | "warehouse" | "shop",
              blocksMovement: true,
              blocksShots: true,
            }));
          }),
    clusters: [],
    props: [],
    dressing: [],
  };
  const arena: Arena = {
    key: `scene:composed-${kind}:v2:${seed}`,
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
  const reserved = [plan.player, ...plan.actors, ...plan.entrances.map((e) => e.position)].map(
    (p) => rect(p.x - 1, p.y - 1, 2, 2),
  );
  reserved.push(...env.zones.filter((z) => z.kind === "aisle").map((z) => z.rect));
  placeSceneClusters(arena, plan.slots, reserved, seed);
  const details: Slot[] = [];
  for (const z of env.zones.filter((z) => ["sidewalk", "frontage", "loading"].includes(z.kind))) {
    const candidates: Point[] = [];
    for (let y = Math.max(0, z.rect.y); y < Math.min(32, z.rect.y + z.rect.height) - 2; y += 4)
      for (let x = Math.max(0, z.rect.x); x < Math.min(32, z.rect.x + z.rect.width); x += 2)
        candidates.push({ x, y });
    if (!candidates.length) continue;
    for (let i = 0; i < 3; i++)
      details.push({
        id: `${z.id}_infill_${i}`,
        kind: z.kind === "sidewalk" ? "garden" : "supplies",
        zone: z.id,
        at: candidates[0]!,
        candidates,
      });
  }
  // Keep a continuous two-metre walking lane along each pavement.
  const walkingLanes = env.zones
    .filter((z) => z.kind === "sidewalk")
    .map((z) =>
      rect(z.rect.x + (z.rect.x < 12 ? z.rect.width - 2 : 0), z.rect.y, 2, z.rect.height),
    );
  placeSceneClusters(arena, details, [...reserved, ...walkingLanes], seed, false);
  // A third orientation uses the same saved geometry and renderer, including prop sections.
  if (variant === 2) {
    const swapPoint = (p: Point) => ({ x: p.y, y: p.x });
    const swapRect = (r: Rect) => ({ x: r.y, y: r.x, width: r.height, height: r.width });
    arena.playerStart = swapPoint(arena.playerStart);
    arena.hostileSlots = arena.hostileSlots.map(swapPoint);
    actors.forEach((a) => {
      a.position = swapPoint(a.position);
    });
    arena.cover!.forEach((c) => {
      c.rect = swapRect(c.rect);
    });
    env.zones.forEach((z) => {
      z.rect = swapRect(z.rect);
      z.axis = z.axis === "x" ? "y" : "x";
    });
    env.structures.forEach((s) => {
      s.rect = swapRect(s.rect);
    });
    env.props.forEach((p) => {
      p.rotation = p.rotation === 0 ? 90 : 0;
    });
    env.dressing.forEach((d) => {
      d.position = swapPoint(d.position);
    });
    env.entrances!.forEach((e) => {
      e.position = swapPoint(e.position);
    });
  }
  const reachable = reachableTiles({
    arena,
    cover: {},
    from: tileOf(arena, arena.playerStart),
    allowance: 1000,
  });
  if (
    [...actors, ...env.entrances!].some((a) => !reachable.has(tileKey(tileOf(arena, a.position))))
  )
    throw new Error("Composed actors are not connected to circulation.");
  return {
    locationKey: "north_heywood",
    template: `composed-${kind}`,
    templateVersion: 2,
    anchor: `composition-${kind}-v2-${seed}`,
    narration:
      kind === "intersection"
        ? "At a North Heywood intersection, parked cars line the curb outside shuttered workshops. A broth vendor has set up beside a corner shop, with stools and supplies tucked against the frontage. Across the crossing, a rifleman stands beside an olive-drab cruiser; his lookout watches farther along the curb. Two maintenance workers linger by the vendor."
        : "You enter a North Heywood service alley between high workshop walls. Loading doors, stacked freight, waste bins and utility equipment line its edges, leaving a clear central passage. A 6th Street rifleman watches from farther up the alley; a lookout stands near the service bay. Two maintenance workers shelter beside a loading entrance.",
    layout: snapshotBattlefield(arena),
    actors,
  };
}
