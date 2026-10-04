import type { Arena, Point, Rect } from "./battlefield";
import type { SceneActor } from "./authoredScene";

/** Exchange the compatible northern frontage parcels as whole arrangements.
 * The workshop/utility parcels stay fixed: this changes adjacency, not camera rotation.
 * Both parcels share the same width, approach depth and public sidewalk interface.
 */
export function exchangeNorthFrontages(arena: Arena, actors: SceneActor[]) {
  const env = arena.environment!;
  const boundary = env.zones.find((z) => z.id === "junction")!.rect.y;
  const width = arena.extent.width;
  const point = (p: Point): Point => (p.y < boundary ? { x: width - p.x, y: p.y } : p);
  const northern = (r: Rect) => r.y + r.height <= boundary;
  const rect = (r: Rect): Rect => (northern(r) ? { ...r, x: width - r.x - r.width } : r);
  for (const structure of env.structures) {
    if (!northern(structure.rect)) continue;
    for (const a of structure.attachments ?? []) {
      if (a.edge === "east") a.edge = "west";
      else if (a.edge === "west") a.edge = "east";
      else a.offset = structure.rect.width - a.offset - a.span;
    }
    structure.rect = rect(structure.rect);
  }
  env.zones.forEach((z) => {
    z.rect = rect(z.rect);
  });
  arena.cover!.forEach((c) => {
    c.rect = rect(c.rect);
  });
  env.dressing.forEach((d) => {
    d.position = point(d.position);
  });
  env.entrances!.forEach((e) => {
    e.position = point(e.position);
  });
  actors.forEach((a) => {
    a.position = point(a.position);
  });
  arena.playerStart = point(arena.playerStart);
  arena.hostileSlots = arena.hostileSlots.map(point);
  // Fit the shop to its new corner interface. A west-facing canopy would be
  // hidden by this camera; a recessed north-facing arrival keeps the accepted
  // storefront relationship legible without a renderer exception or extra props.
  const middle = env.structures.find((s) => s.id === "building_0_middle")!;
  middle.rect.x += 8;
  middle.rect.width -= 8;
  const rear = env.structures.find((s) => s.id === "building_0_rear")!;
  rear.rect.x += 8;
  rear.rect.width -= 8;
  const shop = env.structures.find((s) => s.id === "building_0")!;
  shop.attachments![0]!.edge = "north";
  env.entrances!.find((e) => e.structureId === shop.id)!.position = { x: 25, y: 3 };
  env.zones.find((z) => z.id === "shop-customers")!.rect = { x: 24, y: 2, width: 4, height: 2 };
  env.zones.find((z) => z.id === "shop-approach")!.rect = { x: 22, y: 2, width: 6, height: 2 };
  env.zones.find((z) => z.id === "broth_cart_access_0")!.rect = {
    x: 26,
    y: 0,
    width: 2,
    height: 2,
  };
  env.zones.push({
    id: "shop-recess",
    kind: "sidewalk",
    rect: { x: 22, y: -2, width: 6, height: 6 },
    axis: "x",
  });
  env.clusters.find((c) => c.id === "broth_cart")!.zoneId = "shop-recess";
  arena.cover!.find((c) => c.id === "broth_cart_cart_cart")!.rect = {
    x: 24,
    y: 0,
    width: 2,
    height: 2,
  };
  for (const prop of env.props.filter((p) => p.clusterId === "broth_cart")) prop.rotation = 90;
  for (const detail of env.dressing.filter((d) => d.clusterId === "broth_cart")) {
    const old = detail.position;
    // Previous mirrored local coordinates: x = 24 - localX, y = 2 + localY.
    detail.position = { x: 24 + old.y - 2, y: 24 - old.x };
  }
}
