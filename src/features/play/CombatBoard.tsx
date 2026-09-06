import { CombatPortrait } from "./CombatPortrait";
import { BattlefieldCallout } from "./BattlefieldCallout";
import { useBoardAnchor } from "./useBoardAnchor";
import {
  IDLE,
  interactionOf,
  lockedTarget,
  nextInteraction,
  readTarget,
  readTile,
  type Interaction,
  type InteractionEvent,
} from "./combatInteraction";
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
  blockedTiles,
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
  /**
   * Looking versus doing. Panning is a way of seeing the board, so it must not
   * throw away a route the player has already chosen — which is why it is a
   * tool rather than an interaction state.
   */
  const [tool, setTool] = useState<"select" | "pan">("select");
  const [intent, setIntent] = useState<Interaction>(IDLE);
  const [inspected, setInspected] = useState<string | null>(null);
  /**
   * Who the readout is about, resolved before the early return so the firing
   * analysis below keeps its hook order.
   *
   * Falls back to the first standing hostile the same way the inspector does.
   * Without that the panel would describe somebody the analysis had never
   * looked at, and offer a dead disabled button instead of a way out.
   */
  const assessedId =
    readTarget(interactionOf(intent, !!dice)) ??
    Object.values(live?.state.combatants ?? {}).find((c) => !c.isPlayer && !c.defeated)?.id ??
    null;
  const weaponForField = weaponId;
  const boardRef = useRef<SVGSVGElement | null>(null);
  const calloutPoint = useRef<Point | null>(null);
  const calloutAnchor = useBoardAnchor(boardRef, calloutPoint);
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
    if (!live || !capability) return null;
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
  }, [live, capability]);
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
  /**
   * Squares this Move reaches that can actually see the target being aimed at.
   *
   * The same previewAttack the shot button reads, asked once per reachable
   * square with the capability re-measured from there — so a square lights up
   * only if the gate would accept a shot taken standing on it. No LOS or range
   * arithmetic is reimplemented here.
   */
  const firingTiles = useMemo(() => {
    if (!live || !capability || !moveField || !assessedId || !weaponForField) return null;
    const found = new Map<string, { tile: Tile; dv: number | null }>();
    for (const { tile } of moveField.values()) {
      const at = centreOf(tile);
      const there = { ...capability, targets: targetCapabilities(live, at) };
      const preview = previewAttack(there, assessedId, weaponForField);
      if (!preview.gap) found.set(tileKey(tile), { tile, dv: preview.dv });
    }
    return found;
  }, [live, capability, moveField, assessedId, weaponForField]);
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
  /**
   * Whose Round it is. Looking at the board — hovering squares, reading a
   * target, previewing a route — is allowed for the whole of it.
   */
  const canAct = !!active?.isPlayer && !player?.actor.defeated && live.state.status === "active";
  /**
   * Whether a command may actually be SENT right now.
   *
   * Separate from canAct on purpose. `busy` covers a write in flight, a
   * playback still running and a query refetching — all transient, none of
   * them a reason to take the board away from the player. Conflating the two
   * meant one stuck flag left the whole screen inert: no squares, every click
   * swallowed, no target lockable and therefore no shot possible.
   */
  const canCommit = canAct && !busy && !dice;
  const weapon = raisedWeapon(capability, weaponId);
  const weaponArt = weapon ? itemArt(`weapon.${weapon.itemId}`, weapon.name) : null;
  const targets = actors.filter(({ actor }) => !actor.isPlayer && !actor.defeated);
  // Only a card demanding a roll takes the board out of play. A write in
  // flight refuses commits (canCommit) but must not stop the player looking.
  const resolving = !!dice;
  const interaction = interactionOf(intent, resolving);
  const pointedId = readTarget(interaction);
  const lockedId = lockedTarget(interaction);
  /** Who the sidebar describes. It is an inspector, so it always describes somebody. */
  const target = targets.find(({ actor }) => actor.id === assessedId) ?? targets[0];
  /** Who the BOARD is drawing a line to. Only ever somebody actually pointed at. */
  const aimed = pointedId ? targets.find(({ actor }) => actor.id === pointedId) : undefined;
  const shot =
    capability && weapon && target
      ? previewAttack(capability, target.actor.id, weapon.itemId)
      : null;
  const targetCover = capability?.targets.find((t) => t.id === target?.actor.id)?.coverLabel;
  // Told apart, because they lead to different offers: blocked ground can be
  // walked around, and distance can be closed, but they are not the same fix.
  const blockedByCover = shot?.verdict.ok === false && shot.verdict.code === "target_not_perceived";
  const outOfRange = shot?.verdict.ok === false && shot.verdict.code === "out_of_range";
  /** The piece standing in the way, so the board can point at it. */
  const blocker =
    blockedByCover && player && target
      ? (coverBlocking(arena, player.data.position, target.data.position, live.cover)[0] ?? null)
      : null;
  const spotTile = readTile(interaction);
  const spot = spotTile ? centreOf(spotTile) : null;
  const spotSquares = spotTile ? moveField?.get(tileKey(spotTile))?.cost : undefined;
  const canMove = canAct && !!moveField && !!remaining?.movementSquares;
  const showSquares = canMove && interaction.type !== "resolving-action";
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
  const dispatch = (event: InteractionEvent) => {
    setIntent((current) => nextInteraction(interactionOf(current, resolving), event));
    if (event.kind !== "hover-tile" && event.kind !== "hover-unit") setInspected(null);
  };
  const sameSquare = (tile: Tile) =>
    interaction.type === "move-preview" &&
    interaction.tile.col === tile.col &&
    interaction.tile.row === tile.row;

  /**
   * The one place a move is sent.
   *
   * Every route into it — the callout, a second click on the square, Enter —
   * lands here, and it refuses while a command is running, so nothing can be
   * committed twice by an event arriving through two paths.
   */
  const confirmMove = () => {
    if (!canCommit || !route?.ok || interaction.type !== "move-preview" || !onMoveTo) return;
    onMoveTo(route.position);
    dispatch({ kind: "moved" });
  };
  /** The one place a shot is sent. Selecting a target never comes through here. */
  const confirmShot = () => {
    if (!canCommit || !weapon || !onAttack) return;
    const id = lockedId;
    if (!id) return;
    const preview = capability ? previewAttack(capability, id, weapon.itemId) : null;
    if (!preview || preview.gap) return;
    onAttack(id, weapon.itemId);
    dispatch({ kind: "fired" });
  };
  /** Enter and Space: commit whatever is currently previewed. Route first. */
  const confirmCurrent = () => {
    if (interaction.type === "move-preview") confirmMove();
    else confirmShot();
  };
  const clickSquare = (tile: Tile) => {
    // A second click on the square already previewed is the commit. Checked
    // before dispatching, because the reducer treats it as a no-op.
    if (sameSquare(tile)) confirmMove();
    else dispatch({ kind: "click-tile", tile });
  };
  const clickUnit = (id: string) => {
    if (interaction.type === "target-selected" && interaction.targetId === id) confirmShot();
    else dispatch({ kind: "click-unit", targetId: id });
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
  /** Why a commit is refused this instant. Shown instead of nothing happening. */
  const waitingWhy = dice
    ? "Resolve the roll first"
    : busy
      ? "Waiting on the last action"
      : undefined;
  /** What the board is doing, in the player's words. One line per state. */
  const [hintTitle, hintBody] =
    tool === "pan"
      ? ["Camera", "Drag to look around"]
      : interaction.type === "resolving-action"
        ? ["Resolving", "Waiting on the dice"]
        : !canCommit && canAct && waitingWhy
          ? ["Waiting", waitingWhy]
          : interaction.type === "find-firing-position"
            ? [
                "Finding a shot",
                firingTiles?.size
                  ? "Lit squares can see them · pick one to preview the route"
                  : "Nowhere in reach can see them this Round",
              ]
            : interaction.type === "move-preview"
              ? ["Movement", "Click the square again, or press Enter, to go"]
              : interaction.type === "target-selected"
                ? shot?.gap
                  ? ["Targeting", "No shot from here · find a firing position"]
                  : ["Targeting", "Click them again, or press Enter, to shoot"]
                : interaction.type === "target-hover"
                  ? ["Targeting", "Click to lock this target"]
                  : ["Movement", "Hover a square to preview · click to lock it in"];
  /**
   * The lit ground, described once for whichever renderer is drawing it.
   *
   * While looking for a firing position, a square that can see the target is
   * the point and everything else is context, so the rest is marked spent
   * rather than removed — the player can still see how far they could go.
   */
  const scouting = interaction.type === "find-firing-position";
  /** Squares nobody can stand on — the engine's answer, not the art's outline. */
  const blockedSquares = blockedTiles(arena, live.cover);
  const litSquares = showSquares
    ? [...moveField!.values()].flatMap(({ tile, cost }) => {
        if (cost === 0) return [];
        const key = tileKey(tile);
        return [
          {
            tile,
            key,
            sheltered: sheltered?.has(key) ?? false,
            firing: scouting && !!firingTiles?.has(key),
            faded: scouting && !firingTiles?.has(key),
          },
        ];
      })
    : [];
  /**
   * Where the contextual control hangs.
   *
   * The destination when a route is on the table, otherwise the body being
   * aimed at — always the thing the control acts on, never a fixed corner.
   */
  calloutPoint.current =
    (interaction.type === "move-preview" || scouting) && spot
      ? { x: project(spot).x, y: project(spot).y - 14 }
      : aimed
        ? { x: project(aimed.data.position).x, y: project(aimed.data.position).y - 64 }
        : null;
  /**
   * What the contextual control says and whether it commits anything.
   *
   * Every refusal here names a reason. A control that is simply absent, or
   * present and dead, teaches the player nothing about the fight.
   */
  const callout: {
    tone: "move" | "shoot" | "blocked";
    title: string;
    lines: string[];
    hint?: string | undefined;
    confirm?: (() => void) | undefined;
    scout?: boolean | undefined;
  } | null = (() => {
    if (!canAct || interaction.type === "resolving-action") return null;
    // Hovering a candidate firing square reads exactly like hovering any
    // other square, plus the answer to the question that put us here: can I
    // shoot from there, and at what DV.
    if (interaction.type === "move-preview" || (scouting && spotTile)) {
      if (!route?.ok)
        return {
          tone: "blocked",
          title: "Can't move here",
          lines: [route?.reason ?? "No route to that square."],
        };
      const cover = spotTile && sheltered?.has(tileKey(spotTile)) ? "Out of their line" : "Exposed";
      const lines = [`${spotSquares ?? "—"} Move · ${route.moved} m`, cover];
      if (futureShot && target)
        lines.push(
          futureShot.gap
            ? `No shot at ${target.actor.name} from here`
            : `Shot from here · DV ${futureShot.dv}`,
        );
      return {
        tone: "move",
        title: "Move here",
        lines,
        // Never a silent refusal: if the route is locked but the write queue is
        // still busy, the plate says that rather than doing nothing.
        ...(interaction.type !== "move-preview"
          ? {}
          : canCommit
            ? { confirm: onMoveTo ? confirmMove : undefined }
            : { hint: waitingWhy }),
      };
    }
    if (!aimed) return null;
    if (!weapon)
      return { tone: "blocked", title: "No weapon", lines: ["Nothing raised to shoot with."] };
    if (blockedByCover)
      return {
        tone: "blocked",
        title: "No shot",
        lines: [`Blocked by ${targetCover ?? "cover"}`],
        scout: !scouting && !!firingTiles?.size && canMove,
      };
    if (outOfRange)
      return {
        tone: "blocked",
        title: "Out of range",
        lines: [`${shot?.distance ?? "—"} m · past the ${weapon.name}'s table`],
        scout: !scouting && !!firingTiles?.size && canMove,
      };
    if (shot?.gap) return { tone: "blocked", title: "No shot", lines: [shot.gap] };
    return {
      tone: "shoot",
      title: "Shoot",
      lines: [weapon.name, `DV ${shot?.dv ?? "—"} · ${shot?.distance ?? "—"} m`],
      ...(lockedId !== aimed.actor.id
        ? { hint: "Click to lock the target" }
        : canCommit
          ? { confirm: onAttack ? confirmShot : undefined }
          : { hint: waitingWhy }),
    };
  })();
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
        <div className={`combat-stage tool-${tool}`}>
          {courtyard && artEnabled && (
            <CourtyardLayer
              key={arena.key}
              live={live}
              playback={playback}
              camera={displayCamera}
              aimTargetId={aimed?.actor.id ?? null}
              // Over the art the squares belong ON the floor, under everything
              // standing on it, so the scene draws them rather than the SVG.
              grid={
                scenic && showSquares
                  ? {
                      squares: litSquares,
                      chosen: route?.ok ? spotTile : null,
                      route: route?.ok ? route.path : null,
                    }
                  : null
              }
              onReady={setArtReady}
              onFailure={handleArtFailure}
            />
          )}
          {/* The art loads in a beat or two. Showing the wireframe underneath
              while it does reads as the screen changing its mind, so hold a
              deliberate one until the feed is up — and drop it, uncovering the
              diagram for real, if the renderer never arrives. */}
          {courtyard && artEnabled && (
            <div
              className={`combat-boot ${artReady ? "is-live" : ""}`}
              role="status"
              aria-live="polite"
              {...(artReady ? { "aria-hidden": true } : {})}
            >
              <span className="combat-boot-scan" aria-hidden="true" />
              <span className="combat-boot-label">
                <span className="combat-eyebrow">Establishing feed</span>
                <strong>{arena.label}</strong>
              </span>
            </div>
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
              className={`combat-icon ${tool === "pan" ? "is-selected" : ""}`}
              aria-label="Pan battlefield"
              aria-pressed={tool === "pan"}
              onClick={() => setTool(tool === "pan" ? "select" : "pan")}
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
            Arrow keys preview a destination one square at a time. Enter or Space confirms the
            previewed move, or takes the shot at the selected target. Escape steps back. Targets and
            cover can also be reached with Tab.
          </span>
          <svg
            ref={boardRef}
            className={`combat-arena ${scenic ? "combat-arena-overlay" : ""}`}
            viewBox={viewBox}
            tabIndex={0}
            role="group"
            aria-describedby={`${patternId}-keyboard`}
            onKeyDown={(e) => {
              // Escape steps back from wherever focus is; a unit or a crate
              // having been tabbed to must not swallow the way out.
              if (e.key === "Escape") {
                dispatch({ kind: "cancel" });
                return;
              }
              // The rest is the board's own keyboard. Focusable children run
              // their own Enter and stop it before it reaches here.
              if (e.target !== e.currentTarget || !player) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                confirmCurrent();
                return;
              }
              const shifts: Record<string, Point> = {
                ArrowUp: { x: 0, y: 1 },
                ArrowDown: { x: 0, y: -1 },
                ArrowLeft: { x: -1, y: 0 },
                ArrowRight: { x: 1, y: 0 },
              };
              const shift = shifts[e.key];
              if (!shift || !canMove) return;
              e.preventDefault();
              const from = spot ?? player.data.position;
              // One square per press, so the keyboard walks the same lattice
              // the pointer does. Arrowing is previewing, never committing.
              dispatch({
                kind: "click-tile",
                tile: tileOf(arena, {
                  x: from.x + shift.x * TILE_METRES,
                  y: from.y + shift.y * TILE_METRES,
                }),
              });
            }}
            aria-label={`Angled battlefield: ${arena.label}. Select units or ground to preview an action.`}
            onContextMenu={(e) => {
              // Right-click is back one level, not a browser menu.
              e.preventDefault();
              dispatch({ kind: "cancel" });
            }}
            onPointerDown={(e) => {
              if (tool === "pan") {
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
              if (e.pointerType !== "mouse" || tool !== "select" || !canMove) return;
              const at = groundPoint(e.currentTarget, e);
              dispatch(
                at ? { kind: "hover-tile", tile: tileOf(arena, at) } : { kind: "leave-board" },
              );
            }}
            onPointerLeave={() => dispatch({ kind: "leave-board" })}
            onClick={(e) => {
              if (tool !== "select" || !canMove) return;
              const at = groundPoint(e.currentTarget, e);
              if (at) clickSquare(tileOf(arena, at));
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
            {showSquares && !scenic && (
              <g className="combat-squares" pointerEvents="none">
                {litSquares.map(({ tile, key, sheltered: safe, firing, faded }) => (
                  <polygon
                    key={key}
                    className={`combat-square ${safe ? "is-sheltered" : ""} ${
                      firing ? "is-firing" : ""
                    } ${faded ? "is-faded" : ""} ${
                      spotTile && tileKey(spotTile) === key ? "is-chosen" : ""
                    }`}
                    points={points(squareCorners(tile).map(project))}
                  />
                ))}
              </g>
            )}
            {/* The line of the shot. Amber and solid when it exists, red and
                broken when it does not — the dash carries the meaning as well
                as the colour, so it survives being colour-blind or dimmed. */}
            {player && aimed && (
              <line
                className={`combat-los ${shot?.gap ? "is-blocked" : "is-clear"}`}
                x1={project(player.data.position).x}
                y1={project(player.data.position).y - 15}
                x2={project(aimed.data.position).x}
                y2={project(aimed.data.position).y - 15}
                pointerEvents="none"
              />
            )}
            {route?.ok && spotTile && !scenic && (
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
                        // A standing crate is drawn as a box, so its clickable
                        // shape overhangs the squares behind it. Ground the
                        // player can actually stand on wins: the board is the
                        // control surface, and inspecting is the fallback.
                        const at = canMove
                          ? groundPoint(e.currentTarget.ownerSVGElement!, e)
                          : null;
                        const square = at ? tileOf(arena, at) : null;
                        if (square && !blockedSquares.has(tileKey(square))) clickSquare(square);
                        else setInspected(piece.piece.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          if (piece.destroyed && canMove)
                            clickSquare(tileOf(arena, { x: r.x + 1, y: r.y + 1 }));
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
                          <text
                            x={(corners[0]!.x + corners[2]!.x) / 2}
                            y={corners[0]!.y - lift - 10}
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
                  const takeable = !actor.isPlayer && !actor.defeated;
                  const locked = lockedId === actor.id;
                  const chosen = pointedId === actor.id;
                  return (
                    <g
                      transform={`translate(${p.x},${p.y})`}
                      className={`combat-unit ${actor.defeated ? "is-out" : ""} ${
                        locked ? "is-locked" : ""
                      }`}
                      role="button"
                      tabIndex={0}
                      aria-label={
                        actor.isPlayer
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
                        if (takeable) dispatch({ kind: "hover-unit", targetId: actor.id });
                      }}
                      onPointerLeave={(e) => {
                        e.stopPropagation();
                        if (takeable) dispatch({ kind: "leave-unit" });
                      }}
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
                        y={scenic ? -88 : -65}
                        width="60"
                        height={scenic ? 100 : 77}
                        fill="transparent"
                      />
                      <ellipse
                        rx={locked ? 18 : 15}
                        ry={locked ? 9 : 8}
                        fill={`${color}20`}
                        stroke={color}
                        strokeWidth={locked ? 2 : 1}
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
                      {/* Brackets around the person, not a box around a
                          rectangle: they close in when the target is locked,
                          so hovering and choosing read differently. */}
                      {(chosen || locked) && (
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
          {callout && (
            <BattlefieldCallout
              anchor={calloutAnchor}
              tone={callout.tone}
              title={callout.title}
              lines={callout.lines}
              hint={callout.hint}
              onConfirm={callout.confirm}
            >
              {callout.scout && (
                <button
                  type="button"
                  className="combat-callout-scout"
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ kind: "find-firing-position" });
                  }}
                >
                  Find firing position
                </button>
              )}
            </BattlefieldCallout>
          )}
          <div className={`combat-map-hint ${feedback ? "has-feedback" : ""}`}>
            {feedback && !playback && (
              <p className="combat-feedback" role="status">
                {feedback}
              </p>
            )}
            {!playback && (
              <>
                <span className="combat-eyebrow">{hintTitle}</span>
                {hintBody}
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
                  : spotTile
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
          ) : spotTile ? (
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
              {/* The battlefield is where a move is confirmed. This is the
                  keyboard-and-screen-reader path to the same one command, not
                  a second way of committing it. */}
              <button
                className="combat-confirm"
                disabled={
                  interaction.type !== "move-preview" || !canCommit || !route?.ok || !onMoveTo
                }
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
              {blockedByCover ? (
                <div className="combat-obstruction">
                  <strong>No line of sight</strong>
                  <p>
                    Blocked by
                    <br />
                    <b>{targetCover ?? "something in the way"}</b>
                  </p>
                </div>
              ) : outOfRange ? (
                <div className="combat-obstruction">
                  <strong>Out of range</strong>
                  <p>
                    {shot?.distance} m with the {weapon?.name ?? "weapon"}. The printed table stops
                    short of that.
                  </p>
                </div>
              ) : (
                <p>
                  {!shot
                    ? "Select a usable weapon to assess this target."
                    : (shot.gap ?? `${shot.distance} m · clear shot`)}
                </p>
              )}
              <div className="combat-target-stats">
                <span>
                  {target.actor.hp}/{target.actor.hpMax} HP
                </span>
                <span>
                  <Shield size={13} /> SP {target.actor.spBody}
                </span>
              </div>
              {shot?.gap && firingTiles && firingTiles.size > 0 ? (
                // A dead-end disabled button teaches nothing. This says what to
                // do about it, and the board answers by lighting the ground.
                <button
                  className="combat-confirm is-scout"
                  onClick={() => dispatch({ kind: "find-firing-position" })}
                  disabled={!canMove}
                >
                  Find firing position <Footprints size={16} />
                </button>
              ) : (
                <button
                  className="combat-confirm is-fire"
                  disabled={
                    lockedId !== target.actor.id || !canCommit || !!shot?.gap || !shot || !onAttack
                  }
                  onClick={confirmShot}
                >
                  Take shot <Crosshair size={16} />
                </button>
              )}
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
                  disabled={resolving}
                  className={lockedId === actor.id ? "is-selected" : ""}
                  onClick={() => clickUnit(actor.id)}
                  onPointerEnter={() => dispatch({ kind: "hover-unit", targetId: actor.id })}
                  onPointerLeave={() => dispatch({ kind: "leave-unit" })}
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
          {/* The dock reads the Turn's economy and offers a shortcut into each
              action. It is no longer a mode switch: the board is always live
              for both, so neither of these has to be pressed first. */}
          <button
            className={spotTile ? "is-selected" : ""}
            disabled={!canMove}
            onClick={() => dispatch({ kind: "cancel" })}
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
            className={lockedId ? "is-selected" : ""}
            disabled={!canAct || resolving || !onAttack || !targets.length}
            onClick={() => {
              const next = targets[0];
              if (next) dispatch({ kind: "click-unit", targetId: next.actor.id });
            }}
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
