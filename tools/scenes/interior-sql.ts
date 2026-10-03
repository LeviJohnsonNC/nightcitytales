/** Emit disposable SQL fixtures from the production composer, not a parallel map definition. */
import { readFileSync } from "node:fs";
import { composeAdventureScene } from "../../src/engine/adventureScene";
import { readSceneFacts } from "../../src/engine/sceneFacts";
import { composeScene } from "../../src/engine/sceneComposer";
import { reachableTiles, centreOf, tileOf } from "../../src/engine/grid";
import { coverMaxHp } from "../../src/engine/cover";
const adventure = process.argv.includes("--adventure");
let template = readFileSync(
  new URL("../../supabase/replay/interior-scenes.test.sql", import.meta.url),
  "utf8",
);
if (adventure) {
  template = template
    .replace(
      "SET LOCAL ROLE authenticated;",
      `UPDATE public.campaigns SET phase='job',current_mission_id='phase3-proof',location_key='north_heywood' WHERE id='00000000-0000-0000-0000-000000000003';
INSERT INTO public.mission_progress(campaign_id,mission_id,current_beat_id) VALUES ('00000000-0000-0000-0000-000000000003','phase3-proof','climax');
SET LOCAL ROLE authenticated;`,
    )
    .replace(
      "staged:=public.stage_authored_scene(stage_payload);",
      `stage_payload:=stage_payload || jsonb_build_object('expected',jsonb_build_object('missionId','phase3-proof','beatId','climax','location','north_heywood'));
  BEGIN
    PERFORM public.stage_adventure_scene(jsonb_set(stage_payload,'{expected,location}','"somewhere_else"'));
    RAISE EXCEPTION 'stale location was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'adventure scene origin changed%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.stage_adventure_scene(jsonb_set(stage_payload,'{expected,beatId}','"stale"'));
    RAISE EXCEPTION 'stale beat was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'adventure scene origin changed%' THEN RAISE; END IF;
  END;
  staged:=public.stage_adventure_scene(stage_payload);`,
    )
    .replace(
      "enc:=public.start_persisted_scene_encounter(start_payload);",
      `start_payload:=start_payload || jsonb_build_object('beat_id','climax','adventure_beat','climax');
  BEGIN
    PERFORM public.start_adventure_scene_encounter(jsonb_set(start_payload,'{adventure_beat}','"stale"'));
    RAISE EXCEPTION 'stale entry was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'adventure beat changed%' THEN RAISE; END IF;
  END;
  enc:=public.start_adventure_scene_encounter(start_payload);
  IF public.start_adventure_scene_encounter(start_payload) <> enc THEN RAISE EXCEPTION 'entry replay forked'; END IF;`,
    )
    .replace(
      "revisited:=public.stage_authored_scene(stage_payload);",
      "revisited:=public.stage_adventure_scene(stage_payload);",
    );
}
const literal = (v: unknown) => "'" + JSON.stringify(v).replaceAll("'", "''") + "'::jsonb";
const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
for (const kind of ["office", "nightclub", "residential", "warehouse", "garage"] as const)
  for (const seed of [1, 2, 3]) {
    const scene = adventure
        ? composeAdventureScene({
            locationKey: "north_heywood",
            identity: `phase3-${kind}-${seed}`,
            name: `Adventure ${kind}`,
            enemies: [{ key: "guard", name: "Mara", profile: "street_thug" }],
            facts: readSceneFacts({
              locationType: kind,
              crowd: "sparse",
              entities: [{ id: "kiro", name: "Kiro", role: "worker" }],
            }),
          })!
        : composeScene(kind, seed),
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
    const reachable = reachableTiles({
      arena,
      cover: {},
      from: tileOf(arena, arena.playerStart),
      allowance: 1000,
    });
    const move = [...reachable.keys()]
      .map((key) => {
        const [col, row] = key.split(",").map(Number);
        return centreOf({ col: col!, row: row! });
      })
      .find((p) => !occupied.includes(JSON.stringify(p)))!;
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
