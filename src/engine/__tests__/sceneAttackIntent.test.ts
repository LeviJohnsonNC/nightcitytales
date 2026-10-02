import { expect, it } from "vitest";
import {
  northHeywoodScene,
  resolveSceneAttack,
  sceneAttackRequest,
  readSceneAttackIntent,
} from "../index";

it("carries the example into combat without inventing a target", () => {
  const input = "pull out my pistol and start blasting";
  const intent = resolveSceneAttack(sceneAttackRequest(input)!, northHeywoodScene());
  expect(intent).toEqual({ version: 1, input, weapon: "pistol", targetKey: null });
  expect(readSceneAttackIntent({ source: { initiatingIntent: intent } })).toEqual(intent);
});
it("resolves a named hostile against the saved actors", () => {
  expect(
    resolveSceneAttack(
      sceneAttackRequest("I shoot the rifleman with my pistol!")!,
      northHeywoodScene(),
    ).targetKey,
  ).toBe("rifle_ganger");
});
it.each([
  "don't shoot",
  "I don't shoot the rifleman",
  "if he moves, shoot the rifleman",
  "I threaten to shoot the rifleman",
  "can I shoot the rifleman?",
  "I draw my pistol",
  'I say "open fire"',
  "I shoot the breeze",
])("does not initiate combat for %s", (input) => {
  const request = sceneAttackRequest(input);
  if (request) expect(() => resolveSceneAttack(request, northHeywoodScene())).toThrow();
  else expect(request).toBeNull();
});
it("refuses unknown, ambiguous, or neutral named targets before rolling initiative", () => {
  const scene = northHeywoodScene();
  for (const target of ["dragon", "worker", "rifleman if he moves"])
    expect(() => resolveSceneAttack(sceneAttackRequest(`shoot the ${target}`)!, scene)).toThrow();
  scene.actors[1]!.name = "Another rifleman";
  expect(() => resolveSceneAttack(sceneAttackRequest("shoot the rifleman")!, scene)).toThrow();
});
it("rejects unsupported saved intent versions and missing fields", () => {
  expect(readSceneAttackIntent({ source: { initiatingIntent: { version: 2 } } })).toBeNull();
  expect(
    readSceneAttackIntent({ source: { initiatingIntent: { version: 1, input: "shoot" } } }),
  ).toBeNull();
});
