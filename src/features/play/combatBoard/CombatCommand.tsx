import type { ReactNode } from "react";
import { Crosshair, Footprints, MessageSquare, RotateCcw, SkipForward } from "lucide-react";
import type { CapabilitySnapshot, Tile } from "@/engine";
import type { itemArt } from "@/features/chargen/art";
import { CombatPortrait } from "../CombatPortrait";
import type { InteractionEvent } from "../combatInteraction";
import type { ActionVerdict, BoardActor, RaisedWeapon, TurnBudget } from "./boardTypes";

/**
 * The command dock under the board: the player's vitals, a shortcut into each
 * action this Turn can still afford, the equipped weapon and End turn.
 */
export function CombatCommand({
  player,
  playerPortrait,
  spotTile,
  canMove,
  dispatch,
  lockedId,
  canAct,
  resolving,
  onAttack,
  targets,
  remaining,
  dice,
  reload,
  onReload,
  weapon,
  improvisation,
  setPanel,
  weaponArt,
  failedWeaponArt,
  setFailedWeaponArt,
  busy,
  onWeaponId,
  capability,
  canResume,
  onEndTurn,
}: {
  player: BoardActor | undefined;
  playerPortrait: string | null | undefined;
  spotTile: Tile | null;
  canMove: boolean;
  dispatch: (event: InteractionEvent) => void;
  lockedId: string | null;
  canAct: boolean;
  resolving: boolean;
  onAttack: ((targetId: string, weaponId: string) => void) | undefined;
  targets: BoardActor[];
  remaining: TurnBudget | null;
  dice: ReactNode;
  reload: ActionVerdict | null;
  onReload: ((weaponId: string) => void) | undefined;
  weapon: RaisedWeapon;
  improvisation: ReactNode;
  setPanel: (panel: "journal" | "improvise" | null) => void;
  weaponArt: ReturnType<typeof itemArt> | null;
  failedWeaponArt: string | null;
  setFailedWeaponArt: (src: string | null) => void;
  busy: boolean;
  onWeaponId: (id: string) => void;
  capability: CapabilitySnapshot | null;
  canResume: boolean;
  onEndTurn: (() => void) | undefined;
}) {
  return (
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
        disabled={(!canAct && !canResume) || busy || !!dice || !onEndTurn}
        onClick={onEndTurn}
      >
        <SkipForward size={19} />
        <span>
          {canResume ? "Continue combat" : "End turn"}
          <small>
            {canResume
              ? "Resolve NPC turns"
              : remaining?.action
                ? "Action ready"
                : remaining?.attacks
                  ? "Attack remaining"
                  : "Action spent"}
          </small>
        </span>
      </button>
    </footer>
  );
}
