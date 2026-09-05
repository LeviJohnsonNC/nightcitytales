import { CombatPortrait } from "./CombatPortrait";
import { NightCityMark } from "@/components/brand/NightCityMark";
import { NpcDossier } from "@/features/cast/NpcName";
import { findNpcNumbered } from "@/features/cast/npcDirectory";
import { itemArt } from "@/features/chargen/art";
import { useCombatFeedback } from "./useCombatFeedback";
import { playbackHeading } from "./combatFeedback";
import { isCourtyard } from "./courtyard/propPresentation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Volume2,
  VolumeX,
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
  centreOf,
  coverBlocking,
  coverStatuses,
  currentCombatant,
  judgeAction,
  movementField,
  previewMovement,
  previewAttack,
  remainingCombatTurn,
  snapToGrid,
  tileKey,
  tileOf,
  TILE_METRES,
  type CapabilitySnapshot,
  type Point,
  type Tile,
} from "@/engine";
import type { LiveEncounter } from "@/features/campaign/encounterState";
import { raisedWeapon } from "./encounterModel";
import { targetCapabilities } from "./capabilityModel";
import { battlefieldProjection } from "./battlefieldProjection";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { frameDuration, type PlaybackFrame } from "./combatPlayback";
import { CourtyardLayer } from "./courtyard/CourtyardLayer";
import "./combat.css";

type Props = {
  playerPortrait?: string | null;
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
  playback?: PlaybackFrame | null;
  feedback?: string | undefined;
  onSkipPlayback?: () => void;
};
const points = (path: Point[]) => path.map((p) => `${p.x},${p.y}`).join(" ");
/** The four ground corners of one battlemat square, in metres. */
const squareCorners = (tile: Tile): Point[] => {
  const x = tile.col * TILE_METRES,
    y = tile.row * TILE_METRES;
  return [
    { x, y },
    { x: x + TILE_METRES, y },
    { x: x + TILE_METRES, y: y + TILE_METRES },
    { x, y: y + TILE_METRES },
  ];
};

/** The tactical screen owns selection and camera only. Every actionable preview comes from the engine. */
export function CombatBoard({
  playerPortrait,
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
  playback,
  feedback,
  onSkipPlayback,
}: Props) {
  const effects = useCombatFeedback(playback);
  const [failedWeaponArt, setFailedWeaponArt] = useState<string | null>(null);
  const [artReady, setArtReady] = useState(false);
  const [artEnabled, setArtEnabled] = useState(true);
  const handleArtFailure = useCallback(() => {
    setArtReady(false);
    setArtEnabled(false);
  }, []);
  const [mode, setMode] = useState<"move" | "shoot" | "pan">("move");
  const [destination, setDestination] = useState<Point | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [inspected, setInspected] = useState<string | null>(null);
  const [panel, setPanel] = useState<"journal" | "improvise" | null>(null);
  /** The combatant whose dossier is open. Their art is on file; the fight is not. */
  const [dossier, setDossier] = useState<string | null>(null);
  const [camera, setCamera] = useState({
    x: 0,
    y: 0,
    zoom: isCourtyard(live?.arena) ? 1.25 : 1,
  });
  const drag = useRef<Point | null>(null);
  const patternId = useId().replaceAll(":", "");
  useEffect(() => {
    if (dice) setPanel((current) => (current === "improvise" ? null : current));
  }, [dice]);
  /**
   * Every square this Move Action reaches, walked once by the engine.
   *
   * The highlight and the route come out of the same traversal, so a square
   * that lights up is a square the gate will accept — the board cannot offer
   * ground the rules refuse.
   */
  const moveField = useMemo(() => {
    if (!live || !capability || mode !== "move") return null;
    const you = Object.values(live.state.combatants).find((c) => c.isPlayer);
    const standing = you ? live.data[you.id] : null;
    if (!standing) return null;
    return movementField({
      arena: arenaFor(live.arena),
      cover: live.cover,
      from: standing.position,
      capability,
      occupied: Object.values(live.state.combatants).flatMap((c) =>
        c.isPlayer || c.defeated || !live.data[c.id] ? [] : [live.data[c.id]!.position],
      ),
    });
  }, [live, capability, mode]);
  /**
   * The squares in the reach field that no standing hostile has a line into.
   *
   * RED's cover is not a stance (pg. 182) — it is where you are standing — so
   * this is the same coverBlocking the attack gate reads, asked once per
   * square. It marks ground worth walking to rather than inventing a rule.
   */
  const sheltered = useMemo(() => {
    if (!live || !moveField) return null;
    const ground = arenaFor(live.arena);
    const hostiles = Object.values(live.state.combatants).flatMap((c) =>
      c.side === "hostile" && !c.defeated && live.data[c.id] ? [live.data[c.id]!.position] : [],
    );
    if (!hostiles.length) return null;
    const safe = new Set<string>();
    for (const { tile } of moveField.values()) {
      const centre = centreOf(tile);
      if (hostiles.every((at) => coverBlocking(ground, centre, at, live.cover).length > 0))
        safe.add(tileKey(tile));
    }
    return safe;
  }, [live, moveField]);
  if (!live) return null;
  const arena = arenaFor(live.arena);
  const courtyard = isCourtyard(arena.key);
  const scenic = courtyard && artEnabled && artReady;
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
  const weaponArt = weapon ? itemArt(`weapon.${weapon.itemId}`, weapon.name) : null;
  const targets = actors.filter(({ actor }) => !actor.isPlayer && !actor.defeated);
  const target = targets.find(({ actor }) => actor.id === selected) ?? targets[0];
  const shot =
    capability && weapon && target
      ? previewAttack(capability, target.actor.id, weapon.itemId)
      : null;
  const targetCover = capability?.targets.find((t) => t.id === target?.actor.id)?.coverLabel;
  const targetReadout = !shot
    ? "Select a usable weapon to assess this target."
    : shot.gap && targetCover
      ? `Blocked by ${targetCover}.`
      : (shot.gap ?? `${shot.distance} m · clear shot`);
  const spot = destination ?? hover;
  const spotTile = spot ? tileOf(arena, spot) : null;
  const spotSquares = spotTile ? moveField?.get(tileKey(spotTile))?.cost : undefined;
  const route =
    capability && player && spot
      ? previewMovement({
          arena,
          cover: live.cover,
          from: player.data.position,
          to: spot,
          capability,
          ...(moveField ? { field: moveField } : {}),
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
  const displayCamera = {
    ...camera,
    x: camera.x + effects.offset.x,
    y: camera.y + effects.offset.y,
  };
  const viewBox = `${550 - cameraWidth / 2 + displayCamera.x} ${340 - cameraHeight / 2 + displayCamera.y} ${cameraWidth} ${cameraHeight}`;
  const svgPoint = (svg: SVGSVGElement, e: { clientX: number; clientY: number }) => {
    const matrix = svg.getScreenCTM();
    return matrix ? new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse()) : null;
  };
  /** Where on the board this pointer is, as the centre of the square it hit. */
  const groundPoint = (svg: SVGSVGElement, e: { clientX: number; clientY: number }) => {
    const p = svgPoint(svg, e);
    if (!p) return null;
    const to = unproject(p);
    return to.x >= 0 && to.y >= 0 && to.x <= arena.extent.width && to.y <= arena.extent.height
      ? snapToGrid(arena, to)
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
  const playbackActor = playback?.actorId ? live.data[playback.actorId] : null;
  const impactPoint =
    playback?.aim ?? (playback?.targetId ? live.data[playback.targetId]?.position : null);
  const acting = playback?.actorId ? (live.state.combatants[playback.actorId] ?? active) : active;
  const playbackStatus = playback
    ? acting?.isPlayer
      ? "Your action"
      : `${acting?.side === "hostile" ? "Enemy" : "Ally"} turn · ${acting?.name ?? "Combatant"}`
    : null;
  const turnKey = `${live.id}:${live.state.round}:${active?.id}`;
  const dossierNpc = dossier ? findNpcNumbered(dossier) : null;
  return (
    <section
      className={`combat-screen ${scenic ? "combat-scenic" : ""}`}
      aria-label="Tactical combat"
    >
      <header className="combat-header">
        <div className="combat-brand">
          <span className="combat-lockup">
            <NightCityMark />
            <span className="combat-eyebrow">Combat</span>
          </span>
          <h1>{title ?? "Contact"}</h1>
          <p>{objective ?? arena.label}</p>
        </div>
        <div className="combat-header-tools">
          {tools}
          <button
            className="combat-icon"
            aria-label={effects.muted ? "Unmute combat sounds" : "Mute combat sounds"}
            aria-pressed={effects.muted}
            onClick={effects.toggleMute}
          >
            {effects.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <input
            className="combat-volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={effects.volume}
            onChange={(e) => effects.changeVolume(Number(e.target.value))}
            aria-label="Combat sound volume"
          />
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
        <div
          className={`combat-turn ${busy && !statusText ? "is-busy" : ""} ${acting?.side === "hostile" ? "is-enemy" : ""}`}
          key={turnKey}
        >
          <span className="combat-status-dot" />
          <strong aria-live={playback ? "off" : "polite"}>{playbackStatus ?? status}</strong>
          <span>ROUND {String(live.state.round).padStart(2, "0")}</span>
        </div>
        {!playback && (
          <span className="combat-mobile-budget">
            Move {remaining?.movementSquares ?? 0} sq ·{" "}
            {remaining?.action
              ? "Action ready"
              : remaining?.attacks
                ? `${remaining.attacks} shot left`
                : "Action spent"}
          </span>
        )}
        <ol className="combat-initiative" aria-label="Initiative order">
          {actors.map(({ actor }) => (
            <li
              key={actor.id}
              className={`${actor.id === acting?.id ? "is-active" : ""} ${actor.defeated ? "is-out" : ""}`}
            >
              <CombatPortrait
                name={actor.name}
                src={actor.isPlayer ? (playerPortrait ?? null) : undefined}
                hostile={actor.side === "hostile"}
              />
              {actor.isPlayer ? "YOU" : actor.name}
            </li>
          ))}
        </ol>
      </div>
      <div className="combat-main">
        <div className={`combat-stage mode-${mode}`}>
          {courtyard && artEnabled && (
            <CourtyardLayer
              key={arena.key}
              live={live}
              playback={playback}
              camera={displayCamera}
              aimTargetId={mode === "shoot" ? (target?.actor.id ?? null) : null}
              onReady={setArtReady}
              onFailure={handleArtFailure}
            />
          )}
          <div className="combat-map-caption">
            <span className="combat-eyebrow">{arena.label}</span>
            <span>
              {arena.extent.width} × {arena.extent.height} m
            </span>
          </div>
          <div className="combat-camera" aria-label="Camera controls">
            {courtyard && (
              <button
                className="combat-view-toggle"
                onClick={() => {
                  setArtEnabled(!artEnabled);
                  setArtReady(false);
                }}
                aria-pressed={artEnabled}
              >
                {artEnabled ? "Diagram view" : "Scenic view"}
              </button>
            )}
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
              onClick={() => setCamera({ x: 0, y: 0, zoom: courtyard ? 1.25 : 1 })}
            >
              <Maximize size={17} />
            </button>
          </div>
          <span className="sr-only" id={`${patternId}-keyboard`}>
            In Move mode, use arrow keys to preview a destination one square at a time, Enter to
            confirm, and Escape to clear. Targets and cover can also be selected with Tab and Enter.
          </span>
          <svg
            className={`combat-arena ${scenic ? "combat-arena-overlay" : ""}`}
            viewBox={viewBox}
            tabIndex={0}
            role="group"
            aria-describedby={`${patternId}-keyboard`}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget || mode !== "move" || !player) return;
              if (e.key === "Escape") {
                setDestination(null);
                setHover(null);
                setInspected(null);
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
              setInspected(null);
              // One square per press, so the keyboard walks the same lattice
              // the pointer does.
              setDestination(
                snapToGrid(arena, {
                  x: from.x + shift.x * TILE_METRES,
                  y: from.y + shift.y * TILE_METRES,
                }),
              );
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
            <g visibility={scenic ? "hidden" : undefined}>
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
            {scenic && (
              <polygon
                points={points(boardCorners)}
                fill="none"
                stroke="#9ac7cc"
                strokeOpacity=".22"
                strokeWidth="1"
                strokeDasharray="4 8"
                pointerEvents="none"
              />
            )}
            {mode === "move" && canAct && moveField && !!remaining?.movementSquares && (
              <g className="combat-squares" pointerEvents="none">
                {[...moveField.values()].map(({ tile, cost }) => {
                  if (cost === 0) return null;
                  const key = tileKey(tile);
                  return (
                    <polygon
                      key={key}
                      className={`combat-square ${sheltered?.has(key) ? "is-sheltered" : ""} ${
                        spotTile && tileKey(spotTile) === key ? "is-chosen" : ""
                      }`}
                      points={points(squareCorners(tile).map(project))}
                    />
                  );
                })}
              </g>
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
            {route?.ok && mode === "move" && spotTile && (
              <g pointerEvents="none">
                <polyline
                  points={points(route.path.map(project))}
                  fill="none"
                  className="combat-route"
                  markerEnd={`url(#${patternId}-arrow)`}
                />
                <polygon
                  className="combat-destination"
                  points={points(squareCorners(spotTile).map(project))}
                />
              </g>
            )}
            {/* Painter's order lets near objects cover far ones while unit labels remain upright. */}
            {[
              ...cover.map((piece) => ({
                key: piece.piece.id,
                depth: piece.destroyed
                  ? -500
                  : project({
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
                        if (piece.destroyed && mode === "move" && canAct && !dice) {
                          setDestination(groundPoint(e.currentTarget.ownerSVGElement!, e));
                          setInspected(null);
                        } else setInspected(piece.piece.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          if (piece.destroyed && mode === "move" && canAct && !dice) {
                            setDestination({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
                            setInspected(null);
                          } else setInspected(piece.piece.id);
                        }
                      }}
                    >
                      <polygon
                        points={points([...top, corners[2]!, corners[1]!, corners[0]!])}
                        fill="transparent"
                      />
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
                        y={scenic ? -88 : -65}
                        width="60"
                        height={scenic ? 100 : 77}
                        fill="transparent"
                      />
                      <ellipse
                        rx={chosen ? 21 : 15}
                        ry={chosen ? 11 : 8}
                        fill={`${color}20`}
                        stroke={color}
                        strokeWidth={chosen ? 2 : 1}
                      />
                      <g visibility={scenic ? "hidden" : undefined}>
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
                      </g>
                      <rect
                        x="-23"
                        y={scenic ? -94 : -62}
                        width="46"
                        height="4"
                        rx="1"
                        fill="#08131b"
                      />
                      <rect
                        x="-23"
                        y={scenic ? -94 : -62}
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
            {playback && impactPoint && playbackActor && (
              <g
                key={playback.sequence}
                className={
                  playback.animate === false
                    ? "combat-shot-playback no-motion"
                    : "combat-shot-playback"
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
                  x={project(impactPoint).x}
                  y={project(impactPoint).y - 78}
                  textAnchor="middle"
                  className="combat-impact"
                >
                  {playback.impact}
                </text>
              </g>
            )}
          </svg>
          {playback && onSkipPlayback && (
            <button className="combat-skip" onClick={onSkipPlayback}>
              <SkipForward size={14} /> Skip playback
            </button>
          )}
          {playback && (
            <div className="combat-playback-report" role="status" key={playback.sequence}>
              <span>{playbackHeading(playback)}</span>
              <p>{playback.text}</p>
            </div>
          )}
          <div className={`combat-map-hint ${feedback ? "has-feedback" : ""}`}>
            {feedback && !playback && (
              <p className="combat-feedback" role="status">
                {feedback}
              </p>
            )}
            {!playback && (
              <>
                <span className="combat-eyebrow">
                  {mode === "pan" ? "Camera" : mode === "shoot" ? "Targeting" : "Movement"}
                </span>
                {mode === "pan"
                  ? "Drag to look around"
                  : mode === "shoot"
                    ? "Select a target · review the shot"
                    : "Select a square · preview your route · confirm"}
              </>
            )}
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
              <p className="combat-eyebrow">
                {inspectedCover.thickness} {inspectedCover.material}
              </p>
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
                {route?.ok && spotSquares !== undefined ? spotSquares : "—"}
                <small>
                  squares
                  {route?.ok ? ` · ${route.moved} m` : ""}
                </small>
              </div>
              <p>
                {route?.ok
                  ? spotTile && sheltered?.has(tileKey(spotTile))
                    ? "Costs your Move. Nothing standing has a line into that square."
                    : "Costs your Move. Your Action budget stays unchanged."
                  : route && !route.ok
                    ? route.reason
                    : "Select a square."}
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
            <div className="combat-assessment combat-target-assessment">
              <div className="combat-target-identity">
                {findNpcNumbered(target.actor.name) ? (
                  <button
                    type="button"
                    className="combat-dossier-open"
                    onClick={() => setDossier(target.actor.name)}
                    aria-label={`Open dossier for ${target.actor.name}`}
                  >
                    <CombatPortrait
                      name={target.actor.name}
                      hostile={target.actor.side === "hostile"}
                    />
                  </button>
                ) : (
                  <CombatPortrait
                    name={target.actor.name}
                    src={target.actor.isPlayer ? (playerPortrait ?? null) : undefined}
                    hostile={target.actor.side === "hostile"}
                  />
                )}
                <div>
                  <span className="combat-eyebrow">Selected target</span>
                  <h2>{target.actor.name}</h2>
                </div>
              </div>
              <span className="combat-eyebrow">
                {target.actor.side} /{" "}
                {target.actor.woundState === "none"
                  ? "unwounded"
                  : target.actor.woundState.replaceAll("_", " ")}
              </span>
              <div className="combat-big-number">
                {shot?.dv ?? "—"}
                <small>range DV</small>
              </div>
              <p>{targetReadout}</p>
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
                  disabled={busy || !!dice}
                  className={target?.actor.id === actor.id ? "is-selected" : ""}
                  onClick={() => {
                    setSelected(actor.id);
                    selectMode("shoot");
                  }}
                >
                  <CombatPortrait name={actor.name} hostile={actor.side === "hostile"} />
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
        <div className="combat-operator">
          <CombatPortrait name={player?.actor.name ?? "Player"} src={playerPortrait ?? null} />
          <div className="combat-operator-info">
            <span className="combat-eyebrow">Your character</span>
            <strong>{player?.actor.name ?? "Player"}</strong>
            <span className="combat-vitals">
              {player?.actor.hp ?? "—"} / {player?.actor.hpMax ?? "—"} <small>HP</small>{" "}
              <span>SP {player?.actor.spBody ?? "—"}</span>
            </span>
            {player && (
              <progress aria-label="Health" value={player.actor.hp} max={player.actor.hpMax} />
            )}
            <span className="combat-condition">
              {player?.actor.woundState === "none"
                ? "Unwounded"
                : player?.actor.woundState.replaceAll("_", " ")}
            </span>
          </div>
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
              <small>
                {remaining?.movementSquares
                  ? `${remaining.movementSquares} squares · ${remaining.movement} m`
                  : "Spent"}
              </small>
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
            className="combat-improvise"
            onClick={() => setPanel("improvise")}
          >
            <MessageSquare />
            <span>
              Try something…<small>Your own idea</small>
            </span>
          </button>
        </div>
        <div className="combat-equipped">
          <div className="combat-weapon-art" aria-hidden="true">
            {weaponArt?.src && failedWeaponArt !== weaponArt.src ? (
              <img src={weaponArt.src} alt="" onError={() => setFailedWeaponArt(weaponArt.src)} />
            ) : (
              <Crosshair />
            )}
          </div>
          <label>
            <span className="combat-eyebrow">Equipped weapon</span>
            <select
              aria-label="Weapon"
              value={weapon?.itemId ?? ""}
              disabled={busy || !!dice}
              onChange={(e) => onWeaponId(e.target.value)}
            >
              {!weapon && <option value="">No weapon</option>}
              {capability?.weapons.map((w) => (
                <option key={w.itemId} value={w.itemId}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <div className="combat-weapon-stats">
            <span>
              <small>DMG</small> {weapon?.damageDice ? `${weapon.damageDice}d6` : "—"}
            </span>
            <span>
              <small>ROF</small> {weapon?.rof ?? "—"}
            </span>
            <span>
              <small>AMMO</small>{" "}
              {weapon?.roundsLoaded != null
                ? `${weapon.roundsLoaded}/${weapon.magazine ?? "—"}`
                : "—"}
            </span>
          </div>
        </div>
        <button
          className="combat-end"
          disabled={!canAct || !!dice || !onEndTurn}
          onClick={onEndTurn}
        >
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
      {dossierNpc && (
        <NpcDossier
          npc={dossierNpc}
          open={true}
          onOpenChange={(open) => {
            if (!open) setDossier(null);
          }}
        />
      )}
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
