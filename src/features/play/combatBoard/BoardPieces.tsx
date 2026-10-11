/**
 * What stands on the tactical board, one piece at a time: a cover piece and a
 * combatant. `CombatBoard.tsx` sorts them into painter's order and owns every
 * handler they call.
 */
import type { Dispatch, SetStateAction } from "react";
import { combatantDisposition, tileKey, tileOf, type Tile } from "@/engine";
import { actorColor } from "../actorMarkers";
import { dispositionLabel } from "../combatDisposition";
import type { InteractionEvent } from "../combatInteraction";
import { frameDuration, type PlaybackFrame } from "../combatPlayback";
import { points } from "./boardGeometry";
import type {
  BlockedSquares,
  BoardActor,
  BoardArena,
  BoardBlocker,
  BoardCover,
  GroundPointer,
  Project,
} from "./boardTypes";

export function CoverPieceView({
  piece,
  project,
  canMove,
  groundPoint,
  arena,
  blockedSquares,
  clickSquare,
  setInspected,
  blocker,
  ui,
  scenic,
  inspected,
}: {
  piece: BoardCover;
  project: Project;
  canMove: boolean;
  groundPoint: GroundPointer;
  arena: BoardArena;
  blockedSquares: BlockedSquares;
  clickSquare: (tile: Tile) => void;
  setInspected: (id: string | null) => void;
  blocker: BoardBlocker;
  ui: number;
  scenic: boolean;
  inspected: string | null;
}) {
  const r = piece.piece.rect;
  const corners = [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x + r.width, y: r.y + r.height },
    { x: r.x, y: r.y + r.height },
  ].map(project);
  const lift = piece.destroyed ? 2 : 22;
  const top = corners.map((p) => ({ x: p.x, y: p.y - lift }));
  return (
    <g
      className="combat-cover"
      role="button"
      tabIndex={0}
      aria-label={`${piece.label}, ${piece.destroyed ? "destroyed" : `${piece.hp} HP`}`}
      onClick={(e) => {
        e.stopPropagation();
        // A standing crate is drawn as a box, so its clickable
        // shape overhangs the squares behind it. Ground the
        // player can actually stand on wins: the board is the
        // control surface, and inspecting is the fallback.
        const at = canMove ? groundPoint(e.currentTarget.ownerSVGElement!, e) : null;
        const square = at ? tileOf(arena, at) : null;
        if (square && !blockedSquares.has(tileKey(square))) clickSquare(square);
        else setInspected(piece.piece.id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          if (piece.destroyed && canMove) clickSquare(tileOf(arena, { x: r.x + 1, y: r.y + 1 }));
          else setInspected(piece.piece.id);
        }
      }}
    >
      <polygon
        points={points([...top, corners[2]!, corners[1]!, corners[0]!])}
        fill="transparent"
      />
      {blocker?.id === piece.piece.id && (
        // The thing in the way, said out loud. Outline plus a
        // label, so it does not rely on the colour alone.
        <g className="combat-blocker" pointerEvents="none">
          <polygon points={points(top)} />
          {/* Said at the obstacle, in screen pixels, above it. */}
          <text
            transform={`translate(${(corners[0]!.x + corners[2]!.x) / 2},${
              Math.min(...top.map((c) => c.y)) - 4 * ui
            }) scale(${ui})`}
            textAnchor="middle"
          >
            IN THE WAY
          </text>
        </g>
      )}
      {scenic && inspected === piece.piece.id && (
        <polygon
          points={points(corners)}
          fill="#ffc578"
          fillOpacity=".12"
          stroke="#ffc578"
          strokeWidth="2"
          pointerEvents="none"
        />
      )}
      <g visibility={scenic ? "hidden" : undefined}>
        <polygon
          points={points([corners[0]!, corners[1]!, top[1]!, top[0]!])}
          fill="#354b52"
          stroke="#61777d"
        />
        <polygon
          points={points([corners[1]!, corners[2]!, top[2]!, top[1]!])}
          fill="#263b45"
          stroke="#61777d"
        />
        <polygon
          points={points(top)}
          fill={
            piece.destroyed ? "#263137" : piece.piece.material === "wood" ? "#727363" : "#57737a"
          }
          stroke={inspected === piece.piece.id ? "#f9bd72" : "#9caa9f"}
          strokeWidth="1.2"
          strokeDasharray={piece.destroyed ? "3 3" : undefined}
        />
        {!piece.destroyed && (
          <polyline points={points([top[0]!, top[2]!])} stroke="#d2dbbe" opacity=".35" />
        )}
      </g>
    </g>
  );
}

export function ActorUnit({
  actor,
  data,
  project,
  lockedId,
  pointedId,
  clickUnit,
  setHovered,
  dispatch,
  setFocused,
  focused,
  playback,
  scenic,
  scenicUnitTop,
}: BoardActor & {
  project: Project;
  lockedId: string | null;
  pointedId: string | null;
  clickUnit: (id: string) => void;
  setHovered: Dispatch<SetStateAction<string | null>>;
  dispatch: (event: InteractionEvent) => void;
  setFocused: Dispatch<SetStateAction<string | null>>;
  focused: string | null;
  playback: PlaybackFrame | null | undefined;
  scenic: boolean;
  scenicUnitTop: number;
}) {
  const p = project(data.position);
  const color = actorColor(actor);
  const disposition = combatantDisposition(actor.defeated, data.exitReason);
  const exitLabel = dispositionLabel(disposition);
  const takeable = !actor.isPlayer && !actor.defeated;
  const locked = lockedId === actor.id;
  const chosen = pointedId === actor.id;
  return (
    <g
      transform={`translate(${p.x},${p.y})`}
      className={`combat-unit ${actor.defeated ? "is-out" : ""} ${locked ? "is-locked" : ""}`}
      data-disposition={disposition}
      role={actor.defeated ? "img" : "button"}
      tabIndex={actor.defeated ? undefined : 0}
      aria-label={
        actor.defeated
          ? `${actor.name}: ${exitLabel}. Last position in combat.`
          : actor.isPlayer
            ? `${actor.name}, ${actor.hp} of ${actor.hpMax} HP, your character`
            : `${actor.name}, ${actor.hp} of ${actor.hpMax} HP. ${
                locked ? "Selected; activate again to shoot" : "Activate to target"
              }`
      }
      aria-pressed={takeable ? locked : undefined}
      onClick={(e) => {
        // The board behind this must not also read the click as
        // ground, or one gesture would target AND move.
        e.stopPropagation();
        if (takeable) clickUnit(actor.id);
      }}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerEnter={() => {
        setHovered(actor.id);
        if (takeable) dispatch({ kind: "hover-unit", targetId: actor.id });
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();
        setHovered((current) => (current === actor.id ? null : current));
        if (takeable) dispatch({ kind: "leave-unit" });
      }}
      onFocus={() => setFocused(actor.id)}
      onBlur={() => setFocused((current) => (current === actor.id ? null : current))}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          if (takeable) clickUnit(actor.id);
        }
      }}
    >
      {playback?.animate !== false &&
        playback?.kind === "move" &&
        playback.actorId === actor.id &&
        playback.path && (
          <animateTransform
            key={playback.sequence}
            attributeName="transform"
            type="translate"
            values={playback.path
              .map((point) => {
                const p = project(point);
                return `${p.x} ${p.y}`;
              })
              .join(";")}
            dur={`${frameDuration(playback)}ms`}
            calcMode="paced"
            fill="freeze"
          />
        )}
      <rect
        x="-30"
        y={scenic ? -scenicUnitTop : -65}
        width="60"
        height={scenic ? scenicUnitTop + 12 : 77}
        fill="transparent"
      />
      {/* The ground ring: a bystander's is quiet, the player's and a
          locked target's are the strongest on the board. */}
      <ellipse
        rx={locked ? 18 : 15}
        ry={locked ? 9 : 8}
        fill={actor.side === "neutral" && !locked ? "none" : `${color}20`}
        stroke={color}
        strokeOpacity={actor.side === "neutral" && !locked && !chosen ? 0.45 : 1}
        strokeWidth={locked || actor.isPlayer ? 2 : 1}
      />
      <g
        visibility={
          scenic && (disposition === "present" || disposition === "dead") ? "hidden" : undefined
        }
      >
        {disposition === "dead" ? (
          <path d="M-10 -3L10 3M-8 4L8 -4" stroke={color} strokeWidth="3" />
        ) : disposition === "withdrawn" ? (
          <path d="M-10 0H11M4 -7L12 0L4 7" fill="none" stroke={color} strokeWidth="3" />
        ) : disposition === "out_of_fight" ? (
          <circle r="6" fill="none" stroke={color} strokeWidth="2" />
        ) : (
          <g stroke="#091a23" strokeWidth="2">
            <path d="M-6 -18L-8 -4M5 -18L8 -4" stroke={color} strokeWidth="5" />
            <path d="M-7 -35L8 -35L10 -19L-8 -19Z" fill={color} />
            <circle cy="-43" r="6" fill="#d8ded6" />
            {actor.side === "neutral" ? (
              <path d="M-6 -31L-12 -19M7 -31L13 -19" stroke={color} strokeWidth="4" />
            ) : (
              <>
                <path d="M6 -30L17 -23L23 -32" stroke={color} strokeWidth="4" />
                <path d="M20 -35L30 -38" stroke="#e5e8dc" strokeWidth="4" />
              </>
            )}
          </g>
        )}
      </g>
      {/* Brackets around the person, not a box around a
          rectangle: they close in when the target is locked,
          so hovering and choosing read differently. */}
      {(chosen || locked || focused === actor.id) && (
        <path
          className={`combat-brackets ${locked ? "is-locked" : ""}`}
          d={
            locked
              ? "M-20 -46v-7h7M20 -46v-7h-7M-20 2v7h7M20 2v7h-7"
              : "M-24 -48v-8h8M24 -48v-8h-8M-24 3v8h8M24 3v8h-8"
          }
          stroke={color}
          fill="none"
          strokeWidth={locked ? 2.4 : 1.6}
        />
      )}
    </g>
  );
}
