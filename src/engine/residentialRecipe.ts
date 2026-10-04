/** Residential frontage organizes doors, setbacks, driveways and parallel curb parking. */
import type { Arena, Point, Rect } from "./battlefield";
import type { AuthoredScene } from "./authoredScene";
import { snapshotBattlefield } from "./battlefieldSnapshot";
import { placeSceneClusters, type Slot } from "./sceneClusters";
import {
  addEntranceSurrounds,
  type SceneEnvironment,
  type SceneZone,
  type ZoneKind,
} from "./sceneEnvironment";
import { reachableTiles, tileKey, tileOf } from "./grid";
import { threatFor } from "./threats";
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
export function composeResidential(seed: number): AuthoredScene {
  const variant = (seed + 2) % 3,
    gap = variant === 1 ? 10 : 8;
  const zones = [
    zone("street", "road", rect(12, -8, 8, 48)),
    zone("west-walk", "sidewalk", rect(8, -8, 4, 48)),
    zone("east-walk", "sidewalk", rect(20, -8, 4, 48)),
    zone("west-drive", "driveway", rect(0, gap, 8, 6), "x"),
    zone("east-drive", "driveway", rect(24, gap + 2, 8, 6), "x"),
    zone("west-garden", "garden", rect(6, 0, 2, gap)),
    zone("east-garden", "garden", rect(24, 0, 2, gap + 2)),
    zone("west-south", "garden", rect(6, gap + 6, 2, 26 - gap)),
    zone("east-south", "garden", rect(24, gap + 8, 2, 24 - gap)),
  ];
  zones.push(
    zone("west-front", "frontage", rect(6, 0, 2, 32)),
    zone("east-front", "frontage", rect(24, 0, 2, 32)),
    zone("west-parking", "parking", rect(12, 22, 2, 8)),
    zone("east-parking", "parking", rect(18, 0, 2, 8)),
    zone("travel-lane", "aisle", rect(14, 0, 4, 32)),
    zone("west-through", "aisle", rect(10, 0, 2, 32)),
    zone("east-through", "aisle", rect(20, 0, 2, 32)),
  );
  const masses = [
    rect(-8, -8, 14, gap + 8),
    rect(-8, gap + 6, 14, 34 - gap),
    rect(26, -8, 14, gap + 10),
    rect(26, gap + 8, 14, 32 - gap),
  ];
  const entrances = [
    { x: 7, y: 3 },
    { x: 7, y: gap + 9 },
    { x: 25, y: 5 },
    { x: 25, y: gap + 11 },
  ];
  const env: SceneEnvironment = {
    version: 1,
    recipe: "residential",
    recipeVersion: 4,
    seed,
    zones,
    structures: masses.map((r, i) => ({
      id: `house_${i}`,
      label: [
        "Attached homes",
        "Setback residential frontage",
        "Apartment entrance wing",
        "Residential block continuing off-map",
      ][i]!,
      rect: r,
      height: [3, 4, 3, 5][i]!,
      style: "residential",
      blocksMovement: true,
      blocksShots: true,
    })),
    entrances: entrances.map((position, i) => ({
      id: `front_door_${i}`,
      structureId: `house_${i}`,
      position,
      label: "Closed residential front door",
    })),
    clusters: [],
    props: [],
    dressing: [],
  };
  // A low attached row and a taller apartment block with an entrance annex
  // share the street without becoming four interchangeable corner buildings.
  const row = env.structures[0]!;
  env.structures.push({
    ...row,
    id: "house_0_neighbor",
    label: "Attached neighbor continuing off-map",
    rect: rect(-8, -8, 14, 8),
    height: 4,
  });
  row.rect = rect(-8, 0, 14, gap);
  const apartment = env.structures[2]!;
  env.structures.push({
    ...apartment,
    id: "house_2_upper",
    label: "Apartment block behind low entrance wing",
    rect: rect(30, -8, 10, gap + 10),
    height: 8,
  });
  apartment.rect = rect(26, -8, 4, gap + 10);
  // Repeated independent arrivals make the low rows legible as households
  // before furniture is present. Preserve the apartment's single shared entry.
  for (const [house, ys] of [
    [0, [7]],
    [1, [gap + 15, gap + 21]],
    [3, [gap + 17, gap + 21]],
  ] as const) {
    for (const [unit, y] of ys.entries()) {
      env.entrances!.push({
        id: `front_door_${house}_unit_${unit + 2}`,
        structureId: `house_${house}`,
        position: { x: house === 3 ? 25 : 7, y },
        label: "Closed residential unit entrance",
      });
    }
  }
  env.entrances!.forEach(({ position: p }, i) =>
    zones.push({
      ...zone(`entry-path-${i}`, "aisle", rect(p.x - 1, p.y - 1, 2, 2), "x"),
      floorUse: "entry",
    }),
  );
  addEntranceSurrounds(env, "entry-surround");
  const actorPoints = [
    { x: 21, y: 3 },
    { x: 11, y: 25 },
    { x: 9, y: gap + 3 },
    { x: 23, y: gap + 5 },
  ];
  const arena: Arena = {
    key: `scene:composed-residential:v1:${seed}`,
    label: `North Heywood · residential street · ${["Setback homes", "Offset driveways", "Cross-axis frontage"][variant]}`,
    extent: { width: 32, height: 32 },
    playerStart: { x: 17, y: 29 },
    hostileSlots: actorPoints.slice(0, 2),
    cover: [],
    environment: env,
  };
  const reserved = [
    arena.playerStart,
    ...actorPoints,
    ...env.entrances!.map((e) => e.position),
  ].map((p) => rect(p.x - 1, p.y - 1, 2, 2));
  reserved.push(...zones.filter((z) => z.kind === "aisle").map((z) => z.rect));
  const slots: Slot[] = [
    {
      id: "parked_north",
      kind: "parking",
      zone: "east-parking",
      at: { x: 18, y: 2 },
      required: true,
    },
    {
      id: "parked_south",
      kind: "parking",
      zone: "west-parking",
      at: { x: 12, y: 24 },
      required: true,
    },
    {
      id: "resident_car",
      kind: "driveway",
      zone: "west-drive",
      at: { x: 2, y: gap },
      required: true,
    },
    {
      id: "visitor_car",
      kind: "driveway",
      zone: "east-drive",
      at: { x: 28, y: gap + 2 },
      required: true,
    },
    {
      id: "home_entry",
      kind: "residential_entry",
      zone: "west-front",
      at: { x: 6, y: gap + 14 },
      required: true,
    },
    {
      id: "apartment_entry",
      kind: "residential_entry",
      zone: "east-front",
      at: { x: 24, y: 6 },
      required: true,
    },
    { id: "plant_sw", kind: "garden", zone: "west-south", at: { x: 6, y: 26 } },
    { id: "plant_se", kind: "garden", zone: "east-south", at: { x: 24, y: 28 } },
    { id: "street_lights", kind: "frontage", zone: "west-walk", at: { x: 10, y: 0 } },
    { id: "street_sign", kind: "frontage", zone: "east-walk", at: { x: 22, y: 24 } },
  ];
  placeSceneClusters(arena, slots, reserved, seed, false);
  const actors = actorPoints.map((position, i) => ({
    id: `street_actor_${i}`,
    name: ["Patrol officer", "Street lookout", "Resident", "Courier"][i]!,
    position,
    side: i < 2 ? ("hostile" as const) : ("neutral" as const),
    profile: i < 2 ? { ...threatFor("ganger") } : null,
  }));
  if (variant === 2) {
    const point = (p: Point) => ({ x: p.y, y: p.x }),
      swap = (r: Rect) => ({ x: r.y, y: r.x, width: r.height, height: r.width });
    arena.playerStart = point(arena.playerStart);
    arena.hostileSlots = arena.hostileSlots.map(point);
    actors.forEach((a) => {
      a.position = point(a.position);
    });
    arena.cover!.forEach((c) => {
      c.rect = swap(c.rect);
    });
    env.zones.forEach((z) => {
      z.rect = swap(z.rect);
      z.axis = z.axis === "x" ? "y" : "x";
    });
    env.structures.forEach((s) => {
      s.rect = swap(s.rect);
      for (const a of s.attachments ?? [])
        a.edge = ({ north: "west", west: "north", east: "south", south: "east" } as const)[a.edge];
    });
    env.entrances!.forEach((e) => {
      e.position = point(e.position);
    });
    env.props.forEach((p) => {
      p.rotation = p.rotation === 0 ? 90 : 0;
    });
    env.dressing.forEach((d) => {
      d.position = point(d.position);
    });
  }
  const reachable = reachableTiles({
    arena,
    cover: {},
    from: tileOf(arena, arena.playerStart),
    allowance: 1000,
  });
  if (actors.some((a) => !reachable.has(tileKey(tileOf(arena, a.position)))))
    throw new Error("Residential actor is unreachable");
  return {
    locationKey: "north_heywood",
    template: "composed-residential",
    templateVersion: 1,
    anchor: `composition-residential-v1-${seed}`,
    narration:
      "Setback homes line a residential street. Front-door paths meet the sidewalks; cars sit in driveways and parallel to the curbs. A resident and courier linger near the houses while a patrol watches the street.",
    layout: snapshotBattlefield(arena),
    actors,
  };
}
