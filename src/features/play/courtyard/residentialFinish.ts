/** Domestic finishes vary across saved masses without changing their envelopes. */
import type { SceneEnvironment, SceneStructure, SceneZone } from "@/engine";
import { hash } from "./frontage";
import type { MaterialKey } from "./surfaceMaterials";

const HOME_PALETTES = [
  ["#827262", "#62594f", "#55514a"],
  ["#737c72", "#525f59", "#4b5350"],
  ["#8a736b", "#645450", "#57504c"],
  ["#787e83", "#555f66", "#4b5358"],
] as const;
export function residentialPalette(s: SceneStructure) {
  return HOME_PALETTES[
    Math.floor(hash(s.rect.x, s.rect.y, s.height, s.rect.width) * HOME_PALETTES.length)
  ]!;
}
/** Planting strips absorb light; only the saved paths laid over them reflect. */
export function residentialGround(
  kind: SceneZone["kind"],
): { key: MaterialKey; target: string; planted: boolean } | undefined {
  if (kind === "driveway") return { key: "facade-concrete", target: "#696962", planted: false };
  if (kind === "garden" || kind === "frontage")
    return { key: "painted-render", target: "#4c5141", planted: true };
  return undefined;
}

/** Planting is a background layer; saved drives cross it before entry paths. */
export function groundSurfaceZones(env: SceneEnvironment): readonly SceneZone[] {
  return env.recipe === "residential"
    ? [...env.zones].sort((a, b) => Number(a.kind === "driveway") - Number(b.kind === "driveway"))
    : env.zones;
}
