import type { ReactNode } from "react";
import { Crosshair } from "lucide-react";
import { combatantDisposition, type Combatant } from "@/engine";
import { CombatPortrait } from "../CombatPortrait";
import { dispositionLabel } from "../combatDisposition";
import type { LiveEncounter } from "@/features/campaign/encounterState";
import type { PlaybackFrame } from "../combatPlayback";
import type { BoardActor, TurnBudget } from "./boardTypes";

/** Whose turn it is, what is left of it, the readout's toggle and the initiative order. */
export function TurnStrip({
  busy,
  statusText,
  acting,
  turnKey,
  playback,
  playbackStatus,
  status,
  remaining,
  showReadout,
  readoutId,
  readoutRequired,
  readoutOpen,
  setReadoutOpen,
  dice,
  openingRequest,
  targets,
  actors,
  playerPortrait,
  live,
}: {
  busy: boolean;
  statusText: string | undefined;
  acting: Combatant | null | undefined;
  turnKey: string;
  playback: PlaybackFrame | null | undefined;
  playbackStatus: string | null;
  status: string;
  remaining: TurnBudget | null;
  showReadout: boolean;
  readoutId: string;
  readoutRequired: boolean;
  readoutOpen: boolean;
  setReadoutOpen: (open: boolean) => void;
  dice: ReactNode;
  openingRequest: ReactNode;
  targets: BoardActor[];
  actors: BoardActor[];
  playerPortrait: string | null | undefined;
  live: LiveEncounter;
}) {
  return (
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
      <button
        type="button"
        className="combat-readout-toggle"
        aria-expanded={showReadout}
        aria-controls={readoutId}
        disabled={readoutRequired}
        onClick={() => setReadoutOpen(!readoutOpen)}
      >
        <Crosshair size={15} />
        {dice ? "Resolve action" : openingRequest ? "Opening request" : "Tactical readout"}
        <span>{targets.length}</span>
      </button>
      <ol className="combat-initiative" aria-label="Initiative order">
        {actors.map(({ actor, data }) => (
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
            {actor.defeated && (
              <span className="combat-exit-label">
                {dispositionLabel(combatantDisposition(true, data.exitReason))}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
