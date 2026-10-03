/** Read a saved authored scene without resolving a newer version of its template. */
import { readBattlefieldSnapshot, readBattlefieldPositions } from "./battlefieldSnapshot";
import type { AuthoredScene } from "./authoredScene";
import { readSceneContext } from "./sceneFacts";
import type { ThreatProfile } from "./threats";

export type PersistentScene = {
  id: string;
  campaignId: string;
  revision: number;
  status: "ready" | "combat" | "resolved";
  encounterId: string | null;
  scene: AuthoredScene;
  summary: string | null;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid saved scene.");
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Invalid saved scene text.");
  return value;
}
function integer(value: unknown, min = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > 10000)
    throw new Error("Invalid saved scene number.");
  return value;
}
function profile(value: unknown): ThreatProfile | null {
  if (value === null) return null;
  const p = record(value);
  if (
    !["mook", "lieutenant", "boss"].includes(String(p["role"])) ||
    ![
      "pistol",
      "smg",
      "shotgun_slug",
      "assault_rifle",
      "sniper_rifle",
      "bow_crossbow",
      "grenade_launcher",
      "rocket_launcher",
    ].includes(String(p["rangeType"]))
  )
    throw new Error("Unsupported saved actor profile.");
  return {
    key: text(p["key"]),
    name: text(p["name"]),
    role: p["role"] as ThreatProfile["role"],
    ref: integer(p["ref"]),
    body: integer(p["body"], 1),
    hp: integer(p["hp"], 1),
    sp: integer(p["sp"]),
    attackSkill: integer(p["attackSkill"]),
    move: integer(p["move"]),
    weaponName: text(p["weaponName"]),
    rangeType: p["rangeType"] as ThreatProfile["rangeType"],
    damageDice: integer(p["damageDice"]),
    note: typeof p["note"] === "string" ? p["note"] : "",
  };
}
export function readSceneManifest(value: unknown): AuthoredScene {
  const manifest = record(value);
  if (manifest["version"] !== 1) throw new Error("Unsupported scene version. Refresh the game.");
  const raw = record(manifest["scene"]);
  const layout = readBattlefieldSnapshot(raw["layout"]);
  if (!Array.isArray(raw["actors"]) || raw["actors"].length > 32)
    throw new Error("Invalid scene actors.");
  const positions = readBattlefieldPositions(
    layout,
    [layout.arena.playerStart, ...raw["actors"].map((a) => record(a)["position"])],
    {},
  );
  const ids = new Set<string>();
  const actors = raw["actors"].map((value, index) => {
    const a = record(value),
      id = text(a["id"]);
    if (ids.has(id) || id === "player") throw new Error("Duplicate scene entity.");
    ids.add(id);
    if (!["hostile", "neutral", "friendly"].includes(String(a["side"])))
      throw new Error("Invalid actor side.");
    const p = profile(a["profile"]);
    if (a["side"] !== "neutral" && !p) throw new Error("Actor has no supported profile.");
    return {
      id,
      name: text(a["name"]),
      side: a["side"] as AuthoredScene["actors"][number]["side"],
      position: positions[index + 1]!,
      profile: p,
    };
  });
  const scene: AuthoredScene = {
    template: text(raw["template"]),
    templateVersion: integer(raw["templateVersion"], 1),
    locationKey: text(raw["locationKey"]),
    anchor: text(raw["anchor"]),
    narration: text(raw["narration"]),
    layout,
    actors,
  };
  if (raw["context"] !== undefined) scene.context = readSceneContext(raw["context"], scene);
  return scene;
}

export function readPersistentScene(value: unknown): PersistentScene {
  const row = record(value);
  if (!["ready", "combat", "resolved"].includes(String(row["status"])))
    throw new Error("Invalid scene status.");
  return {
    id: text(row["id"]),
    campaignId: text(row["campaign_id"]),
    revision: integer(row["revision"]),
    status: row["status"] as PersistentScene["status"],
    encounterId: row["encounter_id"] == null ? null : text(row["encounter_id"]),
    summary: row["summary"] == null ? null : text(row["summary"]),
    scene: readSceneManifest(row["manifest"]),
  };
}
