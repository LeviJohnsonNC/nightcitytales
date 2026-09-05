import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  Crosshair,
  Footprints,
  RotateCcw,
  SkipForward,
  MessageSquare,
  Radio,
  Minus,
  Plus,
  Maximize,
  Hand,
  Shield,
  ChevronRight,
} from "lucide-react";
import {
  arenaFor,
  coverStatuses,
  currentCombatant,
  judgeAction,
  previewMovement,
  previewAttack,
  remainingCombatTurn,
  type CapabilitySnapshot,
  type Point,
} from "@/engine";
import type { LiveEncounter } from "@/features/campaign/encounterState";
import { raisedWeapon } from "./encounterModel";
import { targetCapabilities } from "./capabilityModel";
import { battlefieldProjection } from "./battlefieldProjection";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import "./combat.css";

type Props = {
  live: LiveEncounter | null;
  capability: CapabilitySnapshot | null;
  onMoveTo?: (point: Point) => void;
  onEndTurn?: () => void;
  onReload?: (weaponId: string) => void;
  onAttack?: (targetId: string, weaponId: string) => void;
  weaponId: string | null;
  onWeaponId: (id: string) => void;
  dice?: ReactNode;
  busy?: boolean;
  statusText?: string | undefined;
  title?: string;
  objective?: string;
  tools?: ReactNode;
  journal?: ReactNode;
  improvisation?: ReactNode;
};
const points = (path: Point[]) => path.map((p) => `${p.x},${p.y}`).join(" ");

/** The tactical screen owns selection and camera only. Every actionable preview comes from the engine. */
export function CombatBoard({
  live,
  capability,
  onMoveTo,
  onEndTurn,
  onReload,
  onAttack,
  weaponId,
  onWeaponId,
  dice,
  busy = false,
  statusText,
  title,
  objective,
  tools,
  journal,
  improvisation,
}: Props) {
  const [mode, setMode] = useState<"move" | "shoot" | "pan">("move");
  const [destination, setDestination] = useState<Point | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [inspected, setInspected] = useState<string | null>(null);
  const [panel, setPanel] = useState<"journal" | "improvise" | null>(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const drag = useRef<Point | null>(null);
  const patternId = useId().replaceAll(":", "");
  useEffect(() => {
    if (dice) setPanel((current) => (current === "improvise" ? null : current));
  }, [dice]);
  if (!live) return null;
  const arena = arenaFor(live.arena);
  const { project, unproject } = battlefieldProjection(arena.extent.width, arena.extent.height);
  const cover = coverStatuses(arena, live.cover);
  const actors = live.state.order.flatMap((id) => {
    const actor = live.state.combatants[id],
      data = live.data[id];
    return actor && data ? [{ actor, data }] : [];
  });
  const player = actors.find(({ actor }) => actor.isPlayer);
  const active = currentCombatant(live.state);
  const remaining = capability ? remainingCombatTurn(capability) : null;
  const canAct =
    !busy && active?.isPlayer && !player?.actor.defeated && live.state.status === "active";
  const weapon = raisedWeapon(capability, weaponId);
  const targets = actors.filter(({ actor }) => !actor.isPlayer && !actor.defeated);
  const target = targets.find(({ actor }) => actor.id === selected) ?? targets[0];
  const shot =
    capability && weapon && target
      ? previewAttack(capability, target.actor.id, weapon.itemId)
      : null;
  const spot = destination ?? hover;
  const route =
    capability && player && spot
      ? previewMovement({
          arena,
          cover: live.cover,
          from: player.data.position,
          to: spot,
          capability,
        })
      : null;
  const there =
    capability && route?.ok
      ? { ...capability, targets: targetCapabilities(live, route.position) }
      : null;
  const futureShot =
    there && target && weapon ? previewAttack(there, target.actor.id, weapon.itemId) : null;
  const reload =
    capability && weapon
      ? judgeAction(capability, { kind: "reload", weapon: weapon.itemId })
      : null;
  const inspectedCover = cover.find((c) => c.piece.id === inspected);
  const boardCorners = [
    { x: 0, y: 0 },
    { x: arena.extent.width, y: 0 },
    { x: arena.extent.width, y: arena.extent.height },
    { x: 0, y: arena.extent.height },
  ].map(project);
  const cameraWidth = 1100 / camera.zoom,
    cameraHeight = 680 / camera.zoom;
  const viewBox = `${550 - cameraWidth / 2 + camera.x} ${340 - cameraHeight / 2 + camera.y} ${cameraWidth} ${cameraHeight}`;
  const svgPoint = (svg: SVGSVGElement, e: { clientX: number; clientY: number }) => {
    const matrix = svg.getScreenCTM();
    return matrix ? new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse()) : null;
  };
  const groundPoint = (svg: SVGSVGElement, e: { clientX: number; clientY: number }) => {
    const p = svgPoint(svg, e);
    if (!p) return null;
    const to = unproject(p);
    return to.x >= 0 && to.y >= 0 && to.x <= arena.extent.width && to.y <= arena.extent.height
      ? to
      : null;
  };
  const selectMode = (next: typeof mode) => {
    setMode(next);
    setDestination(null);
    setHover(null);
    setInspected(null);
  };
  const confirmMove = () => {
    if (!canAct || dice || !route?.ok || !destination) return;
    onMoveTo?.(route.position);
    setDestination(null);
    setHover(null);
  };
  const status =
    statusText ??
    (busy
      ? "Resolving action"
      : active?.isPlayer
        ? "Your turn"
        : `${active?.name ?? "Opponent"}'s turn`);
  const turnKey = `${live.id}:${live.state.round}:${active?.id}`;
  return (
    <section className="combat-screen" aria-label="Tactical combat">
      <header className="combat-header">
        <div className="combat-brand">
          <span className="combat-eyebrow">Night City / combat</span>
          <h1>{title ?? "Contact"}</h1>
          <p>{objective ?? arena.label}</p>
        </div>
        <div className="combat-header-tools">
          {tools}
          <button
            className="combat-icon"
            aria-label="Open combat journal"
            onClick={() => setPanel("journal")}
          >
            <Radio size={18} />
          </button>
        </div>
      </header>
      <div className="combat-turn-strip">
        <div className={`combat-turn ${busy && !statusText ? "is-busy" : ""}`} key={turnKey}>
          <span className="combat-status-dot" />
          <strong aria-live="polite">{status}</strong>
          <span>ROUND {String(live.state.round).padStart(2, "0")}</span>
        </div>
        <span className="combat-mobile-budget">
          Move {remaining?.movement ?? 0} m ·{" "}
          {remaining?.action
            ? "Action ready"
            : remaining?.attacks
              ? `${remaining.attacks} shot left`
              : "Action spent"}
        </span>
        <ol className="combat-initiative" aria-label="Initiative order">
          {actors.map(({ actor }, index) => (
            <li
              key={actor.id}
              className={`${actor.id === active?.id ? "is-active" : ""} ${actor.defeated ? "is-out" : ""}`}
            >
              <span>{index + 1}</span>
              {actor.isPlayer ? "YOU" : actor.name}
            </li>
          ))}
        </ol>
      </div>
      <div className="combat-main">
        <div className={`combat-stage mode-${mode}`}>
          <div className="combat-map-caption">
            <span className="combat-eyebrow">{arena.label}</span>
            <span>
              {arena.extent.width} × {arena.extent.height} m
            </span>
          </div>
          <div className="combat-camera" aria-label="Camera controls">
            <button
              className="combat-icon"
              aria-label="Zoom in"
              disabled={camera.zoom >= 2.5}
              onClick={() => setCamera({ ...camera, zoom: Math.min(2.5, camera.zoom + 0.25) })}
            >
              <Plus size={17} />
            </button>
            <button
              className="combat-icon"
              aria-label="Zoom out"
              disabled={camera.zoom <= 0.75}
              onClick={() => setCamera({ ...camera, zoom: Math.max(0.75, camera.zoom - 0.25) })}
            >
              <Minus size={17} />
            </button>
            <button
              className={`combat-icon ${mode === "pan" ? "is-selected" : ""}`}
              aria-label="Pan battlefield"
              aria-pressed={mode === "pan"}
              onClick={() => selectMode(mode === "pan" ? "move" : "pan")}
            >
              <Hand size={17} />
            </button>
            <button
              className="combat-icon"
              aria-label="Reset camera"
              onClick={() => setCamera({ x: 0, y: 0, zoom: 1 })}
            >
              <Maximize size={17} />
            </button>
          </div>
          <span className="sr-only" id={`${patternId}-keyboard`}>
            In Move mode, use arrow keys to preview a destination, Enter to confirm, and Escape to
            clear. Targets and cover can also be selected with Tab and Enter.
          </span>
          <svg
            className="combat-arena"
            viewBox={viewBox}
            tabIndex={0}
            role="group"
            aria-describedby={`${patternId}-keyboard`}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget || mode !== "move" || !player) return;
              if (e.key === "Escape") {
                setDestination(null);
                return;
              }
              if (e.key === "Enter") {
                e.preventDefault();
                confirmMove();
                return;
              }
              const shifts: Record<string, Point> = {
                ArrowUp: { x: 0, y: 1 },
                ArrowDown: { x: 0, y: -1 },
                ArrowLeft: { x: -1, y: 0 },
                ArrowRight: { x: 1, y: 0 },
              };
              const shift = shifts[e.key];
              if (!shift || !canAct || dice) return;
              e.preventDefault();
              const from = destination ?? player.data.position;
              setDestination({
                x: Math.max(0, Math.min(arena.extent.width, from.x + shift.x)),
                y: Math.max(0, Math.min(arena.extent.height, from.y + shift.y)),
              });
            }}
            aria-label={`Angled battlefield: ${arena.label}. Select units or ground to preview an action.`}
            onPointerDown={(e) => {
              if (mode === "pan") {
                drag.current = { x: e.clientX, y: e.clientY };
                e.currentTarget.setPointerCapture(e.pointerId);
              }
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onPointerMove={(e) => {
              if (drag.current) {
                const rect = e.currentTarget.getBoundingClientRect();
                const scale = Math.max(cameraWidth / rect.width, cameraHeight / rect.height);
                setCamera({
                  ...camera,
                  x: camera.x - (e.clientX - drag.current.x) * scale,
                  y: camera.y - (e.clientY - drag.current.y) * scale,
                });
                drag.current = { x: e.clientX, y: e.clientY };
                return;
              }
              if (e.pointerType === "mouse" && mode === "move" && !destination)
                setHover(groundPoint(e.currentTarget, e));
            }}
            onPointerLeave={() => setHover(null)}
            onClick={(e) => {
              if (mode !== "move" || !canAct || dice) return;
              setDestination(groundPoint(e.currentTarget, e));
              setInspected(null);
            }}
          >
            <defs>
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
            <ellipse cx="550" cy="470" rx="440" ry="125" fill="#000" opacity=".3" />
            <polygon
              points={points(
                [...boardCorners, boardCorners[0]!].map((p) => ({ ...p, y: p.y + 16 })),
              )}
              fill="#070e14"
              stroke="#33434b"
            />
            <polygon
              points={points(boardCorners)}
              fill={`url(#${patternId}-ground)`}
              stroke="#557079"
              strokeWidth="1.3"
            />
            <polygon
              points={points(boardCorners)}
              fill={`url(#${patternId})`}
              pointerEvents="none"
            />
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
            {/* Cosmetic grid: no snapping, tiles or mechanics are introduced. */}
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
            {player && remaining && remaining.movement > 0 && mode === "move" && (
              <polygon
                points={points(
                  Array.from({ length: 81 }, (_, i) => {
                    const angle = (i / 80) * Math.PI * 2;
                    return project({
                      x: player.data.position.x + Math.cos(angle) * remaining.movement,
                      y: player.data.position.y + Math.sin(angle) * remaining.movement,
                    });
                  }),
                )}
                clipPath={`url(#${patternId}-floor)`}
                className="combat-reach"
                pointerEvents="none"
              >
                <title>Move distance limit; obstacles can make routes longer.</title>
              </polygon>
            )}
            {mode === "shoot" && player && target && (
              <line
                x1={project(player.data.position).x}
                y1={project(player.data.position).y - 15}
                x2={project(target.data.position).x}
                y2={project(target.data.position).y - 15}
                stroke={shot?.gap ? "#ff7770" : "#f9bd72"}
                strokeWidth="2"
                strokeDasharray={shot?.gap ? "5 7" : ""}
                pointerEvents="none"
              />
            )}
            {route?.ok && mode === "move" && (
              <g pointerEvents="none">
                <polyline
                  points={points(route.path.map(project))}
                  fill="none"
                  stroke="#65eee0"
                  strokeWidth="3"
                  strokeDasharray="5 5"
                  className="combat-route"
                />
                <ellipse
                  cx={project(route.position).x}
                  cy={project(route.position).y}
                  rx="15"
                  ry="8"
                  fill="#65eee030"
                  stroke="#65eee0"
                  strokeWidth="2"
                />
                <path
                  d={`M${project(route.position).x} ${project(route.position).y - 15}v-10`}
                  stroke="#65eee0"
                  strokeWidth="2"
                />
              </g>
            )}
            {/* Painter's order lets near objects cover far ones while unit labels remain upright. */}
            {[
              ...cover.map((piece) => ({
                key: piece.piece.id,
                depth: project({
                  x: piece.piece.rect.x + piece.piece.rect.width / 2,
                  y: piece.piece.rect.y + piece.piece.rect.height / 2,
                }).y,
                render: () => {
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
                        setInspected(piece.piece.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setInspected(piece.piece.id);
                        }
                      }}
                    >
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
                          piece.destroyed
                            ? "#263137"
                            : piece.piece.material === "wood"
                              ? "#727363"
                              : "#57737a"
                        }
                        stroke={inspected === piece.piece.id ? "#f9bd72" : "#9caa9f"}
                        strokeWidth="1.2"
                        strokeDasharray={piece.destroyed ? "3 3" : undefined}
                      />
                      {!piece.destroyed && (
                        <polyline
                          points={points([top[0]!, top[2]!])}
                          stroke="#d2dbbe"
                          opacity=".35"
                        />
                      )}
                    </g>
                  );
                },
              })),
              ...actors.map(({ actor, data }) => ({
                key: actor.id,
                depth: project(data.position).y,
                render: () => {
                  const p = project(data.position);
                  const color = actor.isPlayer
                    ? "#65eee0"
                    : actor.side === "hostile"
                      ? "#ff7770"
                      : "#b3a2ff";
                  const chosen = mode === "shoot" && target?.actor.id === actor.id;
                  const select = () => {
                    if (!actor.isPlayer && !actor.defeated) {
                      setSelected(actor.id);
                      selectMode("shoot");
                    }
                  };
                  return (
                    <g
                      transform={`translate(${p.x},${p.y})`}
                      className={`combat-unit ${actor.defeated ? "is-out" : ""}`}
                      role="button"
                      tabIndex={0}
                      aria-label={`${actor.name}, ${actor.hp} of ${actor.hpMax} HP${actor.isPlayer ? ", your character" : ", select target"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        select();
                      }}
                      onPointerMove={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          select();
                        }
                      }}
                    >
                      <circle r="25" cy="-17" fill="transparent" />
                      <ellipse
                        rx={chosen ? 21 : 15}
                        ry={chosen ? 11 : 8}
                        fill={`${color}20`}
                        stroke={color}
                        strokeWidth={chosen ? 2 : 1}
                      />
                      {actor.defeated ? (
                        <path d="M-10 -3L10 3M-8 4L8 -4" stroke={color} strokeWidth="3" />
                      ) : (
                        <g stroke="#091a23" strokeWidth="2">
                          <path d="M-6 -18L-8 -4M5 -18L8 -4" stroke={color} strokeWidth="5" />
                          <path d="M-7 -35L8 -35L10 -19L-8 -19Z" fill={color} />
                          <circle cy="-43" r="6" fill="#d8ded6" />
                          <path d="M6 -30L17 -23L23 -32" stroke={color} strokeWidth="4" />
                          <path d="M20 -35L30 -38" stroke="#e5e8dc" strokeWidth="4" />
                        </g>
                      )}
                      <rect x="-23" y="-62" width="46" height="4" rx="1" fill="#08131b" />
                      <rect
                        x="-23"
                        y="-62"
                        width={46 * Math.max(0, Math.min(1, actor.hp / actor.hpMax))}
                        height="4"
                        rx="1"
                        fill={color}
                      />
                      <text y="23" textAnchor="middle" fill={color} className="combat-unit-label">
                        {actor.isPlayer ? "YOU" : actor.name}
                      </text>
                      {chosen && (
                        <path
                          d="M-29 -49v-8h8M29 -49v-8h-8M-29 5v8h8M29 5v8h-8"
                          stroke={color}
                          fill="none"
                          strokeWidth="2"
                        />
                      )}
                    </g>
                  );
                },
              })),
            ]
              .sort((a, b) => a.depth - b.depth)
              .map((item) => (
                <g key={item.key}>{item.render()}</g>
              ))}
          </svg>
          <div className="combat-map-hint">
            <span className="combat-eyebrow">
              {mode === "pan" ? "Camera" : mode === "shoot" ? "Targeting" : "Movement"}
            </span>
            {mode === "pan"
              ? "Drag to look around"
              : mode === "shoot"
                ? "Select a target · review the shot"
                : "Select ground · preview your route · confirm"}
          </div>
        </div>
        <aside className="combat-intel" aria-label="Tactical readout">
          <div className="combat-intel-heading">
            <span className="combat-eyebrow">
              {dice
                ? "Resolve action"
                : inspectedCover
                  ? "Terrain"
                  : mode === "move" && spot
                    ? "Destination"
                    : "Target assessment"}
            </span>
            <Crosshair size={16} />
          </div>
          {dice ? (
            <div className="combat-resolution" aria-live="polite">
              {dice}
            </div>
          ) : inspectedCover ? (
            <div className="combat-assessment">
              <h2>{inspectedCover.label}</h2>
              <strong>
                {inspectedCover.destroyed
                  ? "DESTROYED"
                  : `${inspectedCover.hp} / ${inspectedCover.hpMax} HP`}
              </strong>
              <p>
                {inspectedCover.destroyed
                  ? "The route through this footprint is open."
                  : inspectedCover.piece.blocksMovement === false
                    ? "Blocks the shot; its footprint is walkable."
                    : "Intact cover blocks the shot and the walking route."}
              </p>
            </div>
          ) : mode === "move" && spot ? (
            <div className="combat-assessment">
              <h2>{route?.ok ? "Reposition" : "Cannot move here"}</h2>
              <div className="combat-big-number">
                {route?.ok ? route.moved : "—"}
                <small>metres</small>
              </div>
              <p>
                {route?.ok
                  ? "Costs your Move. Your Action budget stays unchanged."
                  : route && !route.ok
                    ? route.reason
                    : "Select a destination."}
              </p>
              {futureShot && target && (
                <p className="combat-future">
                  {target.actor.name}
                  <br />
                  {futureShot.gap ? futureShot.gap : `From here: DV ${futureShot.dv}`}
                </p>
              )}
              <button
                className="combat-confirm"
                disabled={!canAct || !destination || !route?.ok || !onMoveTo}
                onClick={confirmMove}
              >
                Confirm move <ChevronRight size={16} />
              </button>
            </div>
          ) : target ? (
            <div className="combat-assessment">
              <h2>{target.actor.name}</h2>
              <span className="combat-eyebrow">
                {target.actor.side} /{" "}
                {target.actor.woundState === "none" ? "unwounded" : target.actor.woundState}
              </span>
              <div className="combat-big-number">
                {shot?.dv ?? "—"}
                <small>range DV</small>
              </div>
              <p>{shot?.gap ?? `${shot?.distance ?? "—"} m · clear shot`}</p>
              <div className="combat-target-stats">
                <span>
                  {target.actor.hp}/{target.actor.hpMax} HP
                </span>
                <span>
                  <Shield size={13} /> SP {target.actor.spBody}
                </span>
              </div>
              <button
                className="combat-confirm is-fire"
                disabled={!canAct || !!shot?.gap || !shot || !onAttack}
                onClick={() => {
                  if (weapon) {
                    selectMode("shoot");
                    onAttack?.(target.actor.id, weapon.itemId);
                  }
                }}
              >
                Take shot <Crosshair size={16} />
              </button>
            </div>
          ) : (
            <div className="combat-assessment">
              <h2>No standing targets</h2>
              <p>Review the battlefield or end your turn.</p>
            </div>
          )}
          <div className="combat-target-list">
            <span className="combat-eyebrow">On the field / {targets.length}</span>
            {targets.map(({ actor }) => {
              const preview =
                capability && weapon ? previewAttack(capability, actor.id, weapon.itemId) : null;
              return (
                <button
                  key={actor.id}
                  className={target?.actor.id === actor.id ? "is-selected" : ""}
                  onClick={() => {
                    setSelected(actor.id);
                    selectMode("shoot");
                  }}
                >
                  <span className="combat-target-dot" />
                  <span>
                    {actor.name}
                    <small>{preview?.gap ? "No shot" : `${preview?.distance ?? "—"} m`}</small>
                  </span>
                  <strong>{preview?.dv ? `DV ${preview.dv}` : "—"}</strong>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
      <footer className="combat-command">
        <div className="combat-loadout">
          <div>
            <span className="combat-eyebrow">{player?.actor.name ?? "Loadout"}</span>
            <span className="combat-vitals">
              {player?.actor.hp}/{player?.actor.hpMax} HP <span>SP {player?.actor.spBody}</span>
            </span>
          </div>
          <label>
            <span className="sr-only">Weapon</span>
            <select
              aria-label="Weapon"
              value={weapon?.itemId ?? ""}
              disabled={busy || !!dice}
              onChange={(e) => onWeaponId(e.target.value)}
            >
              {!weapon && <option value="">No weapon</option>}
              {capability?.weapons.map((w) => (
                <option key={w.itemId} value={w.itemId}>
                  {w.name}{" "}
                  {w.roundsLoaded !== null ? `· ${w.roundsLoaded}/${w.magazine ?? "?"}` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="combat-actions" aria-label="Combat actions">
          <button
            className={mode === "move" ? "is-selected" : ""}
            disabled={!canAct || !!dice || !remaining?.movement || !onMoveTo}
            onClick={() => selectMode("move")}
          >
            <Footprints />
            <span>
              Move
              <small>{remaining?.movement ? `${remaining.movement} m available` : "Spent"}</small>
            </span>
          </button>
          <button
            className={mode === "shoot" ? "is-selected" : ""}
            disabled={!canAct || !!dice || !onAttack}
            onClick={() => selectMode("shoot")}
          >
            <Crosshair />
            <span>
              Shoot
              <small>
                {remaining?.attacks
                  ? `${remaining.attacks} shot${remaining.attacks === 1 ? "" : "s"} available`
                  : "Unavailable"}
              </small>
            </span>
          </button>
          <button
            disabled={!canAct || !!dice || !reload?.ok || !onReload}
            title={reload && !reload.ok ? reload.reason : "Reload weapon"}
            onClick={() => {
              if (weapon) onReload?.(weapon.itemId);
            }}
          >
            <RotateCcw />
            <span>
              Reload<small>{reload?.ok ? "1 Action" : "Unavailable"}</small>
            </span>
          </button>
          <button
            disabled={!canAct || !improvisation || !!dice}
            onClick={() => setPanel("improvise")}
          >
            <MessageSquare />
            <span>
              Improvise<small>Your own idea</small>
            </span>
          </button>
        </div>
        <button className="combat-end" disabled={!canAct || !onEndTurn} onClick={onEndTurn}>
          <SkipForward size={19} />
          <span>
            End turn
            <small>
              {remaining?.action
                ? "Action ready"
                : remaining?.attacks
                  ? "Attack remaining"
                  : "Action spent"}
            </small>
          </span>
        </button>
      </footer>
      <Dialog
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <DialogContent className="combat-dialog">
          <DialogTitle>
            {panel === "improvise" ? "What do you have in mind?" : "Combat journal"}
          </DialogTitle>
          <DialogDescription>
            {panel === "improvise"
              ? "Describe your intent. The game checks what is possible."
              : "The scene, your character, and the record of the fight."}
          </DialogDescription>
          <div className="combat-dialog-body">
            {panel === "improvise" ? improvisation : journal}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
