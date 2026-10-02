import { expect, it } from "vitest";
import { northHeywoodScene, readPersistentScene } from "../index";
function row() {
  return {
    id: "scene",
    campaign_id: "campaign",
    revision: 0,
    status: "ready",
    encounter_id: null,
    summary: null,
    manifest: { version: 1, scene: northHeywoodScene() },
  };
}
it("reads the saved actors, profiles and layout without regenerating a template", () => {
  const saved = row();
  saved.manifest.scene.actors[0]!.profile!.key = "retired-profile";
  saved.manifest.scene.actors[0]!.profile!.hp = 31;
  expect(readPersistentScene(JSON.parse(JSON.stringify(saved))).scene).toEqual(
    saved.manifest.scene,
  );
});
it.each(["version", "duplicate", "position", "profile"])(
  "rejects a corrupt saved scene: %s",
  (fault) => {
    const saved = row();
    if (fault === "version") saved.manifest.version = 2;
    if (fault === "duplicate")
      saved.manifest.scene.actors[1]!.id = saved.manifest.scene.actors[0]!.id;
    if (fault === "position")
      saved.manifest.scene.actors[1]!.position = saved.manifest.scene.layout.arena.playerStart;
    if (fault === "profile") saved.manifest.scene.actors[0]!.profile!.hp = NaN;
    expect(() => readPersistentScene(saved)).toThrow();
  },
);
