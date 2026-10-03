/** Facts that survive the return to prose. Being out of combat never implies death. */
import type { EncounterState } from "./encounter";
import type { Arena, Point } from "./battlefield";
import { coverStatuses, type CoverDamage } from "./cover";

/** A combat removal is not a death unless its saved reason explicitly says so. */
export function combatantDisposition(
  defeated: boolean,
  exitReason?: "dead" | "withdrawn",
): "present" | "dead" | "withdrawn" | "out_of_fight" {
  return defeated ? (exitReason ?? "out_of_fight") : "present";
}

export function battlefieldResult(input: {
  state: EncounterState;
  arena: Arena;
  cover: CoverDamage;
  data: Record<string, { key: string; position: Point; exitReason?: "dead" | "withdrawn" }>;
}) {
  return {
    version: 1,
    battlefield: input.arena.label,
    actors: Object.values(input.state.combatants).map((actor) => ({
      id: actor.id,
      entityId: input.data[actor.id]?.key ?? actor.id,
      name: actor.name,
      side: actor.side,
      isPlayer: actor.isPlayer,
      hp: actor.hp,
      woundState: actor.woundState,
      position: input.data[actor.id]?.position ?? null,
      disposition: combatantDisposition(actor.defeated, input.data[actor.id]?.exitReason),
    })),
    objects: coverStatuses(input.arena, input.cover).map((cover) => ({
      id: cover.piece.id,
      name: cover.piece.label,
      hp: cover.hp,
      hpMax: cover.hpMax,
      destroyed: cover.destroyed,
    })),
  };
}

export function battlefieldResultText(result: ReturnType<typeof battlefieldResult>): string {
  const actors = result.actors.map((a) =>
    a.disposition === "dead"
      ? `${a.name} is dead.`
      : a.disposition === "withdrawn"
        ? `${a.name} has withdrawn.`
        : a.disposition === "out_of_fight"
          ? `${a.name} is out of the fight.`
          : `${a.name} remains here at ${a.hp} HP${a.woundState === "mortal" ? ", mortally wounded" : ""}.`,
  );
  const objects = result.objects
    .filter((o) => o.hp < o.hpMax)
    .map((o) => `${o.name} is ${o.destroyed ? "destroyed" : "damaged"}.`);
  return [`The fight at ${result.battlefield} is over.`, ...actors, ...objects].join(" ");
}
