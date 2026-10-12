import { composedUnitMetrics, intersectionActionCamera } from "./courtyard/courtyardPresentation";
import { battlefieldFor } from "@/engine";
import { BattlefieldCallout } from "./BattlefieldCallout";
import { useBoardAnchor } from "./useBoardAnchor";
import {
  IDLE,
  interactionOf,
  lockedTarget,
  dispatchInteraction,
  readTarget,
  readTile,
  type Interaction,
  type InteractionEvent,
} from "./combatInteraction";
import { findNpcNumbered } from "@/features/cast/npcDirectory";
import { itemArt } from "@/features/chargen/art";
import { useCombatFeedback } from "./useCombatFeedback";
import { playbackHeading, compactCombatFeedback } from "./combatFeedback";
import { scenicTheme } from "./courtyard/scenicPresentation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { boardOutline, squaresOutline } from "./overlayModel";
import { activityOccluders } from "./courtyard/activityReveal";
import { Crosshair, SkipForward } from "lucide-react";
import {
  blockedTiles,
  centreOf,
  shotObstacles,
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
import type { PlaybackFrame } from "./combatPlayback";
import type { ReflectionMode } from "./courtyard/groundReflection";
import { framingPoints, points, squareCorners } from "./combatBoard/boardGeometry";
import { CombatHeader } from "./combatBoard/CombatHeader";
import { TurnStrip } from "./combatBoard/TurnStrip";
import { ScenicFeed } from "./combatBoard/ScenicFeed";
import { CameraControls } from "./combatBoard/CameraControls";
import { BoardDefs, DiagramFloor, MoveSquares, ShotPlayback } from "./combatBoard/BoardLayers";
import { ActorUnit, CoverPieceView } from "./combatBoard/BoardPieces";
import { ActorMarkersLayer } from "./combatBoard/ActorMarkersLayer";
import { CombatReadout } from "./combatBoard/CombatReadout";
import { CombatCommand } from "./combatBoard/CombatCommand";
import { CombatDialogs } from "./combatBoard/CombatDialogs";
import "./combat.css";
import "./combatLayout.css";

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
  openingRequest?: ReactNode;
  openingRecap?: ReactNode;
  playback?: PlaybackFrame | null;
  feedback?: string | undefined;
  feedbackDetail?: string | undefined;
  onSkipPlayback?: () => void;
  revealActivity?: boolean;
  /** Scenic light and emissive surfaces; the review harness turns it off to judge the art. */
  lights?: boolean;
  /** The night's ambient; the review harness turns it off to inspect the materials. */
  night?: boolean;
  /** The shop corner's reflections; the review harness switches them to compare. */
  reflections?: ReflectionMode;
  /** Where the camera starts, instead of the scene's preset: a repeatable framing. */
  initialCamera?: { x: number; y: number; zoom: number };
  onRevealActivityChange?: (reveal: boolean) => void;
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
  openingRequest,
  openingRecap,
  playback,
  feedback,
  feedbackDetail,
  onSkipPlayback,
  revealActivity: controlledRevealActivity,
  lights,
  night,
  reflections,
  initialCamera,
  onRevealActivityChange,
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
  const [localRevealActivity, setLocalRevealActivity] = useState(true);
  const revealActivity = controlledRevealActivity ?? localRevealActivity;
  const setRevealActivity = onRevealActivityChange ?? setLocalRevealActivity;
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
  // under the feet (or the square): where the card goes when there is no room above
  const calloutFoot = useRef<Point | null>(null);
  const calloutUnder = useBoardAnchor(boardRef, calloutFoot);
  const [readoutOpen, setReadoutOpen] = useState(() => {
    // Keep the first-turn initiative recap visible when opponents acted first.
    const active = live && currentCombatant(live.state);
    return !!(
      live?.origin &&
      live.state.round === 1 &&
      active?.isPlayer &&
      live.state.order
        .slice(0, live.state.order.indexOf(active.id))
        .some((id) => live.state.combatants[id]?.side === "hostile")
    );
  });
  // A pending roll or opening request must never disappear behind a disclosure.
  const readoutRequired = !!dice || !!openingRequest;
  const showReadout = readoutOpen || readoutRequired;
  const readoutId = useId();
  const [panel, setPanel] = useState<"journal" | "improvise" | null>(null);
  /** The combatant whose dossier is open. Their art is on file; the fight is not. */
  const [dossier, setDossier] = useState<string | null>(null);
  const [manualCamera, setCamera] = useState<{ x: number; y: number; zoom: number } | null>(
    initialCamera ?? null,
  );
  const [actionFrame, setActionFrame] = useState(() => ({
    id: live?.id,
    points: framingPoints(live),
  }));
  // A new encounter gets a fresh composition. Within it, movement/playback never
  // chases the camera; only an explicit reset takes another participant snapshot.
  if (actionFrame.id !== live?.id) {
    setActionFrame({ id: live?.id, points: framingPoints(live) });
    setCamera(initialCamera ?? null);
  }
  const drag = useRef<Point | null>(null);
  const patternId = useId().replaceAll(":", "");
  /** The board's size on screen: actor markers are drawn in screen pixels from it. */
  const [boardSize, setBoardSize] = useState({ width: 1100, height: 680 });
  /** Who is under the pointer, and who holds keyboard focus: both reveal detail. */
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const boardMounted = !!live;
  useEffect(() => {
    const el = boardRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width && height) setBoardSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [boardMounted]);
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
      arena: battlefieldFor(live),
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
    const ground = battlefieldFor(live);
    const hostiles = Object.values(live.state.combatants).flatMap((c) =>
      c.side === "hostile" && !c.defeated && live.data[c.id] ? [live.data[c.id]!.position] : [],
    );
    if (!hostiles.length) return null;
    const safe = new Set<string>();
    for (const { tile } of moveField.values()) {
      const centre = centreOf(tile);
      if (hostiles.every((at) => shotObstacles(ground, centre, at, live.cover).length > 0))
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
  const arena = battlefieldFor(live);
  const theme = scenicTheme(arena);
  const camera =
    manualCamera ??
    (arena.environment
      ? intersectionActionCamera(arena, actionFrame.points, boardSize)
      : { x: 0, y: 0, zoom: theme ? 1.25 : 1 });
  const hasScenicArt = theme !== null;
  const scenicUnitTop =
    theme === "composed" ? composedUnitMetrics(arena).top : theme === "street" ? 58 : 88;
  const scenic = hasScenicArt && artEnabled && artReady;
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
  const canResume =
    !!live.origin &&
    !!active &&
    !active.isPlayer &&
    !player?.actor.defeated &&
    live.state.status === "active";
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
      ? (shotObstacles(arena, player.data.position, target.data.position, live.cover)[0] ?? null)
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
  // The board's edge, less where it would be printed across a building (overlayModel).
  const edgeRuns = scenic
    ? boardOutline(
        arena.extent,
        arena.environment?.structures ?? [],
        revealActivity ? activityOccluders(arena) : undefined,
      )
    : [];
  const cameraWidth = 1100 / camera.zoom,
    cameraHeight = 680 / camera.zoom;
  const displayCamera = {
    ...camera,
    x: camera.x + effects.offset.x,
    y: camera.y + effects.offset.y,
  };
  const viewBox = `${550 - cameraWidth / 2 + displayCamera.x} ${340 - cameraHeight / 2 + displayCamera.y} ${cameraWidth} ${cameraHeight}`;
  /**
   * Screen pixels per scene unit, as the SVG is drawn (it fits the viewBox into the
   * board, centred). Text and bars drawn at `scale(ui)` are one size on screen at
   * every camera zoom; everything else stays in the scene.
   */
  const pxPerUnit = Math.min(boardSize.width / cameraWidth, boardSize.height / cameraHeight);
  const ui = 1 / pxPerUnit;
  const viewOrigin = {
    x: 550 - cameraWidth / 2 + displayCamera.x,
    y: 340 - cameraHeight / 2 + displayCamera.y,
  };
  const viewPad = {
    x: (boardSize.width - cameraWidth * pxPerUnit) / 2,
    y: (boardSize.height - cameraHeight * pxPerUnit) / 2,
  };
  const toScreen = (p: Point) => ({
    x: (p.x - viewOrigin.x) * pxPerUnit + viewPad.x,
    y: (p.y - viewOrigin.y) * pxPerUnit + viewPad.y,
  });
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
    setIntent((current) => dispatchInteraction(current, event, resolving));
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
  /** The edge of everything this Move Action reaches, the player's own square included. */
  const reachEdge = showSquares ? squaresOutline([...moveField!.values()].map((m) => m.tile)) : [];
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
      ? { x: project(spot).x, y: project(spot).y - 18 * ui }
      : aimed
        ? {
            x: project(aimed.data.position).x,
            // above the head and the name marker over it, in screen pixels
            y: project(aimed.data.position).y - (scenic ? scenicUnitTop + 4 : 68) - 50 * ui,
          }
        : null;
  calloutFoot.current =
    (interaction.type === "move-preview" || scouting) && spot
      ? { x: project(spot).x, y: project(spot).y + 18 * ui }
      : aimed
        ? { x: project(aimed.data.position).x, y: project(aimed.data.position).y + 10 * ui }
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
  const frameAction = () => {
    setActionFrame({ id: live.id, points: framingPoints(live) });
    setCamera(null);
  };
  const offscreenActors =
    arena.environment?.recipe === "intersection"
      ? actors.filter(({ actor, data }) => {
          if (actor.defeated) return false;
          const p = toScreen(project(data.position));
          const head = p.y - scenicUnitTop * pxPerUnit;
          return p.x < 16 || p.x > boardSize.width - 16 || head < 0 || p.y > boardSize.height - 16;
        }).length
      : 0;
  const turnKey = `${live.id}:${live.state.round}:${active?.id}`;
  const dossierNpc = dossier ? findNpcNumbered(dossier) : null;
  return (
    <section
      className={`combat-screen ${scenic ? "combat-scenic" : ""}`}
      aria-label="Tactical combat"
    >
      <CombatHeader
        title={title}
        objective={objective}
        arena={arena}
        tools={tools}
        effects={effects}
        setPanel={setPanel}
      />
      <TurnStrip
        busy={busy}
        statusText={statusText}
        acting={acting}
        turnKey={turnKey}
        playback={playback}
        playbackStatus={playbackStatus}
        status={status}
        remaining={remaining}
        showReadout={showReadout}
        readoutId={readoutId}
        readoutRequired={readoutRequired}
        readoutOpen={readoutOpen}
        setReadoutOpen={setReadoutOpen}
        dice={dice}
        openingRequest={openingRequest}
        targets={targets}
        actors={actors}
        playerPortrait={playerPortrait}
        live={live}
      />
      <div className={`combat-main ${showReadout ? "has-readout" : ""}`}>
        <div className={`combat-stage tool-${tool}`}>
          <ScenicFeed
            hasScenicArt={hasScenicArt}
            artEnabled={artEnabled}
            artReady={artReady}
            arena={arena}
            live={live}
            revealActivity={revealActivity}
            lights={lights}
            night={night}
            reflections={reflections}
            playback={playback}
            displayCamera={displayCamera}
            aimed={aimed}
            scenic={scenic}
            showSquares={showSquares}
            litSquares={litSquares}
            route={route}
            spotTile={spotTile}
            interaction={interaction}
            reachEdge={reachEdge}
            setArtReady={setArtReady}
            handleArtFailure={handleArtFailure}
          />
          <CameraControls
            arena={arena}
            hasScenicArt={hasScenicArt}
            artEnabled={artEnabled}
            setArtEnabled={setArtEnabled}
            setArtReady={setArtReady}
            revealActivity={revealActivity}
            setRevealActivity={setRevealActivity}
            camera={camera}
            setCamera={setCamera}
            tool={tool}
            setTool={setTool}
            frameAction={frameAction}
          />
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
            <BoardDefs patternId={patternId} boardCorners={boardCorners} />
            <DiagramFloor
              scenic={scenic}
              boardCorners={boardCorners}
              patternId={patternId}
              arena={arena}
              project={project}
              player={player}
            />
            {scenic && (
              <g className="combat-board-edge" pointerEvents="none">
                {edgeRuns.map(([a, b], i) => {
                  const [p, q] = [project(a), project(b)];
                  return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} />;
                })}
              </g>
            )}
            {showSquares && !scenic && (
              <MoveSquares
                interaction={interaction}
                litSquares={litSquares}
                spotTile={spotTile}
                reachEdge={reachEdge}
                project={project}
              />
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
            {arena.environment?.structures
              .filter((s) => !scenic || blocker?.id === s.id)
              .map((s) => {
                const r = s.rect;
                return (
                  <g key={s.id} pointerEvents="none">
                    <polygon
                      points={points(
                        [
                          { x: r.x, y: r.y },
                          { x: r.x + r.width, y: r.y },
                          { x: r.x + r.width, y: r.y + r.height },
                          { x: r.x, y: r.y + r.height },
                        ].map(project),
                      )}
                      fill={scenic ? "transparent" : "#25323d"}
                      stroke={blocker?.id === s.id ? "#ffbc70" : "#7e8d8c"}
                      strokeWidth={blocker?.id === s.id ? "3" : "2"}
                    />
                    <title>{s.label} · permanent structure</title>
                  </g>
                );
              })}
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
                render: () => (
                  <CoverPieceView
                    piece={piece}
                    project={project}
                    canMove={canMove}
                    groundPoint={groundPoint}
                    arena={arena}
                    blockedSquares={blockedSquares}
                    clickSquare={clickSquare}
                    setInspected={setInspected}
                    blocker={blocker}
                    ui={ui}
                    scenic={scenic}
                    inspected={inspected}
                  />
                ),
              })),
              ...actors.map(({ actor, data }) => ({
                key: actor.id,
                depth: project(data.position).y,
                render: () => (
                  <ActorUnit
                    actor={actor}
                    data={data}
                    project={project}
                    lockedId={lockedId}
                    pointedId={pointedId}
                    clickUnit={clickUnit}
                    setHovered={setHovered}
                    dispatch={dispatch}
                    setFocused={setFocused}
                    focused={focused}
                    playback={playback}
                    scenic={scenic}
                    scenicUnitTop={scenicUnitTop}
                  />
                ),
              })),
            ]
              .sort((a, b) => a.depth - b.depth)
              .map((item) => (
                <g key={item.key}>{item.render()}</g>
              ))}
            {/* Who everybody is, in screen pixels and above everything standing:
                one readable size at every zoom, kept on screen and apart, and saying
                as much as each person's part in the fight calls for. */}
            <ActorMarkersLayer
              actors={actors}
              lockedId={lockedId}
              pointedId={pointedId}
              hovered={hovered}
              focused={focused}
              project={project}
              scenic={scenic}
              scenicUnitTop={scenicUnitTop}
              toScreen={toScreen}
              boardSize={boardSize}
              blocker={blocker}
              cover={cover}
              ui={ui}
            />
            {playback && impactPoint && playbackActor && (
              <ShotPlayback
                key={playback.sequence}
                playback={playback}
                impactPoint={impactPoint}
                playbackActor={playbackActor}
                project={project}
                scenic={scenic}
                scenicUnitTop={scenicUnitTop}
                ui={ui}
              />
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
              <p>{compactCombatFeedback(playback)}</p>
              {compactCombatFeedback(playback) !== playback.text && (
                <details>
                  <summary>Roll details</summary>
                  <p>{playback.text}</p>
                </details>
              )}
            </div>
          )}
          {callout && (
            <BattlefieldCallout
              anchor={calloutAnchor}
              under={calloutUnder}
              onDismiss={() => dispatch({ kind: "cancel" })}
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
          {offscreenActors > 0 && (
            <button type="button" className="combat-frame-notice" onClick={frameAction}>
              <Crosshair size={14} /> Frame {offscreenActors} offscreen{" "}
              {offscreenActors === 1 ? "participant" : "participants"}
            </button>
          )}
          <div className={`combat-map-hint ${feedback ? "has-feedback" : ""}`}>
            {feedback && !playback && (
              <div className="combat-feedback" role="status">
                <p>{feedback}</p>
                {feedbackDetail && feedbackDetail !== feedback && (
                  <details>
                    <summary>Roll details</summary>
                    <p>{feedbackDetail}</p>
                  </details>
                )}
              </div>
            )}
            {!playback && (
              <>
                <span className="combat-eyebrow">{hintTitle}</span>
                {hintBody}
              </>
            )}
          </div>
        </div>
        <CombatReadout
          readoutId={readoutId}
          showReadout={showReadout}
          openingRecap={openingRecap}
          live={live}
          openingRequest={openingRequest}
          dice={dice}
          inspectedCover={inspectedCover}
          spotTile={spotTile}
          route={route}
          spotSquares={spotSquares}
          sheltered={sheltered}
          futureShot={futureShot}
          target={target}
          interaction={interaction}
          canCommit={canCommit}
          onMoveTo={onMoveTo}
          confirmMove={confirmMove}
          setDossier={setDossier}
          playerPortrait={playerPortrait}
          shot={shot}
          blockedByCover={blockedByCover}
          outOfRange={outOfRange}
          targetCover={targetCover}
          weapon={weapon}
          firingTiles={firingTiles}
          dispatch={dispatch}
          canMove={canMove}
          lockedId={lockedId}
          onAttack={onAttack}
          confirmShot={confirmShot}
          targets={targets}
          capability={capability}
          resolving={resolving}
          clickUnit={clickUnit}
        />
      </div>
      <CombatCommand
        player={player}
        playerPortrait={playerPortrait}
        spotTile={spotTile}
        canMove={canMove}
        dispatch={dispatch}
        lockedId={lockedId}
        canAct={canAct}
        resolving={resolving}
        onAttack={onAttack}
        targets={targets}
        remaining={remaining}
        dice={dice}
        reload={reload}
        onReload={onReload}
        weapon={weapon}
        improvisation={improvisation}
        setPanel={setPanel}
        weaponArt={weaponArt}
        failedWeaponArt={failedWeaponArt}
        setFailedWeaponArt={setFailedWeaponArt}
        busy={busy}
        onWeaponId={onWeaponId}
        capability={capability}
        canResume={canResume}
        onEndTurn={onEndTurn}
      />
      <CombatDialogs
        dossierNpc={dossierNpc}
        setDossier={setDossier}
        panel={panel}
        setPanel={setPanel}
        improvisation={improvisation}
        journal={journal}
      />
    </section>
  );
}
