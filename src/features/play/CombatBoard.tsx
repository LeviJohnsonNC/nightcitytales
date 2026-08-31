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
 */
import {
  arenaFor,
  coverStatuses,
  type CapabilitySnapshot,
  type Combatant,
  type TargetCapability,
} from "@/engine";
import type { LiveEncounter } from "@/features/campaign/encounterState";
import { moveAllowance, type CombatantData } from "./encounterModel";

/**
 * Stroke widths, in SCREEN pixels — every stroke below carries
 * `vector-effect: non-scaling-stroke`, which is what makes that the unit.
 */
const HAIRLINE = 1;
const EDGE = 1.5;

/** One combatant, paired with where they are standing. */
type Marker = { combatant: Combatant; data: CombatantData };

function markersOf(live: LiveEncounter): Marker[] {
  // Initiative order, so the number drawn on a marker is the number beside the
  // same name in the list underneath.
  return live.state.order.flatMap((id) => {
    const combatant = live.state.combatants[id];
    const data = live.data[id];
    return combatant && data ? [{ combatant, data }] : [];
  });
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
}: {
  live: LiveEncounter | null;
  /** Supplies the measured distance and whether the shot is there at all. */
  capability: CapabilitySnapshot | null;
}) {
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

  return (
    <section className="space-y-2 border border-destructive/50 bg-destructive/5 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Combat — round {live.state.round} · {arena.label}
      </p>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        // The arena's own proportions, letterboxed rather than stretched: a
        // stretched board would put a combatant somewhere they are not.
        preserveAspectRatio="xMidYMid meet"
        className="max-h-[46vh] w-full bg-background"
        role="img"
        aria-label={`Top-down view of ${arena.label}, ${width} by ${height} metres.`}
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

        {/* Where a Move could reach. Drawn under everything: it is context for
            the pieces on top of it, not a thing in its own right. */}
        {player && reach > 0 && (
          <circle
            cx={player.data.position.x}
            cy={player.data.position.y}
            r={reach}
            className="fill-neon-cyan/5 stroke-neon-cyan/40"
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

        {/* Everybody standing on it. */}
        {markers.map(({ combatant, data }, index) => (
          <g key={combatant.id}>
            <circle
              cx={data.position.x}
              cy={data.position.y}
              r={unit * 1.1}
              className={markerClass(combatant)}
              strokeWidth={EDGE}
              vectorEffect="non-scaling-stroke"
            >
              <title>
                {combatant.name} — {combatant.hp}/{combatant.hpMax} HP
                {combatant.defeated ? ", out of the fight" : ""}
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
        ))}
      </svg>

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
                    className={target.perceivable ? "text-muted-foreground" : "text-destructive"}
                  >
                    {target.distance}m{target.perceivable ? "" : " · no shot"} ·{" "}
                  </span>
                ) : null}
                {combatant.hp}/{combatant.hpMax} · {combatant.woundState}
              </span>
            </li>
          );
        })}
      </ul>

      {cover.length > 0 && (
        <ul className="space-y-1 border-t border-border/60 pt-2 text-sm">
          {cover.map((piece) => (
            <li key={piece.piece.id} className="flex justify-between gap-2">
              <span className={piece.destroyed ? "text-muted-foreground line-through" : ""}>
                {piece.label}{" "}
                <span className="text-[10px] uppercase text-muted-foreground">cover</span>
              </span>
              <span className="num font-mono text-xs">
                {piece.destroyed ? "gone" : `${piece.hp}/${piece.hpMax} HP · ${piece.thickness}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
