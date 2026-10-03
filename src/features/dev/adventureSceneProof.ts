import {
  composeAdventureScene,
  readSceneFacts,
  type SceneFacts,
  type SceneEnvironment,
} from "@/engine";
/** The same coordinate-free request used by the normal Job encounter route. */
export function adventureSceneProof(kind: SceneEnvironment["recipe"], seed: number) {
  const objectKinds: Record<SceneEnvironment["recipe"], SceneFacts["objects"][number]["kind"]> = {
    intersection: "vehicle",
    alley: "freight",
    office: "workstation",
    nightclub: "bar",
    residential: "vehicle",
    warehouse: "racking",
    garage: "workbench",
  };
  const label = {
    intersection: "Kiro's courier car",
    alley: "Kiro's shipment",
    office: "Kiro's desk",
    nightclub: "Kiro's bar",
    residential: "Kiro's car",
    warehouse: "Kiro's stock rack",
    garage: "Kiro's repair bench",
  }[kind];
  return composeAdventureScene({
    locationKey: "north_heywood",
    identity: `review-${kind}-${seed}`,
    name: `Kiro's ${kind} · contextual proof`,
    enemies: [{ key: "mara", name: "Mara", profile: "street_thug" }],
    facts: readSceneFacts({
      locationType: kind,
      crowd: "sparse",
      entities: [
        { id: "kiro", name: "Kiro", role: "worker" },
        { id: "mara", name: "Mara", role: "guard" },
      ],
      objects: [{ id: "work", label, kind: objectKinds[kind] }],
      entrances: [
        {
          id: "entry",
          label: "Main entrance",
          kind: ["intersection", "alley", "residential"].includes(kind) ? "front" : "public",
        },
      ],
      relationships: [
        { entity: "kiro", relation: "works_at", target: "work" },
        { entity: "mara", relation: "guards", target: "entry" },
      ],
    }),
  })!;
}
