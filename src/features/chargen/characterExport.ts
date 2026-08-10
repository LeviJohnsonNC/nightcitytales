/**
 * JSON export of the whole character: the build as entered, the assembled
 * sheet the engine produced, and the full roll log.
 */
import type { AssembledCharacter, CharacterBuild } from "@/engine";
import type { ChargenState } from "./store";

export function characterExport(
  state: ChargenState,
  build: CharacterBuild,
  sheet: AssembledCharacter,
) {
  return {
    exportedAt: new Date().toISOString(),
    build,
    lifepath: state.lifepath,
    sheet,
    rollLog: state.rollLog,
  };
}

export function exportFilename(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug || "character"}.json`;
}

export function downloadCharacterJson(
  state: ChargenState,
  build: CharacterBuild,
  sheet: AssembledCharacter,
): void {
  const blob = new Blob([JSON.stringify(characterExport(state, build, sheet), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = exportFilename(state.name);
  a.click();
  URL.revokeObjectURL(url);
}
