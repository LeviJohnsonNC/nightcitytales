/** Emit disposable SQL fixtures from the production composer, not a parallel map definition. */
import { readFileSync } from "node:fs";
import { composeScene } from "../../src/engine/sceneComposer";
import { coverMaxHp } from "../../src/engine/cover";
const template = readFileSync(
  new URL("../../supabase/replay/interior-scenes.test.sql", import.meta.url),
  "utf8",
);
const literal = (v: unknown) => "'" + JSON.stringify(v).replaceAll("'", "''") + "'::jsonb";
const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
for (const kind of ["office", "nightclub"] as const)
  for (const seed of [1, 2, 3]) {
    const scene = composeScene(kind, seed),
      arena = scene.layout.arena;
    const cast = [
      { id: "player", name: "Player", side: "friendly", position: arena.playerStart },
      ...scene.actors,
    ];
    const combatants = cast.map((actor, i) => ({
      id: uuid(i + 10),
      is_player: i === 0,
      name: actor.name,
      side: actor.side,
      ref: 6,
      body: 6,
      hp_max: 40,
      hp_current: 40,
      seriously_wounded_threshold: 20,
      wound_state: "none",
      death_save_penalty: 0,
      sp_head: 7,
      sp_body: 7,
      defeated: false,
      initiative: 20 - i,
      data: { key: actor.id, position: actor.position },
    }));
    const occupied = cast.map((a) => JSON.stringify(a.position));
    const move = arena.environment!.interior!.access.find(
      (a) => !occupied.includes(JSON.stringify(a.position)),
    )!.position;
    const piece = arena.cover![0]!;
    const payload = {
      campaign_id: uuid(3),
      arena: arena.key,
      layout: scene.layout,
      order_ids: combatants.map((c) => c.id),
      combatants,
    };
    console.log(
      template
        .replace("__START__", literal(payload))
        .replace("__MANIFEST__", literal({ version: 1, scene }))
        .replace("__MOVE__", literal(move))
        .replace("__DAMAGE__", literal({ [piece.id]: coverMaxHp(piece) })),
    );
  }
