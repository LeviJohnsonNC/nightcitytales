/** Bounded cluster placement over semantic parcels. No model calls, free-cell scattering or retries. */
import type { Arena, Point, Rect } from "./battlefield";
import { placeSceneClusters, type Slot } from "./sceneClusters";
import { snapshotBattlefield } from "./battlefieldSnapshot";
import { reachableTiles, tileKey, tileOf } from "./grid";
import type { AuthoredScene, SceneActor } from "./authoredScene";
import { composeResidential } from "./residentialRecipe";
import { composeInterior } from "./interiorRecipes";
import { threatFor } from "./threats";
import { type SceneEnvironment, type SceneZone, type ZoneKind } from "./sceneEnvironment";

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
  const crossing = [14, 10, 18][variant]!;
  const left = [8, 10, 6][variant]!;
  const right = 32 - left;
  const pocket = [12, 16, 8][variant]!;
  if (kind === "intersection")
    return {
      zones: [
        zone("street", "road", rect(12, -8, 10, 48)),
        zone("cross-street", "road", rect(-8, crossing, 48, 8), "x"),
        zone("junction", "intersection", rect(12, crossing, 10, 8)),
        zone("west-walk", "sidewalk", rect(6, 0, 6, crossing)),
        zone("east-walk", "sidewalk", rect(22, 0, 4, crossing)),
        zone("south-west-walk", "sidewalk", rect(6, crossing + 8, 6, 24 - crossing)),
        zone("south-east-walk", "sidewalk", rect(22, crossing + 8, 4, 24 - crossing)),
        zone("west-service", "frontage", rect(0, crossing - 4, 6, 4), "x"),
        zone("south-service", "loading", rect(0, crossing + 8, 6, 8)),
        zone("north-crossing", "crosswalk", rect(12, crossing - 2, 10, 2), "x"),
        zone("south-crossing", "crosswalk", rect(12, crossing + 8, 10, 2), "x"),
      ],
      structures: [
        rect(-8, -8, 14, crossing + 4),
        rect(26, -8, 14, crossing + 4),
        rect(-8, crossing + 16, 14, 12),
        rect(26, crossing + 12, 14, 16),
      ],
      entrances: [
        { structureId: "building_0", position: { x: 7, y: crossing - 5 } },
        { structureId: "building_1", position: { x: 27, y: crossing - 3 } },
        ...(crossing <= 14 ? [{ structureId: "building_2", position: { x: 7, y: 31 } }] : []),
        { structureId: "building_3", position: { x: 25, y: crossing + 13 } },
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
        {
          id: "curb_north",
          kind: "parking",
          zone: "street",
          at: { x: 20, y: crossing === 10 ? 24 : 8 },
          required: true,
        },
        { id: "curb_west", kind: "parking", zone: "street", at: { x: 12, y: 2 } },
        { id: "curb_south", kind: "parking", zone: "street", at: { x: 12, y: 28 }, required: true },
        {
          id: "broth_cart",
          label: "Broth cart",
          kind: "vendor",
          zone: "west-walk",
          at: { x: 8, y: crossing - 8 },
          required: true,
        },
        { id: "shop_west", kind: "frontage", zone: "west-walk", at: { x: 6, y: 0 } },
        { id: "shop_east", kind: "frontage", zone: "east-walk", at: { x: 24, y: 0 } },
        {
          id: "shop_south",
          kind: "frontage",
          zone: "south-east-walk",
          at: { x: 24, y: crossing + 10 },
        },
        {
          id: "workshop_service",
          kind: "service",
          zone: "west-service",
          at: { x: 0, y: crossing - 4 },
        },
        {
          id: "evening_vendor",
          kind: "vendor",
          zone: "south-west-walk",
          at: { x: 8, y: crossing + 10 },
        },
        { id: "deliveries", kind: "loading", zone: "south-service", at: { x: 2, y: crossing + 8 } },
      ] as Slot[],
      player: { x: 17, y: crossing + 9 },
      actors: [
        { x: 23, y: 3 },
        { x: 23, y: crossing === 10 ? 25 : 9 },
        { x: 9, y: crossing - 3 },
        { x: 11, y: crossing - 3 },
      ],
    };
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
      label: "Closed service entrance",
    })),
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
  placeSceneClusters(arena, plan.slots, reserved, seed);
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
