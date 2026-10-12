import { combatantDisposition, type Point } from "@/engine";
import { ActorMarker } from "../ActorMarker";
import { actorColor, layoutMarkers, markerFor } from "../actorMarkers";
import { dispositionLabel } from "../combatDisposition";
import type { BoardActor, BoardBlocker, BoardCover, BoardSize, Project } from "./boardTypes";

/**
 * Who everybody is, in screen pixels and above everything standing (`actorMarkers.ts`
 * decides what each marker says; `layoutMarkers` keeps them on screen and apart).
 */
export function ActorMarkersLayer({
  actors,
  lockedId,
  pointedId,
  hovered,
  focused,
  project,
  scenic,
  scenicUnitTop,
  toScreen,
  boardSize,
  blocker,
  cover,
  ui,
}: {
  actors: BoardActor[];
  lockedId: string | null;
  pointedId: string | null;
  hovered: string | null;
  focused: string | null;
  project: Project;
  scenic: boolean;
  scenicUnitTop: number;
  toScreen: (p: Point) => Point;
  boardSize: BoardSize;
  blocker: BoardBlocker;
  cover: BoardCover[];
  ui: number;
}) {
  const attention = { locked: lockedId, pointed: pointedId, hovered, focused };
  const items = actors.map(({ actor, data }) => {
    const p = project(data.position);
    const head = { x: p.x, y: p.y - (scenic ? scenicUnitTop + 4 : 68) };
    const marker = markerFor(
      actor,
      attention,
      dispositionLabel(combatantDisposition(actor.defeated, data.exitReason)),
    );
    const ground = toScreen(p);
    const inView =
      ground.x >= 0 && ground.x <= boardSize.width && ground.y >= 0 && ground.y <= boardSize.height;
    return {
      id: actor.id,
      marker,
      head,
      inView,
      color: actorColor(actor),
      ...toScreen(head),
    };
  });
  // the "IN THE WAY" label over the obstacle is fixed; names move clear of it
  const blockerPiece = blocker
    ? cover.find((c) => c.piece.id === blocker.id && !c.destroyed)
    : undefined;
  const obstacles = blockerPiece
    ? (() => {
        const r = blockerPiece.piece.rect;
        const top = Math.min(
          ...[
            { x: r.x, y: r.y },
            { x: r.x + r.width, y: r.y },
            { x: r.x + r.width, y: r.y + r.height },
            { x: r.x, y: r.y + r.height },
          ].map((c) => project(c).y - 22),
        );
        const c = toScreen({
          x: project({ x: r.x + r.width / 2, y: r.y + r.height / 2 }).x,
          y: top,
        });
        return [{ left: c.x - 40, right: c.x + 40, top: c.y - 18, bottom: c.y }];
      })()
    : [];
  const placed = layoutMarkers(items, boardSize, obstacles);
  return (
    <g className="combat-markers" pointerEvents="none">
      {items.map((item) =>
        !placed.has(item.id) ? null : (
          <ActorMarker
            key={item.id}
            marker={item.marker}
            color={item.color}
            at={item.head}
            shift={placed.get(item.id)!}
            ui={ui}
          />
        ),
      )}
    </g>
  );
}
