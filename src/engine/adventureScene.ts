/** Bind adventure facts to existing recipe ingredients; coordinates stay entirely in the engine. */
import type { AuthoredScene, SceneActor } from "./authoredScene";
import type { Point, Rect } from "./battlefield";
import { composeScene } from "./sceneComposer";
import { readSceneFacts, CLUSTER_KINDS, type SceneFacts, type SceneContext } from "./sceneFacts";
import { readSceneManifest } from "./persistentScene";
import { centreOf, reachableTiles, tileOf, tileKey } from "./grid";
import { isThreatKey, threatFor } from "./threats";
import { exteriorDoorwayApproaches } from "./sceneEnvironment";

export type AdventureSceneInput = {
  locationKey: string;
  /** Campaign + mission + beat, never the wording of a retry. */
  identity: string;
  name: string;
  arena?: string | undefined;
  facts?: SceneFacts | undefined;
  enemies: { key: string; name: string; profile: string }[];
};

export function sceneRecipeForArena(arena?: string): SceneFacts["locationType"] {
  return (
    {
      street: "intersection",
      alley: "alley",
      club_interior: "nightclub",
      warehouse: "warehouse",
      parking_structure: "garage",
    } as const
  )[arena as "street"];
}
function seedFor(s: string) {
  let n = 2166136261;
  for (const c of s) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return n >>> 0;
}
const inside = (p: Point, r: Rect) =>
  p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;
const gap = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const fromKey = (key: string) => {
  const [col, row] = key.split(",").map(Number);
  return centreOf({ col: col!, row: row! });
};

/** Unsupported legacy arenas stay authored; never turn a rooftop into an office. */
export function composeAdventureScene(input: AdventureSceneInput): AuthoredScene | null {
  const facts = readSceneFacts(input.facts ?? {});
  const kind = facts.locationType ?? sceneRecipeForArena(input.arena);
  if (!kind) {
    if (input.facts) throw new Error("Scene facts need a supported location type.");
    return null;
  }
  facts.locationType = kind;
  if (!input.identity || !input.locationKey || !input.enemies.length || input.enemies.length > 16)
    throw new Error("Invalid adventure scene identity or opposition.");
  const enemyIds = new Set<string>();
  for (const e of input.enemies) {
    if (enemyIds.has(e.key) || !isThreatKey(e.profile))
      throw new Error("Invalid adventure scene opposition.");
    enemyIds.add(e.key);
    const known = facts.entities.find((a) => a.id === e.key);
    if (known && known.name !== e.name)
      throw new Error("Scene person disagrees with encounter cast.");
    if (!known) facts.entities.push({ id: e.key, name: e.name, role: "guard" });
  }
  // Revalidate combined IDs, counts and references; enemies cannot steal an object's identity.
  const combined = readSceneFacts(facts);
  const seed = seedFor(input.identity);
  const failures: string[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return bind(composeScene(kind, (seed + attempt) >>> 0), input, combined);
    } catch (e) {
      failures.push(e instanceof Error ? e.message : String(e));
    }
  }
  throw new Error(
    `This scene cannot fit the established facts: ${[...new Set(failures)].join("; ")}`,
  );
}
function bind(scene: AuthoredScene, input: AdventureSceneInput, facts: SceneFacts): AuthoredScene {
  const arena = scene.layout.arena,
    env = arena.environment!;
  const context: SceneContext = { version: 1, facts, objects: [], entrances: [] };
  const field = reachableTiles({
    arena,
    cover: {},
    from: tileOf(arena, arena.playerStart),
    allowance: 1000,
  });
  const open = [...field.keys()].map(fromKey);
  const usable = (p: Point) =>
    field.has(tileKey(tileOf(arena, p))) &&
    !env.zones.some((z) => z.kind === "doorway" && inside(p, z.rect));
  const anchors = new Map<string, Point[]>();
  const usedClusters = new Set<string>();
  for (const fact of facts.objects) {
    const cluster = env.clusters.find(
      (c) => CLUSTER_KINDS[fact.kind].includes(c.kind) && !usedClusters.has(c.id),
    );
    if (!cluster) throw new Error(`No contextual ${fact.kind} for ${fact.label}`);
    usedClusters.add(cluster.id);
    const parts = env.props
      .filter((p) => p.clusterId === cluster.id)
      .map((p) => arena.cover!.find((c) => c.id === p.coverId)!);
    if (!parts.length) throw new Error(`Object has no physical sections: ${fact.label}`);
    const adjacent = open.filter(
      (p) =>
        usable(p) &&
        parts.some((c) => {
          const dx = Math.max(c.rect.x - p.x, 0, p.x - c.rect.x - c.rect.width);
          const dy = Math.max(c.rect.y - p.y, 0, p.y - c.rect.y - c.rect.height);
          return dx + dy <= 1 && !inside(p, c.rect);
        }),
    );
    if (!adjacent.length) throw new Error(`No working access to ${fact.label}`);
    anchors.set(fact.id, adjacent);
    context.objects.push({ id: fact.id, coverIds: parts.map((p) => p.id) });
    parts.forEach((p) => {
      p.label = `${fact.label} · ${p.label}`;
    });
  }
  const doors = env.interior
    ? env.interior.connections
        .filter((c) => c.to === "outside")
        .map((c) => {
          const door = env.zones.find((z) => z.id === c.zoneId)!,
            room = env.zones.find((z) => z.id === c.from)!;
          return {
            id: door.id,
            kind:
              room.kind === "reception"
                ? "public"
                : room.kind === "service"
                  ? "service"
                  : "loading",
            positions: exteriorDoorwayApproaches(door.rect, room.rect, arena.extent)
              .flat()
              .filter((p) => usable(p)),
          };
        })
    : (env.entrances ?? []).map((e) => ({ id: e.id, kind: "front", positions: [e.position] }));
  const usedDoors = new Set<string>();
  for (const fact of facts.entrances) {
    const door = doors.find((d) => d.kind === fact.kind && !usedDoors.has(d.id));
    if (!door || !door.positions.length)
      throw new Error(`No ${fact.kind} entrance for ${fact.label}`);
    usedDoors.add(door.id);
    anchors.set(fact.id, door.positions);
    context.entrances.push({ id: fact.id, targetId: door.id });
    const exterior = env.entrances?.find((e) => e.id === door.id);
    if (exterior) exterior.label = fact.label;
  }
  // Replace the proof cast. A recipe never adds its demonstration enemies to an adventure.
  const actors: SceneActor[] = [];
  const occupied = [arena.playerStart];
  const visiting = new Set<string>();
  const roleZones: Record<SceneFacts["entities"][number]["role"], string[]> = {
    guard: ["workspace", "storage", "workbay", "reception", "sidewalk", "alley"],
    worker: ["service", "workspace", "storage", "staging", "workbay", "loading"],
    patron: ["seating", "dance", "reception", "sidewalk"],
    resident: ["sidewalk", "garden"],
    bystander: ["sidewalk", "seating", "reception", "staging"],
  };
  const free = (p: Point) => usable(p) && !occupied.some((o) => gap(o, p) === 0);
  const place = (entity: SceneFacts["entities"][number]) => {
    if (actors.some((a) => a.id === entity.id)) return;
    if (visiting.has(entity.id)) throw new Error("Cyclic scene placement relationships");
    visiting.add(entity.id);
    const relationship = facts.relationships.find((r) => r.entity === entity.id);
    let candidates: Point[];
    if (relationship) {
      const other = facts.entities.find((e) => e.id === relationship.target);
      if (other) place(other);
      const target = anchors.get(relationship.target)!;
      // A short legal walking path enforces proximity without placing someone through a wall.
      candidates = target.flatMap((p) => [
        p,
        ...[
          ...reachableTiles({ arena, cover: {}, from: tileOf(arena, p), allowance: 4 }).keys(),
        ].map(fromKey),
      ]);
    } else {
      const hostileIndex = input.enemies.findIndex((e) => e.key === entity.id);
      const preferred =
        scene.actors[
          hostileIndex >= 0 ? hostileIndex % scene.actors.length : scene.actors.length - 1
        ]!.position;
      candidates = [
        ...open
          .filter((p) =>
            env.zones.some((z) => roleZones[entity.role].includes(z.kind) && inside(p, z.rect)),
          )
          .sort((a, b) => gap(a, preferred) - gap(b, preferred)),
        ...scene.actors.map((a) => a.position),
        ...open.filter((p) =>
          env.zones.some(
            (z) =>
              !["road", "corridor", "doorway", "crosswalk", "intersection"].includes(z.kind) &&
              inside(p, z.rect),
          ),
        ),
      ];
    }
    const position = candidates.find(free);
    if (!position) throw new Error(`No valid placement for ${entity.name}`);
    const enemy = input.enemies.find((e) => e.key === entity.id);
    actors.push({
      id: entity.id,
      name: entity.name,
      side: enemy ? "hostile" : "neutral",
      position,
      profile: enemy ? { ...threatFor(enemy.profile) } : null,
    });
    occupied.push(position);
    anchors.set(entity.id, [position]);
    visiting.delete(entity.id);
  };
  facts.entities.forEach(place);
  const extra = { none: 0, sparse: 2, busy: 5 }[facts.crowd];
  for (let i = 0; i < extra; i++)
    place({ id: `crowd_${i}`, name: `Bystander ${i + 1}`, role: "bystander" });
  actors.sort((a, b) => Number(b.side === "hostile") - Number(a.side === "hostile"));
  arena.hostileSlots = actors.filter((a) => a.side === "hostile").map((a) => a.position);
  arena.label = facts.label ?? input.name;
  scene.actors = actors;
  scene.context = context;
  scene.locationKey = input.locationKey;
  scene.template = "adventure-composition";
  scene.templateVersion = 1;
  scene.anchor = `adventure-v1:${input.identity}`;
  scene.narration = `${arena.label}. ${facts.entities.map((e) => e.name).join(", ")} are present.${facts.objects.length ? ` Nearby: ${facts.objects.map((o) => o.label).join(", ")}.` : ""}`;
  return readSceneManifest({ version: 1, scene });
}
