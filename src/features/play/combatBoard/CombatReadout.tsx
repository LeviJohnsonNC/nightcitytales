import type { ReactNode } from "react";
import { ChevronRight, Crosshair, Footprints, Shield } from "lucide-react";
import { previewAttack, tileKey, type CapabilitySnapshot, type Point, type Tile } from "@/engine";
import type { LiveEncounter } from "@/features/campaign/encounterState";
import { findNpcNumbered } from "@/features/cast/npcDirectory";
import { CombatDepartures } from "../CombatDepartures";
import { CombatPortrait } from "../CombatPortrait";
import type { Interaction, InteractionEvent } from "../combatInteraction";
import type {
  BoardActor,
  BoardCover,
  FiringTiles,
  RaisedWeapon,
  RoutePreview,
  ShotPreview,
} from "./boardTypes";

/**
 * The tactical readout beside the board: a pending roll, the terrain or square
 * being inspected, or the target assessment, and everybody on the field. Every
 * button here calls the board's own commit (`confirmMove`, `confirmShot`).
 */
export function CombatReadout({
  readoutId,
  showReadout,
  openingRecap,
  live,
  openingRequest,
  dice,
  inspectedCover,
  spotTile,
  route,
  spotSquares,
  sheltered,
  futureShot,
  target,
  interaction,
  canCommit,
  onMoveTo,
  confirmMove,
  setDossier,
  playerPortrait,
  shot,
  blockedByCover,
  outOfRange,
  targetCover,
  weapon,
  firingTiles,
  dispatch,
  canMove,
  lockedId,
  onAttack,
  confirmShot,
  targets,
  capability,
  resolving,
  clickUnit,
}: {
  readoutId: string;
  showReadout: boolean;
  openingRecap: ReactNode;
  live: LiveEncounter;
  openingRequest: ReactNode;
  dice: ReactNode;
  inspectedCover: BoardCover | undefined;
  spotTile: Tile | null;
  route: RoutePreview | null;
  spotSquares: number | undefined;
  sheltered: Set<string> | null;
  futureShot: ShotPreview | null;
  target: BoardActor | undefined;
  interaction: Interaction;
  canCommit: boolean;
  onMoveTo: ((point: Point) => void) | undefined;
  confirmMove: () => void;
  setDossier: (name: string | null) => void;
  playerPortrait: string | null | undefined;
  shot: ShotPreview | null;
  blockedByCover: boolean;
  outOfRange: boolean;
  targetCover: string | undefined;
  weapon: RaisedWeapon;
  firingTiles: FiringTiles | null;
  dispatch: (event: InteractionEvent) => void;
  canMove: boolean;
  lockedId: string | null;
  onAttack: ((targetId: string, weaponId: string) => void) | undefined;
  confirmShot: () => void;
  targets: BoardActor[];
  capability: CapabilitySnapshot | null;
  resolving: boolean;
  clickUnit: (id: string) => void;
}) {
  return (
    <aside
      id={readoutId}
      className="combat-intel"
      aria-label="Tactical readout"
      hidden={!showReadout}
    >
      {openingRecap}
      <CombatDepartures live={live} />
      {openingRequest && (
        <div className="p-3 text-sm" role="status">
          {openingRequest}
        </div>
      )}
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
            disabled={interaction.type !== "move-preview" || !canCommit || !route?.ok || !onMoveTo}
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
  );
}
