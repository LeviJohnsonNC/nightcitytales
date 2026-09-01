/**
 * The fight, seen from above.
 *
 * This is the first thing in the app that DRAWS the battlefield the engine has
 * been measuring all along. It decides nothing: every number on it comes from a
 * function that already existed — `coverStatuses` for what each piece of cover
 * is currently worth, `targetCapabilities` (through the capability snapshot)
 * for how far away everyone is and whether there is a shot, `moveAllowance` for
 * how far the character can go. Adding a fourth read model beside those three
 * is how they start disagreeing, so this one composes them and computes nothing
 * of its own except where to put the ink.
 *
 * Two rules keep it honest:
 *
 * 1. GEOMETRY IN METRES, SIZES IN SCREEN SPACE. The viewBox is the arena's own
 *    extent, so a metre is a unit and every position can be plotted straight
 *    from `data.position` with no conversion to get wrong. But arenas run from
 *    a 12x40 m alley to a 60x120 m rooftop, and at those scales a marker drawn
 *    a metre wide is either a blob or a speck. So anything meant to stay
 *    READABLE is sized off the arena rather than in metres: `unit` for what
 *    lives in the viewBox (marker radii, type), and plain pixels for every
 *    stroke, which `vector-effect: non-scaling-stroke` takes in SCREEN space —
 *    a stroke width in user units there would come out a sub-pixel hairline.
 *
 * 2. NUMBERS ARE HTML, NOT SVG. Names, HP and distances live in the lists under
 *    the board, where they are selectable, legible at any arena scale and
 *    reachable by a screen reader. The SVG carries shape and position only.
 *
 * Clicking it moves. The board sends a POINT and nothing else: how far of that
 * they actually get, what it costs and whether it is allowed at all are the
 * engine's (features/play/combatFlow.ts, movePlayerTo). The dashed circle is
 * the same `moveAllowance` the Move is bounded by, so it cannot offer a step
 * that would be refused.
 *
 * Picking a weapon paints its RANGE BANDS. This is the lookup RED makes you do
 * by hand and the one thing a computer should obviously be doing for you: the
 * rings are `weaponBands`, read straight off the printed table, and the DV
 * beside each target is `weaponDvAt` at the distance the engine measured. The
 * player sees which band they are standing in, what it would cost to be in a
 * better one, and — because the ground is clickable — can go there.
 */
import { useState } from "react";
import {
  arenaFor,
  coverStatuses,
  currentCombatant,
  judgeAction,
  metresBetween,
  usableWeapons,
  weaponBands,
  weaponDvAt,
  type CapabilitySnapshot,
  type Combatant,
  type Point,
  type TargetCapability,
  type WeaponCapability,
} from "@/engine";
import { Button } from "@/components/ui/button";
import type { LiveEncounter } from "@/features/campaign/encounterState";
import { moveAllowance, raisedWeapon, type CombatantData } from "./encounterModel";

/**
 * Stroke widths, in SCREEN pixels — every stroke below carries
 * `vector-effect: non-scaling-stroke`, which is what makes that the unit.
 */
const HAIRLINE = 1;
const EDGE = 1.5;

/**
 * How much of the viewport's height the board may take.
 *
 * One number, used for BOTH the height cap and the width cap, so the board is
 * sized by its own proportions rather than by whatever box it lands in. In the
 * side rail the binding constraint was width; in the main column it is height,
 * and `preserveAspectRatio` would letterbox a tall arena into a wide dark panel
 * — a 12x40 m alley as a narrow strip floating in empty background. Capping the
 * width at what the aspect needs AT this height makes the board hug instead.
 *
 * The value is what the panel can spend on the map and still leave the
 * narration a column worth reading. It went DOWN to 42 when the whole panel was
 * a stack pinned to the top of the screen — map on top of three hundred pixels
 * of roster, weapons, controls and cover — and comes back up now that those sit
 * BESIDE the map instead of under it, in the dead space a portrait arena leaves.
 * The panel is as tall as the map again, rather than the map plus everything.
 */
const BOARD_MAX_VH = 50;

/** One combatant, paired with where they are standing. */
type Marker = { combatant: Combatant; data: CombatantData };

/**
 * What the cursor is over: a spot on the ground, or somebody standing on it.
 *
 * A marker sits on top of the ground, so both fire — the person wins, because
 * clicking them is what would actually happen.
 */
type HoverTarget =
  | { kind: "ground"; point: Point; metres: number; ok: boolean }
  | { kind: "target"; id: string }
  | null;

function markersOf(live: LiveEncounter): Marker[] {
  // Initiative order, so the number drawn on a marker is the number beside the
  // same name in the list underneath.
  return live.state.order.flatMap((id) => {
    const combatant = live.state.combatants[id];
    const data = live.data[id];
    return combatant && data ? [{ combatant, data }] : [];
  });
}

/**
 * Where a click landed, in the arena's own metres.
 *
 * The screen CTM does the conversion, so the letterboxing that
 * `preserveAspectRatio` introduces is accounted for rather than approximated —
 * a click has to mean the metre it is over, because that metre becomes a Range
 * DV two lines later.
 */
function pointAt(svg: SVGSVGElement, event: { clientX: number; clientY: number }): Point | null {
  const screen = svg.getScreenCTM();
  if (!screen) return null;
  const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(screen.inverse());
  return { x: local.x, y: local.y };
}

/**
 * How hard the shot is, or why there is no number for it.
 *
 * Three different nulls, and they do not mean the same thing. Melee has no
 * Range DV because RED resolves it as an OPPOSED roll, not against a printed
 * table. A weapon the core rules never put on the table has no entry to read at
 * any distance. And a weapon that has a table simply cannot reach this far.
 * Collapsing all three into "out of range" would tell the player something
 * false about two of them.
 */
function dvLabel(weapon: WeaponCapability, metres: number): string {
  if (weapon.melee) return " · melee, opposed";
  if (!weapon.rangeType) return " · no printed range";
  const dv = weaponDvAt(weapon, metres);
  return dv === null ? " · out of range" : ` · DV ${dv}`;
}

/** Board colours by side, so who is who survives being a dot. */
function markerClass(combatant: Combatant): string {
  if (combatant.defeated) return "fill-muted-foreground/25 stroke-muted-foreground/40";
  if (combatant.isPlayer) return "fill-neon-cyan/80 stroke-neon-cyan";
  if (combatant.side === "hostile") return "fill-destructive/70 stroke-destructive";
  return "fill-accent/70 stroke-accent";
}

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
}: {
  live: LiveEncounter | null;
  /** Supplies the measured distance and whether the shot is there at all. */
  capability: CapabilitySnapshot | null;
  /** Walk to a spot. Omitted, the board stays the read-only view it was. */
  onMoveTo?: (to: Point) => void;
  /** Give up the rest of the Turn. */
  onEndTurn?: () => void;
  /** Put rounds back in the selected weapon, spending the Action. */
  onReload?: (weaponItemId: string) => void;
  /** Call the shot on a target with the selected weapon. */
  onAttack?: (targetId: string, weaponItemId: string) => void;
  /**
   * Which weapon is raised, owned by the caller.
   *
   * It used to be local, which was fine while the board was the only thing that
   * cared. The attack card carried a SECOND picker with its own answer, so
   * clicking a target with the pistol selected could open a card defaulting to
   * something else — two controls inches apart, disagreeing. One selection now
   * paints the bands, calls the shot and rolls it.
   */
  weaponId: string | null;
  onWeaponId: (itemId: string) => void;
  /**
   * The dice for whatever the board just started, rendered under the cover
   * list. A node rather than the attack itself: placement is the board's, but
   * resolving an attack needs the sheet, the Luck pool and the mutations, and
   * none of that is any of the board's business.
   */
  dice?: React.ReactNode;
  busy?: boolean;
}) {
  // Before the early return: a hook cannot sit behind a condition.
  // What the cursor is currently over, so the board can say what a click would
  // DO before it is clicked.
  //
  // A top-down board is only half legible while the rules for clicking it are
  // invisible: the same pixel is a Move, an attack, or nothing at all depending
  // on whose Turn it is, how much MOVE is left and what is in the way. The
  // `title` tooltips said some of that, a second late and never on a phone.
  // This says it continuously, in the line that was already there.
  const [hover, setHover] = useState<HoverTarget>(null);

  if (!live) return null;

  const arena = arenaFor(live.arena);
  const { width, height } = arena.extent;
  const cover = coverStatuses(arena, live.cover);
  const markers = markersOf(live);
  const player = markers.find((m) => m.combatant.isPlayer) ?? null;

  // Everything that has to stay readable is a multiple of this rather than a
  // number of metres: it is the arena's longest side over a constant, so a
  // marker on the rooftop and a marker in the alley look the same size once
  // the board has been fitted to its box.
  const unit = Math.max(width, height) / 40;

  // How far they could actually go, wound penalty included. The same helper the
  // Move itself is bounded by, so the circle cannot promise a step the engine
  // would refuse.
  const reach = player ? moveAllowance(player.data.move, player.combatant.woundState) : 0;

  const targets = new Map<string, TargetCapability>(
    (capability?.targets ?? []).map((t) => [t.id, t]),
  );

  // Only what could actually be fired: the empty and the broken are not a
  // tactical choice, and `usableWeapons` already knows which is which.
  const weapons: WeaponCapability[] = capability ? usableWeapons(capability) : [];
  const weapon = raisedWeapon(capability, weaponId);
  const bands = weapon ? weaponBands(weapon) : [];

  // The board acts only on the player's own Turn, and only while nothing else
  // is being written. A Move already spent this Round closes it until the
  // Round turns over — the same fact `judgeAction` refuses on, read here so the
  // board stops offering what the gate would reject.
  const active = currentCombatant(live.state);
  const moveSpent = (capability?.turn.metresMoved ?? 0) > 0;
  const canMove =
    Boolean(onMoveTo) &&
    !busy &&
    Boolean(active?.isPlayer) &&
    Boolean(player) &&
    !player?.combatant.defeated &&
    reach > 0 &&
    !moveSpent;

  // What the gate would say, asked rather than guessed.
  //
  // The board declines to offer what would be refused — but the rules for that
  // are the gate's and only the gate's. Re-deriving them here (a spent Action,
  // but not when the weapon's ROF still has a shot in it; an empty magazine;
  // cover in the line; a target past the printed range) is how a button ends up
  // disagreeing with the engine behind it. judgeAction is pure, and the
  // snapshot is already in hand, so the board simply asks.
  const refusalFor = (action: Parameters<typeof judgeAction>[1]): string | null => {
    if (!capability) return null;
    const verdict = judgeAction(capability, action);
    return verdict.ok ? null : verdict.reason;
  };

  const canAct = !busy && Boolean(active?.isPlayer) && !player?.combatant.defeated;

  const attackRefusal = (target: TargetCapability): string | null =>
    weapon
      ? refusalFor({
          kind: "attack",
          targetKey: target.id,
          distance: target.distance,
          weapon: weapon.itemId,
        })
      : "No weapon selected.";

  const reloadRefusal = weapon ? refusalFor({ kind: "reload", weapon: weapon.itemId }) : null;

  // Why nothing on the board can be shot, said once.
  //
  // Only when EVERY standing hostile refuses for the same reason — a spent
  // Action, an empty gun, a Rate of Fire already used — because that is a fact
  // about the Turn rather than about a target. A reason that differs per target
  // belongs on that target, where its tooltip already is.
  const standing = markers.filter((m) => !m.combatant.isPlayer && !m.combatant.defeated);
  const refusals = standing.map(({ combatant }) => {
    const target = targets.get(combatant.id);
    return target ? attackRefusal(target) : null;
  });
  const shootingRefusal =
    standing.length > 0 && refusals.every((r) => r !== null && r === refusals[0])
      ? refusals[0]
      : null;

  const hoverGround = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!player) return setHover(null);
    const to = pointAt(event.currentTarget, event);
    // Off the ground entirely — the letterboxed band beside a tall arena.
    if (!to || to.x < 0 || to.y < 0 || to.x > width || to.y > height) return setHover(null);
    // The same rounding the click uses, so the readout cannot promise a step
    // the click then refuses.
    const metres = Math.round(metresBetween(player.data.position, to));
    setHover({ kind: "ground", point: to, metres, ok: canMove && metres > 0 && metres <= reach });
  };

  /**
   * What a click right here would do, in one line.
   *
   * Every branch is a fact already established above — `attackRefusal` is the
   * gate's own answer, `reach` is `moveAllowance`, the DV is `weaponDvAt`. It
   * reads them out; it decides none of them.
   */
  const hoverLine = (): string | null => {
    if (!hover) return null;
    if (hover.kind === "target") {
      const marker = markers.find((m) => m.combatant.id === hover.id);
      const target = targets.get(hover.id);
      if (!marker || marker.combatant.defeated) return null;
      if (!target) return null;
      const refusal = attackRefusal(target);
      if (refusal) return refusal;
      if (!canAct) return `${active?.name ?? "Someone else"} is acting`;
      return `Shoot ${marker.combatant.name} · ${weapon?.name ?? "no weapon"}${
        weapon ? dvLabel(weapon, target.distance) : ""
      }`;
    }
    if (hover.ok) return `Move here · ${hover.metres} m of ${reach}`;
    // Not a legal step, and the three reasons do not mean the same thing.
    if (!active?.isPlayer) return `${active?.name ?? "Someone else"} is acting`;
    if (moveSpent) return "Move spent this Round";
    if (hover.metres > reach) return `${hover.metres} m — further than ${reach} m of MOVE`;
    return null;
  };

  /**
   * Whether the arena leaves a margin worth putting the numbers in.
   *
   * A portrait arena drawn to fit the viewport's HEIGHT is narrower than the
   * column it sits in, and the difference is dead background. A landscape one
   * already fills that width, so putting the roster beside it would squeeze
   * both. The threshold is the aspect itself: taller than wide, with enough in
   * it that the text column is not a gutter.
   */
  const sideBySide = height > width * 1.2;
  /**
   * The map's own width, at the height it is capped to — the same number the
   * svg used to carry as `maxWidth`. It also goes on the WRAPPER, because that
   * is what reserves the space now; a `flex-none` box around a `w-full` child
   * with no width of its own would collapse to nothing.
   */
  const mapWidth = `${(width / height) * BOARD_MAX_VH}vh`;

  const hovering = hoverLine();

  const clickBoard = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!canMove || !player) return;
    const to = pointAt(event.currentTarget, event);
    if (!to) return;
    // `preserveAspectRatio` letterboxes, so a click in the empty band beside a
    // tall arena maps to a point OFF the ground. The engine would clamp it to
    // the edge and move them somewhere they did not pick, so it is dropped.
    if (to.x < 0 || to.y < 0 || to.x > width || to.y > height) return;
    // Out of reach is not a short move to somewhere they did not pick: the
    // engine would refuse it, and the board declines to ask. Rounded, because
    // the gate reads whole metres — an unrounded compare here would make a
    // sliver of legal destinations unclickable.
    const metres = Math.round(metresBetween(player.data.position, to));
    // Clicking your own marker, or anywhere that rounds to standing still. The
    // engine refuses a zero-metre Move; asking it to would write a refusal into
    // the ledger for a misclick.
    if (metres <= 0 || metres > reach) return;
    onMoveTo?.(to);
  };

  return (
    <section className="space-y-2 border border-destructive/50 bg-destructive/5 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Combat — round {live.state.round} · {arena.label}
      </p>

      {/*
        The map beside its own numbers, when the arena leaves room for them.

        A 12x40 m alley drawn to fit the height is a narrow strip with two wide
        columns of empty background either side of it — and the roster, the
        weapons, the controls and the cover were stacked UNDERNEATH that, in a
        panel pinned to the top of the screen. Three hundred pixels of text held
        on screen beside three hundred pixels of nothing, with the narration
        pushed off the bottom to pay for it.

        So on a wide viewport the panel's height becomes max(map, numbers)
        rather than map + numbers, and the empty space does the work. A LANDSCAPE
        arena has no such margin to reclaim, and a phone has no width to spare
        at all, so both keep the stack.
      */}
      <div
        className={
          sideBySide ? "space-y-2 lg:flex lg:items-start lg:gap-4 lg:space-y-0" : "space-y-2"
        }
      >
        {/* The width is a custom property rather than an inline `width` so it
            can be scoped to the breakpoint: on a phone the map is full width
            and the numbers are underneath it, whatever the arena's shape. */}
        <div
          className={sideBySide ? "lg:w-[var(--map-w)] lg:flex-none" : undefined}
          style={sideBySide ? ({ "--map-w": mapWidth } as React.CSSProperties) : undefined}
        >
          <svg
            viewBox={`0 0 ${width} ${height}`}
            // The arena's own proportions, letterboxed rather than stretched: a
            // stretched board would put a combatant somewhere they are not.
            preserveAspectRatio="xMidYMid meet"
            className={`mx-auto w-full bg-background ${canMove ? "cursor-crosshair" : ""}`}
            style={{ maxHeight: `${BOARD_MAX_VH}vh`, maxWidth: mapWidth }}
            role="img"
            aria-label={`Top-down view of ${arena.label}, ${width} by ${height} metres.`}
            onClick={clickBoard}
            onMouseMove={hoverGround}
            onMouseLeave={() => setHover(null)}
          >
            {/* The ground. */}
            <rect
              x={0}
              y={0}
              width={width}
              height={height}
              className="fill-background stroke-border"
              strokeWidth={HAIRLINE}
              vectorEffect="non-scaling-stroke"
            />

            {/* The chosen weapon's printed range bands, nearest DV first. Drawn
                furthest-first so the near rings sit on top, and labelled where the
                ring crosses due north of the shooter — a DV belongs on the circle
                it applies to, not in a legend the eye has to travel to. */}
            {player &&
              [...bands].reverse().map((band) => (
                <g key={`band-${band.max}`}>
                  <circle
                    cx={player.data.position.x}
                    cy={player.data.position.y}
                    r={band.max}
                    className="fill-none stroke-neon-purple/35"
                    strokeWidth={HAIRLINE}
                    strokeDasharray="2 6"
                    vectorEffect="non-scaling-stroke"
                  >
                    <title>
                      out to {band.max} m — DV {band.dv}
                    </title>
                  </circle>
                  <text
                    x={player.data.position.x}
                    y={player.data.position.y - band.max + unit * 1.2}
                    textAnchor="middle"
                    fontSize={unit * 1.1}
                    className="pointer-events-none fill-neon-purple/70 font-mono"
                  >
                    {band.dv}
                  </text>
                </g>
              ))}

            {/* Where a Move could reach. Drawn under everything: it is context for
                the pieces on top of it, not a thing in its own right. */}
            {player && reach > 0 && (
              <circle
                cx={player.data.position.x}
                cy={player.data.position.y}
                r={reach}
                className={
                  canMove
                    ? "fill-neon-cyan/10 stroke-neon-cyan/60"
                    : "fill-neon-cyan/5 stroke-neon-cyan/20"
                }
                strokeWidth={HAIRLINE}
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {/* Cover, with what is left of it. A destroyed section is drawn as an
                outline rather than removed: knowing the wall WAS there is what
                makes the hole in it read as something that happened. */}
            {cover.map((piece) => (
              <rect
                key={piece.piece.id}
                x={piece.piece.rect.x}
                y={piece.piece.rect.y}
                width={piece.piece.rect.width}
                height={piece.piece.rect.height}
                className={
                  piece.destroyed
                    ? "fill-none stroke-muted-foreground/30"
                    : "fill-chrome/20 stroke-chrome/60"
                }
                strokeWidth={EDGE}
                strokeDasharray={piece.destroyed ? "3 3" : undefined}
                vectorEffect="non-scaling-stroke"
              >
                <title>
                  {piece.label} — {piece.destroyed ? "destroyed" : `${piece.hp}/${piece.hpMax} HP`}
                </title>
              </rect>
            ))}

            {/* The line from the player to each hostile: solid when the shot is
                there, dashed and red when something is standing in it. Which of
                those it is was decided by coverBlocking, not here. */}
            {player &&
              markers.map(({ combatant, data }) => {
                if (combatant.isPlayer || combatant.defeated) return null;
                const target = targets.get(combatant.id);
                if (!target) return null;
                return (
                  <line
                    key={`los-${combatant.id}`}
                    x1={player.data.position.x}
                    y1={player.data.position.y}
                    x2={data.position.x}
                    y2={data.position.y}
                    className={target.perceivable ? "stroke-border" : "stroke-destructive/60"}
                    strokeWidth={HAIRLINE}
                    strokeDasharray={target.perceivable ? undefined : "3 5"}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}

            {/* Where the cursor would put them. Drawn only when the step is one the
                engine would actually allow, so the ghost is a promise rather than a
                suggestion — and under the markers, because a person standing on
                that spot is the more important thing to see. */}
            {player && hover?.kind === "ground" && hover.ok && (
              <g className="pointer-events-none">
                <line
                  x1={player.data.position.x}
                  y1={player.data.position.y}
                  x2={hover.point.x}
                  y2={hover.point.y}
                  className="stroke-neon-cyan/70"
                  strokeWidth={HAIRLINE}
                  strokeDasharray="2 3"
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={hover.point.x}
                  cy={hover.point.y}
                  r={unit * 1.1}
                  className="fill-neon-cyan/15 stroke-neon-cyan/80"
                  strokeWidth={EDGE}
                  strokeDasharray="3 3"
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={hover.point.x}
                  y={hover.point.y - unit * 1.6}
                  textAnchor="middle"
                  fontSize={unit * 1.2}
                  className="fill-neon-cyan font-mono"
                >
                  {hover.metres} m
                </text>
              </g>
            )}

            {/* Everybody standing on it. A hostile you could shoot is a target:
                clicking one calls the shot, and the card that already resolves
                attacks takes it from there. */}
            {markers.map(({ combatant, data }, index) => {
              const target = targets.get(combatant.id);
              const refusal = target ? attackRefusal(target) : "Nothing to shoot at.";
              const shootable =
                Boolean(onAttack) && canAct && !combatant.isPlayer && Boolean(target) && !refusal;
              return (
                <g key={combatant.id}>
                  <circle
                    cx={data.position.x}
                    cy={data.position.y}
                    r={unit * 1.1}
                    className={`${markerClass(combatant)} ${shootable ? "cursor-pointer" : ""}`}
                    strokeWidth={EDGE}
                    vectorEffect="non-scaling-stroke"
                    onMouseMove={(e) => {
                      if (combatant.isPlayer) return; // no readout for standing on yourself
                      // The marker sits ON the ground, so this same movement also
                      // reaches the board's own handler, which would immediately
                      // overwrite the person with the metres underneath them.
                      e.stopPropagation();
                      setHover({ kind: "target", id: combatant.id });
                    }}
                    onClick={(e) => {
                      if (!shootable || !weapon) return;
                      // The board's own click must not also be a Move to the spot
                      // under the marker.
                      e.stopPropagation();
                      onAttack?.(combatant.id, weapon.itemId);
                    }}
                  >
                    <title>
                      {combatant.name} — {combatant.hp}/{combatant.hpMax} HP
                      {combatant.defeated ? ", out of the fight" : ""}
                      {combatant.isPlayer
                        ? ""
                        : shootable && weapon
                          ? `. Click to shoot with ${weapon.name}.`
                          : refusal
                            ? `. ${refusal}`
                            : ""}
                    </title>
                  </circle>
                  <text
                    x={data.position.x}
                    y={data.position.y + unit * 0.5}
                    textAnchor="middle"
                    fontSize={unit * 1.4}
                    className={`pointer-events-none font-mono font-bold ${
                      combatant.defeated ? "fill-muted-foreground" : "fill-background"
                    }`}
                  >
                    {index + 1}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="min-w-0 space-y-2 lg:flex-1">
          {/* The numbers, as text. */}
          <ul className="space-y-1 text-sm">
            {markers.map(({ combatant }, index) => {
              const target = targets.get(combatant.id);
              return (
                <li key={combatant.id} className="flex items-baseline justify-between gap-2">
                  <span className={combatant.defeated ? "text-muted-foreground line-through" : ""}>
                    <span className="font-mono text-[10px] text-muted-foreground">{index + 1}</span>{" "}
                    {combatant.name}{" "}
                    <span className="text-[10px] uppercase text-muted-foreground">
                      {combatant.side}
                    </span>
                  </span>
                  <span className="num font-mono text-xs">
                    {target && !combatant.defeated ? (
                      <span
                        className={
                          target.perceivable ? "text-muted-foreground" : "text-destructive"
                        }
                      >
                        {target.distance}m
                        {/* The shot's difficulty, at the distance the engine
                          measured, off the table the To-Hit is rolled against.
                          Absent means this weapon cannot reach them at all. */}
                        {target.perceivable && weapon ? dvLabel(weapon, target.distance) : ""}
                        {target.perceivable ? "" : " · no shot"} ·{" "}
                      </span>
                    ) : null}
                    {combatant.hp}/{combatant.hpMax} · {combatant.woundState}
                  </span>
                </li>
              );
            })}
          </ul>

          {weapons.length > 0 && (
            <div className="flex flex-wrap gap-1 border-t border-border/60 pt-2">
              {weapons.map((w) => {
                const chosen = w.itemId === weapon?.itemId;
                const paints = weaponBands(w).length > 0;
                return (
                  <button
                    key={w.itemId}
                    type="button"
                    onClick={() => onWeaponId(w.itemId)}
                    title={
                      paints
                        ? `${w.name} — reaches ${weaponBands(w).at(-1)?.max} m`
                        : w.melee
                          ? `${w.name} — melee, resolved as an opposed roll rather than against a Range DV`
                          : `${w.name} — the core rules give it no Range DV table`
                    }
                    className={`border px-2 py-1 text-left font-mono text-[10px] transition-colors ${
                      chosen
                        ? "border-neon-purple text-neon-purple"
                        : "border-border/60 text-muted-foreground hover:border-accent"
                    }`}
                  >
                    {w.name}
                    {w.roundsLoaded !== null && (
                      <span className="ml-1 opacity-70">
                        {w.roundsLoaded}/{w.magazine ?? "?"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {(onMoveTo || onEndTurn) && (
            <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
              {/*
              What the board will and will not do, in words.

              It used to say nothing at all unless it was the player's Turn, so a
              board that had correctly gone quiet — someone else on the clock, a
              Move already spent, a Rate of Fire used up — was indistinguishable
              from one that was broken. The refusals were only ever in a `title`,
              which is invisible until hovered and absent entirely on a phone.
            */}
              <div className="space-y-0.5">
                {/* Live while the cursor is on the board, and the standing state
                  of the Turn when it is not — so the line never goes blank, and
                  a touch device (which has no hover at all) still gets the
                  second half of it. */}
                <p
                  className={`font-mono text-[10px] uppercase tracking-[0.18em] ${
                    hovering ? "text-neon-cyan" : "text-muted-foreground"
                  }`}
                >
                  {hovering ??
                    (!active?.isPlayer
                      ? `${active?.name ?? "Someone else"} is acting`
                      : canMove
                        ? `Click to move · ${reach} m`
                        : moveSpent
                          ? "Move spent this Round"
                          : "Cannot move")}
                </p>
                {active?.isPlayer && shootingRefusal && (
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {shootingRefusal}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {onReload && weapon && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onReload(weapon.itemId)}
                    // Full, empty of spares, or the Action already spent: the gate
                    // refuses all three, and refuses again if this is pressed
                    // anyway. Greying it out only saves the round trip.
                    title={reloadRefusal ?? `Reload the ${weapon.name}`}
                    disabled={!canAct || Boolean(reloadRefusal)}
                  >
                    Reload
                  </Button>
                )}
                {onEndTurn && (
                  // Only on the player's own Turn. The controls render on anyone's
                  // now, so that the board can say whose it is — which would
                  // otherwise have made this button able to hand over a Turn that
                  // was never the player's to give up.
                  <Button size="sm" variant="outline" onClick={onEndTurn} disabled={!canAct}>
                    End Turn
                  </Button>
                )}
              </div>
            </div>
          )}

          {cover.length > 0 && (
            <ul className="space-y-1 border-t border-border/60 pt-2 text-sm">
              {cover.map((piece) => (
                <li key={piece.piece.id} className="flex justify-between gap-2">
                  <span className={piece.destroyed ? "text-muted-foreground line-through" : ""}>
                    {piece.label}{" "}
                    <span className="text-[10px] uppercase text-muted-foreground">cover</span>
                  </span>
                  <span className="num font-mono text-xs">
                    {piece.destroyed
                      ? "gone"
                      : `${piece.hp}/${piece.hpMax} HP · ${piece.thickness}`}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* The dice, under the cover — the last thing in the panel, and the
              only thing in it that is a decision rather than a fact. */}
          {dice}
        </div>
      </div>
    </section>
  );
}
