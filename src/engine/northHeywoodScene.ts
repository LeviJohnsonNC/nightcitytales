/** Authored acceptance fixture; scene-local names are not new canonical atlas landmarks. */
import { battlefieldProp, placeProp } from "./battlefieldProps";
import { snapshotBattlefield, type BattlefieldSnapshot } from "./battlefieldSnapshot";
import { threatFor, type ThreatProfile } from "./threats";
import type { CombatSide } from "./encounter";
import type { Point } from "./battlefield";

export type SceneActor = {
  id: string;
  name: string;
  side: CombatSide;
  position: Point;
  /** Snapshot the mechanical profile rather than reinterpreting the weapon later. */
  profile: ThreatProfile | null;
};
export type AuthoredScene = {
  template: string;
  templateVersion: number;
  locationKey: string;
  anchor: string;
  narration: string;
  layout: BattlefieldSnapshot;
  actors: SceneActor[];
};

export function northHeywoodScene(): AuthoredScene {
  const props = [
    { key: "sedan", id: "thorton", name: "Olive-drab Thorton cruiser", at: { x: 18, y: 8 } },
    { key: "food_cart", id: "broth_cart", name: "Broth cart", at: { x: 4, y: 8 } },
  ].flatMap((instance) => {
    const prop = battlefieldProp(instance.key);
    if (!prop) throw new Error(`Missing scene prop: ${instance.key}`);
    return placeProp(prop, instance.at, instance.id).map((piece) => ({
      ...piece,
      label: `${instance.name} · ${piece.label}`,
    }));
  });
  const actors: SceneActor[] = [
    {
      id: "rifle_ganger",
      name: "6th Street rifleman",
      side: "hostile",
      position: { x: 17, y: 9 },
      profile: { ...threatFor("enforcer") },
    },
    {
      id: "lookout",
      name: "6th Street lookout",
      side: "hostile",
      position: { x: 17, y: 13 },
      profile: { ...threatFor("ganger") },
    },
    {
      id: "worker_one",
      name: "Maintenance worker",
      side: "neutral",
      position: { x: 3, y: 5 },
      profile: null,
    },
    {
      id: "worker_two",
      name: "Worker with a tool bag",
      side: "neutral",
      position: { x: 7, y: 5 },
      profile: null,
    },
  ];
  return {
    template: "north-heywood-intersection",
    templateVersion: 1,
    locationKey: "north_heywood",
    anchor: "ulysses-crosswalk",
    narration:
      "You stand in the crosswalk on cracked North Heywood pavement. Across the intersection, an olive-drab Thorton cruiser idles under 6th Street colors. A rifleman leans beside its front fender, watching you over an assault rifle; a lookout stands farther along the curb. By the broth cart on the opposite pavement, two third-shift maintenance workers head toward the Converted Motel.",
    layout: snapshotBattlefield({
      key: "scene:north-heywood-intersection:v1",
      label: "Ulysses Street intersection",
      extent: { width: 24, height: 24 },
      playerStart: { x: 9, y: 19 },
      hostileSlots: actors
        .filter((actor) => actor.side === "hostile")
        .map((actor) => actor.position),
      cover: props,
    }),
    actors,
  };
}
