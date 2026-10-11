/** Elevated canopy slabs block overhead lamps, but never the shop light below them.
 * Share dimensions with the visible canopy; no new cover or gameplay obstruction. */
import type { SceneEnvironment } from "@/engine";
import { edgeFrame } from "./frontage";
import type { ShadowCaster } from "./lampShadow";
import { occupiedUse } from "./occupiedFrontage";
import { awningFootprint, type Storefront } from "./storefront";
import { STOREFRONT_LEVELS } from "./storefrontPack";

export function architecturalCasters(
  env: SceneEnvironment,
  shops: readonly Storefront[],
): ShadowCaster[] {
  const result: ShadowCaster[] = shops.map((sf) => {
    const r = awningFootprint(sf);
    return {
      coverId: `architecture:${sf.structure.id}:${sf.edge}:canopy`,
      art: "canopy",
      body: [
        { x: r.x, y: r.y },
        { x: r.x + r.width, y: r.y },
        { x: r.x + r.width, y: r.y + r.height },
        { x: r.x, y: r.y + r.height },
      ],
      bottom: STOREFRONT_LEVELS.awningOuter - 0.16,
      height: STOREFRONT_LEVELS.awningWall,
      wreck: STOREFRONT_LEVELS.awningWall,
    };
  });
  for (const s of env.structures) {
    if (occupiedUse(s) !== "repair") continue;
    for (const edge of ["north", "east"] as const) {
      const f = edgeFrame(s.rect, edge);
      result.push({
        coverId: `architecture:${s.id}:${edge}:canopy`,
        art: "canopy",
        body: [
          f.world(0.08, 0),
          f.world(f.length - 0.08, 0),
          f.world(f.length - 0.08, 0.72),
          f.world(0.08, 0.72),
        ],
        bottom: 2.77,
        height: 3.03,
        wreck: 3.03,
      });
    }
  }
  return result;
}
