import { currentCombatant, payloadOf, readAttackEventData } from "@/engine";
import type { LiveEncounter } from "@/features/campaign/encounterState";
import type { CampaignEvent } from "@/lib/backend";

/** Reconstruct the opening from saved facts, including when entry playback was missed. */
export function CombatOpeningRecap({
  live,
  events,
}: {
  live: LiveEncounter;
  events: CampaignEvent[];
}) {
  const player = currentCombatant(live.state);
  if (!live.origin || live.state.round !== 1 || !player?.isPlayer) return null;
  const before = live.state.order
    .slice(0, live.state.order.indexOf(player.id))
    .map((id) => live.state.combatants[id]!)
    .filter((actor) => actor.side === "hostile");
  if (!before.length) return null;
  // Scene entry writes its start before NPC actions. Legacy starts use a different order.
  const start = events
    .map(
      (event) => event.type === "encounter_started" && payloadOf(event)["encounterId"] === live.id,
    )
    .lastIndexOf(true);
  const following = start < 0 ? [] : events.slice(start + 1);
  const nextEncounter = following.findIndex((event) => event.type === "encounter_started");
  const openingEvents = nextEncounter < 0 ? following : following.slice(0, nextEncounter);
  const attacks =
    start < 0
      ? []
      : openingEvents.flatMap((event) => {
          if (event.type !== "attack") return [];
          const attack = readAttackEventData(event.data);
          return attack &&
            attack.target === player.name &&
            before.some((actor) => actor.name === attack.attacker)
            ? [attack]
            : [];
        });
  return (
    <section className="combat-departures" aria-label="Opening initiative">
      <p className="combat-eyebrow">Before your first turn</p>
      <p>
        {before.length} {before.length === 1 ? "opponent acted" : "opponents acted"} before you in
        initiative.
      </p>
      {attacks.length > 0 && (
        <ul>
          {attacks.map((attack, i) => (
            <li key={i}>
              <strong>{attack.attacker}</strong> —{" "}
              {attack.hit === false ? "missed" : attack.hit === true ? "hit" : "attacked"}
              {attack.hpBefore !== null &&
                attack.hpAfter !== null &&
                ` · ${attack.hpBefore} → ${attack.hpAfter} HP`}
              {attack.spBefore !== null &&
                attack.spAfter !== null &&
                attack.spBefore !== attack.spAfter &&
                ` · ${attack.armorLocation} armor ${attack.spBefore} → ${attack.spAfter}`}
            </li>
          ))}
        </ul>
      )}
      <details>
        <summary>Initiative rolls</summary>
        <ul>
          {live.state.order.map((id) => {
            const actor = live.state.combatants[id]!;
            return (
              <li key={id}>
                {actor.isPlayer ? "You" : actor.name}: {actor.initiative ?? "—"}
              </li>
            );
          })}
        </ul>
      </details>
    </section>
  );
}
