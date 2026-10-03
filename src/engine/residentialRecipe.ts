/** Residential frontage organizes doors, setbacks, driveways and parallel curb parking. */
import type { Arena, Point, Rect } from "./battlefield";
import type { AuthoredScene } from "./authoredScene";
import { snapshotBattlefield } from "./battlefieldSnapshot";
import { placeSceneClusters, type Slot } from "./sceneClusters";
import type { SceneEnvironment, SceneZone, ZoneKind } from "./sceneEnvironment";
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
    zone("west-walk", "sidewalk", rect(8, 0, 4, 32)),
    zone("east-walk", "sidewalk", rect(20, 0, 4, 32)),
    zone("west-drive", "driveway", rect(0, gap, 8, 6), "x"),
    zone("east-drive", "driveway", rect(24, gap + 2, 8, 6), "x"),
    zone("west-garden", "garden", rect(6, 0, 2, gap)),
    zone("east-garden", "garden", rect(24, 0, 2, gap + 2)),
    zone("west-south", "garden", rect(6, gap + 6, 2, 26 - gap)),
    zone("east-south", "garden", rect(24, gap + 8, 2, 24 - gap)),
  ];
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
    recipeVersion: 3,
    seed,
    zones,
    structures: masses.map((r, i) => ({
      id: `house_${i}`,
      label: "Residential building",
      rect: r,
      height: 2 + (i % 2),
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
  const reserved = [arena.playerStart, ...actorPoints, ...entrances].map((p) =>
    rect(p.x - 1, p.y - 1, 2, 2),
  );
  const slots: Slot[] = [
    { id: "parked_north", kind: "parking", zone: "street", at: { x: 18, y: 2 }, required: true },
    { id: "parked_south", kind: "parking", zone: "street", at: { x: 12, y: 24 }, required: true },
    { id: "parked_mid", kind: "parking", zone: "street", at: { x: 18, y: 20 } },
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
    { id: "plant_nw", kind: "garden", zone: "west-garden", at: { x: 6, y: 6 } },
    { id: "plant_ne", kind: "garden", zone: "east-garden", at: { x: 24, y: 0 } },
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
