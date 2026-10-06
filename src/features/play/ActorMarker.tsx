import type { Point } from "@/engine";
import { MARKER, type Marker } from "./actorMarkers";

/**
 * One person's marker, drawn in screen pixels: `ui` is one screen pixel in scene
 * units, so everything inside is the same size at every camera zoom. `at` is the
 * top of the head in scene units; `shift` is how far `layoutMarkers` moved the box
 * (screen pixels) to keep it on screen and clear of another, with a thin leader
 * back to the head when it moved far.
 */
export function ActorMarker({
  marker,
  color,
  at,
  shift,
  ui,
}: {
  marker: Marker;
  color: string;
  at: Point;
  shift: { dx: number; dy: number };
  ui: number;
}) {
  const G = MARKER.glyph;
  const barTop = -(G + MARKER.gap + MARKER.barHeight);
  const textBase = (marker.bar ? barTop : -G) - MARKER.gap - 1;
  const quiet = marker.role === "bystander" || marker.role === "out";
  return (
    <g
      className={`combat-marker is-${marker.role} ${marker.detail ? "has-detail" : ""}`}
      transform={`translate(${at.x + shift.dx * ui},${at.y + shift.dy * ui}) scale(${ui})`}
      opacity={quiet && !marker.detail ? 0.75 : 1}
    >
      {Math.hypot(shift.dx, shift.dy) > 6 && (
        <line
          x1={0}
          y1={0}
          x2={-shift.dx}
          y2={-shift.dy}
          stroke={color}
          strokeOpacity={0.45}
          strokeWidth={1}
        />
      )}
      <g stroke="#061118" strokeWidth={1.4} strokeLinejoin="round">
        {marker.glyph === "caret" && <path d={`M-6 ${-G - 2}H6L0 -1Z`} fill={color} />}
        {marker.glyph === "diamond" && (
          <path d={`M0 ${-G - 1}L4.5 ${-G / 2 - 0.5}L0 0L-4.5 ${-G / 2 - 0.5}Z`} fill={color} />
        )}
        {marker.glyph === "disc" && <circle cy={-G / 2} r={3.4} fill={color} />}
        {marker.glyph === "ring" && (
          <circle cy={-G / 2} r={3} fill="none" stroke={color} strokeWidth={1.5} />
        )}
        {marker.glyph === "cross" && (
          <path d={`M-4 ${-G}L4 0M4 ${-G}L-4 0`} stroke={color} strokeWidth={2} />
        )}
      </g>
      {marker.bar && (
        <g>
          <rect
            x={-marker.bar.width / 2 - 1}
            y={barTop - 1}
            width={marker.bar.width + 2}
            height={MARKER.barHeight + 2}
            rx={1.5}
            fill="#061118"
            fillOpacity={0.85}
          />
          <rect
            x={-marker.bar.width / 2}
            y={barTop}
            width={marker.bar.width * marker.bar.fraction}
            height={MARKER.barHeight}
            rx={1}
            fill={color}
          />
        </g>
      )}
      {marker.name && (
        <text y={textBase} textAnchor="middle" className="combat-marker-label">
          <tspan fill="#e6efec">{marker.name}</tspan>
          {marker.hp && (
            <tspan fill={color} dx={MARKER.charWidth}>
              {marker.hp}
            </tspan>
          )}
        </text>
      )}
      {marker.status && (
        <text
          y={marker.name ? textBase - MARKER.lineHeight : textBase}
          textAnchor="middle"
          className="combat-marker-label is-status"
          fill={color}
        >
          {marker.status}
        </text>
      )}
    </g>
  );
}
