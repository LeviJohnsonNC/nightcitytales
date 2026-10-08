import type { Arena, Point, Rect } from "./battlefield";
import type { SceneActor } from "./authoredScene";
import type { SceneEnvironment } from "./sceneEnvironment";
import { placeSceneClusters } from "./sceneClusters";

/** Recipe 11 proof, seed 8 only: remove two empty metres from each street's
 * centre, translating whole frontages rather than scaling buildings or props.
 * Consolidate parking on the east curb to retain a four-metre vehicle lane.
 * This edits a newly composed arena only; snapshot readers never call it. */
export function compactIntersectionPrototype(arena: Arena, actors: SceneActor[]) {
  const env = arena.environment!;
  const junction = env.zones.find((z) => z.id === "junction")!;
  if (junction.rect.width === 6) return;
  if (env.seed !== 8 || junction.rect.width !== 8 || junction.rect.height !== 6)
    throw new Error("Compact intersection prototype requires the seed-8 street plan.");
  const cut = (v: number, start: number) => (v <= start ? v : v >= start + 2 ? v - 2 : start);
  const point = (p: Point): Point => ({ x: cut(p.x, 14), y: cut(p.y, 16) });
  const rect = (r: Rect): Rect => {
    const a = point(r),
      b = point({ x: r.x + r.width, y: r.y + r.height });
    return { ...a, width: b.x - a.x, height: b.y - a.y };
  };
  env.zones.forEach((z) => {
    z.rect = rect(z.rect);
  });
  env.structures.forEach((s) => {
    s.rect = rect(s.rect);
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

  for (const [id, dx, dy] of [
    ["curb_west", 4, 0],
    ["curb_south", 4, 4],
  ] as const) {
    for (const prop of env.props.filter((p) => p.clusterId === id)) {
      const piece = arena.cover!.find((c) => c.id === prop.coverId)!;
      piece.rect.x += dx;
      piece.rect.y += dy;
    }
    for (const d of env.dressing.filter((d) => d.clusterId === id)) {
      d.position.x += dx;
      d.position.y += dy;
    }
  }
  const lane = env.zones.find((z) => z.id === "travel-lane")!;
  lane.rect.x = 12;
  lane.rect.width = 4;
}

/** Saved street-level market rows, placed through the same collision and access
 * checks as the original vendor. Existing scenes are never regenerated. */
export function addPavementMarkets(arena: Arena, actors: readonly SceneActor[]) {
  const env = arena.environment!;
  if (env.clusters.some((c) => c.id.startsWith("street_market_"))) return;
  const junction = env.zones.find((z) => z.id === "junction")!.rect;
  const reserved = [
    ...env.zones.filter((z) => z.kind === "aisle").map((z) => z.rect),
    ...[
      ...actors.map((a) => a.position),
      arena.playerStart,
      ...(env.entrances ?? []).map((e) => e.position),
    ].map((p) => ({ x: p.x - 1, y: p.y - 1, width: 2, height: 2 })),
    ...env.dressing
      .filter((d) => d.kind === "lamp")
      .map(({ position: p }) => ({ x: p.x - 0.25, y: p.y - 0.25, width: 0.5, height: 0.5 })),
  ];
  for (const zoneId of ["west-walk", "south-east-front"]) {
    const zone = env.zones.find((z) => z.id === zoneId)!;
    const candidates: Point[] = [];
    for (
      let y = Math.max(0, zone.rect.y);
      y + 2 <= Math.min(32, zone.rect.y + zone.rect.height);
      y += 2
    )
      for (
        let x = Math.max(0, zone.rect.x);
        x + 2 <= Math.min(32, zone.rect.x + zone.rect.width);
        x += 2
      )
        candidates.push({ x, y });
    const distance = (p: Point) =>
      Math.hypot(
        p.x + 1 - (junction.x + junction.width / 2),
        p.y + 1 - (junction.y + junction.height / 2),
      );
    candidates.sort((a, b) => distance(a) - distance(b) || a.y - b.y || a.x - b.x);
    // The shop walk faces east (or south after transpose); the repair row
    // uses its forecourt's horizontal axis. Shared browsing space may coincide
    // with the public lane, but solid counters may never occupy it.
    for (let i = 0; i < 2; i++) {
      if (!candidates.length) continue;
      const reverse =
        zoneId === "west-walk" &&
        (zone.axis === "y" ? zone.rect.x > junction.x : zone.rect.y > junction.y);
      placeSceneClusters(
        arena,
        [
          {
            id: `street_market_${zoneId}_${i}`,
            kind: reverse ? "pavement_market_return" : "pavement_market",
            zone: zoneId,
            axis: zone.axis,
            at: candidates[0]!,
            candidates,
          },
        ],
        reserved,
        env.seed,
        false,
      );
    }
  }
}

/** Revision 9: a low repair frontage with two stepped, occupied blocks behind it.
 * Partition the existing footprint exactly. No new sidewalk obstacle, entrance or
 * playable upper floor; the normal facade, lighting and cutaway systems own it.
 * Called only for newly composed scenes, after their orientation is final.
 */
export function addRepairLofts(env: SceneEnvironment) {
  const front = env.structures.find((s) => s.id === "building_3");
  if (!front || env.structures.some((s) => s.id === "building_3_loft_a")) return;
  const edge = front.attachments?.find((a) => a.id === "retail-header")?.edge;
  if (edge !== "north" && edge !== "west") return;
  const r = { ...front.rect };
  const length = edge === "north" ? r.width : r.height;
  const depth = edge === "north" ? r.height : r.width;
  if (length < 12 || depth < 8) return;
  const apron = 4;
  const split = Math.floor(length / 4) * 2;
  front.rect = edge === "north" ? { ...r, height: apron } : { ...r, width: apron };
  for (const [suffix, start, span, height] of [
    ["a", 0, split, 7.2],
    ["b", split, length - split, 10.2],
  ] as const) {
    env.structures.push({
      id: `building_3_loft_${suffix}`,
      label:
        suffix === "a"
          ? "Repair-row studios behind the low frontage"
          : "Stepped repair-row rooms and offices",
      rect:
        edge === "north"
          ? { x: r.x + start, y: r.y + apron, width: span, height: depth - apron }
          : { x: r.x + apron, y: r.y + start, width: depth - apron, height: span },
      height,
      style: "shop",
      blocksMovement: true,
      blocksShots: true,
    });
  }
}

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

const LAMP_REASON =
  "A streetlight stands at the shop's corner, lighting its frontage and the pavement beside it";

/** A point `s` metres along a structure's face from its first corner and `out`
 * metres away from the wall (negative: alongside the wall, behind the face line). */
function facePoint(r: Rect, edge: "north" | "east" | "south" | "west", s: number, out: number) {
  switch (edge) {
    case "north":
      return { x: r.x + s, y: r.y - out };
    case "south":
      return { x: r.x + s, y: r.y + r.height + out };
    case "west":
      return { x: r.x - out, y: r.y + s };
    case "east":
      return { x: r.x + r.width + out, y: r.y + s };
  }
}

/**
 * Recipe revision 7: one saved lamp at the shop's corner, so the storefront has a
 * light source in the scene rather than one invented by the renderer.
 *
 * Lamps were only ever saved where a frontage cluster put one, and none of them
 * stood near the corner shop. This reads the FINAL geometry (after the program
 * exchange and any quarter turn), finds the shop by its awning, and tries the
 * pavement at either end of the awning and past either corner of the facade, in
 * that order, taking the first point that is on a sidewalk, clear of every
 * reservation, structure, prop, entrance and actor. It is dressing: nonblocking,
 * saved, and a lamp's light comes from where it stands.
 *
 * Returns whether a lamp was placed; a scene with no legal point simply has none.
 */
export function addShopLamp(arena: Arena, actors: readonly SceneActor[]): boolean {
  const env = arena.environment!;
  const shop = env.structures.find((s) => s.attachments?.some((a) => a.id === "shop-canopy"));
  if (!shop) return false;
  const awning = shop.attachments!.find((a) => a.id === "shop-canopy")!;
  const length =
    awning.edge === "north" || awning.edge === "south" ? shop.rect.width : shop.rect.height;
  const along = [
    // beside the awning's two ends, then past the facade's two ends
    [awning.offset + awning.span + 0.6, 0.5],
    [awning.offset - 0.6, 0.5],
    [-0.6, -0.5],
    [length + 0.6, -0.5],
    [awning.offset + awning.span + 0.6, 1.2],
    [awning.offset - 0.6, 1.2],
  ] as const;
  const inside = (p: Point, r: Rect, margin = 0) =>
    p.x > r.x - margin &&
    p.x < r.x + r.width + margin &&
    p.y > r.y - margin &&
    p.y < r.y + r.height + margin;
  const keepClear: Point[] = [
    ...env.entrances!.map((e) => e.position),
    ...actors.map((a) => a.position),
    arena.playerStart,
  ];
  const walkways = env.zones.filter((z) =>
    ["aisle", "crosswalk", "intersection", "road", "parking", "alley"].includes(z.kind),
  );
  for (const [s, out] of along) {
    const p = facePoint(shop.rect, awning.edge, s, out);
    const zone = env.zones.find(
      (z) => (z.kind === "sidewalk" || z.kind === "frontage") && inside(p, z.rect),
    );
    if (
      !zone ||
      p.x < 0 ||
      p.y < 0 ||
      p.x > arena.extent.width ||
      p.y > arena.extent.height ||
      walkways.some((z) => inside(p, z.rect)) ||
      env.structures.some((st) => inside(p, st.rect, 0.3)) ||
      arena.cover!.some((c) => inside(p, c.rect, 0.5)) ||
      keepClear.some((k) => Math.hypot(k.x - p.x, k.y - p.y) < 1.4)
    )
      continue;
    env.clusters.push({
      id: "shop_lamp",
      kind: "street_lamp",
      zoneId: zone.id,
      reason: LAMP_REASON,
    });
    env.dressing.push({
      id: "shop_lamp_detail_0",
      kind: "lamp",
      position: { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 },
      clusterId: "shop_lamp",
    });
    return true;
  }
  return false;
}
