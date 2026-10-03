/** Static review fixtures only. No simulated turn loop or campaign writes. */
import {
  coverDamageFrom,
  readBattlefieldPositions,
  readSceneManifest,
  type AuthoredScene,
  type Combatant,
} from "@/engine";
import type { LiveEncounter } from "@/features/campaign/encounterState";

export function sceneReviewEncounter(scene: AuthoredScene, atEntrances = false): LiveEncounter {
  const actors = [
    {
      id: "player",
      name: "Review character",
      side: "friendly" as const,
      position: scene.layout.arena.playerStart,
      profile: null,
    },
    ...scene.actors,
  ];
  const env = scene.layout.arena.environment;
  const entrances =
    env?.interior?.access.filter((a) => a.id.endsWith("_approach")) ?? env?.entrances ?? [];
  return {
    id: "scene-review",
    arena: scene.layout.arena.key,
    layout: scene.layout,
    version: 0,
    cover: {},
    state: {
      round: 1,
      activeIndex: 0,
      status: "active",
      order: actors.map((a) => a.id),
      combatants: Object.fromEntries(
        actors.map((a): [string, Combatant] => [
          a.id,
          {
            id: a.id,
            name: a.name,
            side: a.side,
            isPlayer: a.id === "player",
            ref: 7,
            body: 6,
            hpMax: 40,
            hp: 40,
            seriouslyWoundedThreshold: 20,
            woundState: "none",
            deathSavePenalty: 0,
            spHead: 7,
            spBody: 7,
            defeated: false,
            initiative: a.id === "player" ? 20 : 10,
          },
        ]),
      ),
    },
    data: Object.fromEntries(
      actors.map((a, i) => [
        a.id,
        {
          key: a.id,
          position: atEntrances && entrances[i] ? entrances[i]!.position : a.position,
          weaponName: a.profile?.weaponName ?? "",
          damageDice: a.profile?.damageDice ?? 0,
          rangeType: a.profile?.rangeType ?? null,
          move: 6,
          attackSkill: 10,
        },
      ]),
    ),
  };
}

export function readSceneReview(value: unknown): { scene: AuthoredScene; live: LiveEncounter } {
  if (!value || typeof value !== "object") throw new Error("Invalid review snapshot");
  const raw = value as { scene?: unknown; cover?: unknown; positions?: unknown };
  const scene = readSceneManifest({ version: 1, scene: raw.scene });
  const live = sceneReviewEncounter(scene);
  live.cover = coverDamageFrom(scene.layout.arena, raw.cover);
  const ids = live.state.order;
  if (!Array.isArray(raw.positions) || raw.positions.length !== ids.length)
    throw new Error("Invalid review positions");
  const positions = readBattlefieldPositions(scene.layout, raw.positions, live.cover);
  ids.forEach((id, i) => {
    live.data[id]!.position = positions[i]!;
  });
  return { scene, live };
}
