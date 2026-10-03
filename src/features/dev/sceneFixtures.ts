/** Explicit opt-in fixtures. Adding a recipe does not silently change ordinary adventures. */
import { composeScene, northHeywoodScene } from "@/engine";
export function sceneFixtures() {
  return [
    northHeywoodScene(),
    ...(["intersection", "alley"] as const).flatMap((kind) =>
      [1, 2, 3].map((seed) => composeScene(kind, seed)),
    ),
  ];
}
