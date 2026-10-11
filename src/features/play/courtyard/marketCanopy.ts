/** Joined fabric over the market's existing exposed return, including its door.
 * Presentation only: no saved attachment, collision surface or additional light. */
import type { SceneEnvironment } from "@/engine";
import { facadeOpenings } from "./architectureArt";
import { exposedSpans } from "./frontage";
import type { Storefront } from "./storefront";
export function marketReturnCanopies(
  shops: readonly Storefront[],
  env: Pick<SceneEnvironment, "structures" | "entrances">,
): Storefront[] {
  const result: Storefront[] = shops.flatMap<Storefront>((shop) => {
    const edge = shop.edge === "north" ? "east" : "north";
    const s = shop.structure;
    const length = edge === "north" ? s.rect.width : s.rect.height;
    const corner = edge === "east" ? 0 : length;
    const open = exposedSpans(s, edge, env.structures).find(([a, b]) =>
      corner === 0 ? a < 0.05 : b > length - 0.05,
    );
    if (!open || open[1] - open[0] < 3) return [];
    const a = corner === 0 ? 0 : Math.max(open[0], length - 7.5);
    const b = corner === 0 ? Math.min(open[1], 7.5) : length;
    const { bays, doors } = facadeOpenings(s, env.entrances, edge);
    return [
      {
        ...shop,
        edge,
        length,
        door: doors[0] ?? -10,
        bays,
        litBays: [],
        awning: {
          id: "market-return-canopy",
          kind: "awning" as const,
          edge,
          offset: a,
          span: b - a,
          projection: 1.15,
          height: shop.awning.height,
        },
      },
    ];
  });
  // The market's saved block may continue along the SAME street plane, rather
  // than around a free corner. Join the immediately adjacent trading floor too.
  for (const shop of shops) {
    const r = shop.structure.rect;
    for (const s of env.structures) {
      if (s === shop.structure || s.style !== "shop") continue;
      const q = s.rect;
      const joined =
        shop.edge === "east"
          ? Math.abs(q.x + q.width - r.x - r.width) < 0.01 && Math.abs(q.y + q.height - r.y) < 0.01
          : Math.abs(q.y - r.y) < 0.01 && Math.abs(q.x - r.x - r.width) < 0.01;
      if (!joined) continue;
      const length = shop.edge === "east" ? q.height : q.width;
      const span = Math.min(length, 7.5),
        offset = shop.edge === "east" ? length - span : 0;
      if (
        !exposedSpans(s, shop.edge, env.structures).some(
          ([a, b]) => a <= offset && b >= offset + span,
        )
      )
        continue;
      const { bays, doors } = facadeOpenings(s, env.entrances, shop.edge);
      result.push({
        ...shop,
        structure: s,
        length,
        door: doors[0] ?? -10,
        bays,
        litBays: [],
        awning: {
          ...shop.awning,
          id: "market-return-canopy",
          offset,
          span,
          projection: shop.awning.projection,
        },
      });
    }
  }
  return result;
}
