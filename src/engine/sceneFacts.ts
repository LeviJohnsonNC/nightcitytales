/** Coordinate-free facts at the adventure/composer boundary. No mechanical values from prose. */
import type { AuthoredScene } from "./authoredScene";
export const SCENE_LOCATION_TYPES = [
  "intersection",
  "alley",
  "office",
  "nightclub",
  "residential",
  "warehouse",
  "garage",
] as const;
export const SCENE_OBJECT_TYPES = [
  "vehicle",
  "vendor",
  "freight",
  "utilities",
  "workstation",
  "reception",
  "meeting",
  "seating",
  "bar",
  "server",
  "performance",
  "racking",
  "workbench",
  "garden",
] as const;
export const SCENE_ENTITY_ROLES = ["guard", "worker", "patron", "resident", "bystander"] as const;
export const SCENE_ENTRANCE_TYPES = ["public", "service", "loading", "front"] as const;
export type SceneFacts = {
  locationType?: (typeof SCENE_LOCATION_TYPES)[number];
  label?: string;
  crowd: "none" | "sparse" | "busy";
  entities: { id: string; name: string; role: (typeof SCENE_ENTITY_ROLES)[number] }[];
  objects: { id: string; label: string; kind: (typeof SCENE_OBJECT_TYPES)[number] }[];
  entrances: { id: string; label: string; kind: (typeof SCENE_ENTRANCE_TYPES)[number] }[];
  relationships: { entity: string; relation: "near" | "guards" | "works_at"; target: string }[];
};
export const CLUSTER_KINDS: Record<SceneFacts["objects"][number]["kind"], string[]> = {
  vehicle: ["parking", "driveway", "vehicle_bay", "service_bay"],
  vendor: ["vendor", "vendor_stall"],
  freight: ["loading", "freight", "workshop_delivery", "service_stock"],
  utilities: ["service", "workshop_service"],
  workstation: ["workstation", "work_pod", "work_facing", "work_island", "work_parallel"],
  reception: ["reception", "reception_arrival", "club_checkin"],
  meeting: ["meeting", "meeting_support"],
  seating: [
    "lounge_bench",
    "lounge_conversation",
    "booth",
    "seating",
    "waiting_arrival",
    "waiting_entry",
  ],
  bar: ["bar_service", "bar"],
  server: ["server", "equipment_support"],
  performance: ["performance", "dj_control"],
  racking: ["racking", "rack_aisle"],
  workbench: ["workbench", "repair_support"],
  garden: ["garden"],
};
export type SceneContext = {
  version: 1;
  facts: SceneFacts;
  objects: { id: string; coverIds: string[] }[];
  entrances: { id: string; targetId: string }[];
};
const rec = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Invalid scene facts.");
  return v as Record<string, unknown>;
};
const text = (v: unknown): string => {
  if (typeof v !== "string" || !v.trim() || v.length > 120)
    throw new Error("Invalid scene fact text.");
  return v.trim();
};
const choice = <T extends string>(v: unknown, choices: readonly T[]): T => {
  if (!choices.includes(v as T)) throw new Error(`Unsupported scene ingredient: ${String(v)}`);
  return v as T;
};
function list(v: unknown, max: number): Record<string, unknown>[] {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > max) throw new Error("Too many scene facts.");
  return v.map(rec);
}
/** Narrow to a closed vocabulary; supplied coordinates/stats never survive this boundary. */
export function readSceneFacts(value: unknown): SceneFacts {
  const r = rec(value),
    ids = new Set<string>();
  const id = (v: unknown) => {
    const s = text(v);
    if (s === "player" || s.startsWith("crowd_") || ids.has(s))
      throw new Error("Invalid or duplicate scene fact ID.");
    ids.add(s);
    return s;
  };
  const facts: SceneFacts = {
    ...(r["locationType"] === undefined
      ? {}
      : { locationType: choice(r["locationType"], SCENE_LOCATION_TYPES) }),
    ...(r["label"] === undefined ? {} : { label: text(r["label"]) }),
    crowd: r["crowd"] === undefined ? "none" : choice(r["crowd"], ["none", "sparse", "busy"]),
    entities: list(r["entities"], 16).map((e) => ({
      id: id(e["id"]),
      name: text(e["name"]),
      role: choice(e["role"], SCENE_ENTITY_ROLES),
    })),
    objects: list(r["objects"], 12).map((o) => ({
      id: id(o["id"]),
      label: text(o["label"]),
      kind: choice(o["kind"], SCENE_OBJECT_TYPES),
    })),
    entrances: list(r["entrances"], 8).map((e) => ({
      id: id(e["id"]),
      label: text(e["label"]),
      kind: choice(e["kind"], SCENE_ENTRANCE_TYPES),
    })),
    relationships: list(r["relationships"], 16).map((e) => ({
      entity: text(e["entity"]),
      relation: choice(e["relation"], ["near", "guards", "works_at"]),
      target: text(e["target"]),
    })),
  };
  const related = new Set<string>();
  for (const r of facts.relationships) {
    if (
      !facts.entities.some((e) => e["id"] === r["entity"]) ||
      !ids.has(r["target"]) ||
      r["entity"] === r["target"] ||
      related.has(r["entity"])
    )
      throw new Error("Invalid scene relationship. Use one placement relationship per person.");
    related.add(r["entity"]);
  }
  return facts;
}
/** Persisted facts reference the frozen scene, never a newly generated recipe. */
export function readSceneContext(value: unknown, scene: AuthoredScene): SceneContext {
  const r = rec(value);
  if (r["version"] !== 1) throw new Error("Unsupported scene context version.");
  const facts = readSceneFacts(r["facts"]);
  const objects = list(r["objects"], 12).map((o) => {
    if (!Array.isArray(o["coverIds"]) || !o["coverIds"].length || o["coverIds"].length > 16)
      throw new Error("Invalid scene object binding.");
    return { id: text(o["id"]), coverIds: o["coverIds"].map(text) };
  });
  const entrances = list(r["entrances"], 8).map((e) => ({
    id: text(e["id"]),
    targetId: text(e["targetId"]),
  }));
  const env = scene.layout.arena.environment;
  if (!env || (facts.locationType && facts.locationType !== env.recipe))
    throw new Error("Scene facts disagree with saved environment.");
  if (
    facts.entities.some((e) => !scene.actors.some((a) => a.id === e["id"] && a.name === e["name"]))
  )
    throw new Error("Scene person binding is missing.");
  if (
    objects.length !== facts.objects.length ||
    new Set(objects.map((o) => o["id"])).size !== objects.length ||
    new Set(objects.flatMap((o) => o["coverIds"])).size !==
      objects.flatMap((o) => o["coverIds"]).length ||
    objects.some(
      (o) =>
        !facts.objects.some((f) => f.id === o["id"]) ||
        o["coverIds"].some((id) => !scene.layout.arena.cover?.some((c) => c.id === id)),
    )
  )
    throw new Error("Scene object binding is missing.");
  for (const object of objects) {
    const fact = facts.objects.find((f) => f.id === object.id)!;
    const clusters = new Set(
      env.props.filter((p) => object.coverIds.includes(p.coverId)).map((p) => p.clusterId),
    );
    const cluster = env.clusters.find((c) => clusters.has(c.id));
    const expected = cluster
      ? env.props.filter((p) => p.clusterId === cluster.id).map((p) => p.coverId)
      : [];
    if (
      clusters.size !== 1 ||
      !cluster ||
      !CLUSTER_KINDS[fact.kind].includes(cluster.kind) ||
      expected.length !== object.coverIds.length ||
      expected.some((id) => !object.coverIds.includes(id))
    )
      throw new Error("Scene object binding disagrees with its ingredient.");
  }
  const doorIds = [
    ...(env.entrances ?? []).map((e) => e["id"]),
    ...(env.interior?.connections.filter((c) => c.to === "outside").map((c) => c.zoneId) ?? []),
  ];
  if (
    entrances.length !== facts.entrances.length ||
    new Set(entrances.map((e) => e["id"])).size !== entrances.length ||
    new Set(entrances.map((e) => e["targetId"])).size !== entrances.length ||
    entrances.some(
      (e) => !facts.entrances.some((f) => f.id === e["id"]) || !doorIds.includes(e["targetId"]),
    )
  )
    throw new Error("Scene entrance binding is missing.");
  return { version: 1, facts, objects, entrances };
}
