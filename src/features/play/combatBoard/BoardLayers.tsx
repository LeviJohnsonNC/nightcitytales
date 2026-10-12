/**
 * Layers of the tactical board's SVG that only draw: its definitions, the diagram
 * floor shown when there is no scenic art, the lit squares, and a shot's playback.
 * Everything here is in scene units; `CombatBoard.tsx` owns the camera and input.
 */
import { tileKey, type Point, type Tile } from "@/engine";
import type { PlaybackFrame } from "../combatPlayback";
import type { Interaction } from "../combatInteraction";
import type { CombatantData } from "../encounterModel";
import { overlayMode } from "../overlayModel";
import { points, squareCorners } from "./boardGeometry";
import type { BoardActor, BoardArena, EdgeRun, LitSquare, Project } from "./boardTypes";

export function BoardDefs({
  patternId,
  boardCorners,
}: {
  patternId: string;
  boardCorners: Point[];
}) {
  return (
    <defs>
      <marker
        id={`${patternId}-arrow`}
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="5"
        markerHeight="5"
        orient="auto-start-reverse"
      >
        <path d="M0 1L9 5L0 9z" fill="#65eee0" />
      </marker>
      <clipPath id={`${patternId}-floor`}>
        <polygon points={points(boardCorners)} />
      </clipPath>
      <pattern id={patternId} width="8" height="8" patternUnits="userSpaceOnUse">
        <path d="M0 8L8 0" stroke="#a5b8c8" strokeOpacity=".035" />
      </pattern>
      <linearGradient id={`${patternId}-ground`} x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#25373e" />
        <stop offset="1" stopColor="#14232d" />
      </linearGradient>
      <radialGradient id={`${patternId}-light`}>
        <stop stopColor="#3dddd6" stopOpacity=".13" />
        <stop offset="1" stopColor="#3dddd6" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

export function DiagramFloor({
  scenic,
  boardCorners,
  patternId,
  arena,
  project,
  player,
}: {
  scenic: boolean;
  boardCorners: Point[];
  patternId: string;
  arena: BoardArena;
  project: Project;
  player: BoardActor | undefined;
}) {
  return (
    <g visibility={scenic ? "hidden" : undefined}>
      <ellipse cx="550" cy="470" rx="440" ry="125" fill="#000" opacity=".3" />
      <polygon
        points={points([...boardCorners, boardCorners[0]!].map((p) => ({ ...p, y: p.y + 16 })))}
        fill="#070e14"
        stroke="#33434b"
      />
      <polygon
        points={points(boardCorners)}
        fill={`url(#${patternId}-ground)`}
        stroke="#557079"
        strokeWidth="1.3"
      />
      <polygon points={points(boardCorners)} fill={`url(#${patternId})`} pointerEvents="none" />
      <g pointerEvents="none" clipPath={`url(#${patternId}-floor)`}>
        <polyline
          points={points(
            [
              { x: 0.5, y: 0.5 },
              { x: 0.5, y: arena.extent.height - 0.5 },
              { x: arena.extent.width - 0.5, y: arena.extent.height - 0.5 },
            ].map(project),
          )}
          fill="none"
          stroke={arena.key === "club_interior" ? "#db81cd" : "#a4ccca"}
          strokeOpacity=".5"
          strokeWidth="2"
        />
        <polyline
          points={points(
            [
              { x: arena.extent.width * 0.12, y: arena.extent.height * 0.8 },
              { x: arena.extent.width * 0.88, y: arena.extent.height * 0.8 },
            ].map(project),
          )}
          fill="none"
          stroke="#d5ba82"
          strokeOpacity=".25"
          strokeWidth="3"
          strokeDasharray="14 9"
        />
        <g
          transform={`matrix(${project({ x: 1, y: 0 }).x - project({ x: 0, y: 0 }).x},${project({ x: 1, y: 0 }).y - project({ x: 0, y: 0 }).y},${project({ x: 0, y: 1 }).x - project({ x: 0, y: 0 }).x},${project({ x: 0, y: 1 }).y - project({ x: 0, y: 0 }).y},${project({ x: 0, y: 0 }).x},${project({ x: 0, y: 0 }).y})`}
        >
          <text
            x={arena.extent.width * 0.12}
            y={arena.extent.height * 0.9}
            fontSize={arena.extent.width * 0.055}
            fontFamily="monospace"
            letterSpacing=".25"
            fill="#bed8d3"
            opacity=".12"
          >
            {arena.key === "club_interior" ? "AFTER HOURS" : "NIGHT CITY"}
          </text>
        </g>
      </g>
      {/* The 2 m battlemat lattice itself. Squares are the unit a Move
          Action spends; the metres underneath stay what range is read at. */}
      <g stroke="#a7cccf" strokeOpacity=".085" strokeWidth=".7" pointerEvents="none">
        {Array.from({ length: Math.ceil(arena.extent.width / 2) - 1 }, (_, i) => (
          <polyline
            key={`x${i}`}
            points={points(
              [
                { x: (i + 1) * 2, y: 0 },
                { x: (i + 1) * 2, y: arena.extent.height },
              ].map(project),
            )}
          />
        ))}
        {Array.from({ length: Math.ceil(arena.extent.height / 2) - 1 }, (_, i) => (
          <polyline
            key={`y${i}`}
            points={points(
              [
                { x: 0, y: (i + 1) * 2 },
                { x: arena.extent.width, y: (i + 1) * 2 },
              ].map(project),
            )}
          />
        ))}
      </g>
      {player && (
        <ellipse
          cx={project(player.data.position).x}
          cy={project(player.data.position).y}
          rx="170"
          ry="90"
          fill={`url(#${patternId}-light)`}
          pointerEvents="none"
        />
      )}
    </g>
  );
}

export function MoveSquares({
  interaction,
  litSquares,
  spotTile,
  reachEdge,
  project,
}: {
  interaction: Interaction;
  litSquares: LitSquare[];
  spotTile: Tile | null;
  reachEdge: EdgeRun;
  project: Project;
}) {
  return (
    <g className={`combat-squares is-${overlayMode(interaction.type)}`} pointerEvents="none">
      {litSquares.map(({ tile, key, sheltered: safe, firing, faded }) => (
        <polygon
          key={key}
          className={`combat-square ${safe ? "is-sheltered" : ""} ${
            firing ? "is-firing" : ""
          } ${faded ? "is-faded" : ""} ${spotTile && tileKey(spotTile) === key ? "is-chosen" : ""}`}
          points={points(squareCorners(tile).map(project))}
        />
      ))}
      {reachEdge.map(([a, b], i) => {
        const p = project(a),
          q = project(b);
        return <line key={i} className="combat-move-edge" x1={p.x} y1={p.y} x2={q.x} y2={q.y} />;
      })}
    </g>
  );
}

export function ShotPlayback({
  playback,
  impactPoint,
  playbackActor,
  project,
  scenic,
  scenicUnitTop,
  ui,
}: {
  playback: PlaybackFrame;
  impactPoint: Point;
  playbackActor: CombatantData;
  project: Project;
  scenic: boolean;
  scenicUnitTop: number;
  ui: number;
}) {
  return (
    <g
      className={
        playback.animate === false ? "combat-shot-playback no-motion" : "combat-shot-playback"
      }
      pointerEvents="none"
    >
      <line
        x1={project(playbackActor.position).x}
        y1={project(playbackActor.position).y - 20}
        x2={project(impactPoint).x}
        y2={project(impactPoint).y - (playback.kind === "cover" ? 10 : 20)}
        stroke={playback.impact === "MISS" ? "#d1b4a0" : "#ffcd7f"}
        strokeWidth="3"
        className="combat-tracer"
      />
      <text
        transform={`translate(${project(impactPoint).x},${
          project(impactPoint).y - (scenic ? scenicUnitTop + 4 : 68)
        }) scale(${ui}) translate(0,-30)`}
        textAnchor="middle"
        className="combat-impact"
      >
        {playback.impact}
      </text>
    </g>
  );
}
