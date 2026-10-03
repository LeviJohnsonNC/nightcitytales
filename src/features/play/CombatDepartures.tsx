import { combatantDisposition } from "@/engine";
import type { LiveEncounter } from "@/features/campaign/encounterState";

import { dispositionLabel } from "./combatDisposition";

/** Saved facts stay visible after playback, including after refresh or Skip. */
export function CombatDepartures({ live }: { live: LiveEncounter }) {
  const departures = Object.values(live.state.combatants).filter((actor) => actor.defeated);
  if (!departures.length) return null;
  return (
    <section className="combat-departures" aria-label="Combat departures">
      <p className="combat-eyebrow">Out of the fight</p>
      <ul>
        {departures.map((actor) => (
          <li key={actor.id}>
            <strong>{actor.name}</strong> —{" "}
            {dispositionLabel(combatantDisposition(true, live.data[actor.id]?.exitReason))}
            {live.data[actor.id]?.exitReason === "withdrawn" &&
              (live.data[actor.id]?.exitCause === "morale"
                ? " — morale broke"
                : live.data[actor.id]?.exitCause === "goal_met"
                  ? " — objective met"
                  : "")}
          </li>
        ))}
      </ul>
    </section>
  );
}
