import type { AuthoredScene } from "./northHeywoodScene";

/** A deliberately small command vocabulary, not a general natural-language parser. */
export type SceneAttackIntent = {
  version: 1;
  input: string;
  targetKey: string | null;
  weapon: "pistol" | null;
};
export type SceneAttackRequest = {
  input: string;
  target: string | null;
  weapon: "pistol" | null;
};

export function sceneAttackRequest(input: string): SceneAttackRequest | null {
  const text = input
    .trim()
    .replace(/[.!]+$/, "")
    .toLowerCase();
  if (text.length > 500) return null;
  const drawn = /^(?:i )?(?:pull out|draw) my pistol and (.+)$/.exec(text);
  const action = drawn?.[1] ?? text.replace(/^i /, "");
  if (/^(?:start blasting|open fire)$/.test(action))
    return { input: input.trim(), target: null, weapon: drawn ? "pistol" : null };
  const shot = /^(?:shoot|attack|fire at) (?:the )?(.+?)( with my pistol)?$/.exec(action);
  if (!shot) return null;
  return { input: input.trim(), target: shot[1]!, weapon: drawn || shot[2] ? "pistol" : null };
}

export function resolveSceneAttack(
  request: SceneAttackRequest,
  scene: AuthoredScene,
): SceneAttackIntent {
  let targetKey: string | null = null;
  if (request.target) {
    const target = request.target;
    const matches = scene.actors.filter((actor) => {
      const name = actor.name.toLowerCase();
      return actor.id === target || name === target || name.endsWith(` ${target}`);
    });
    if (matches.length !== 1)
      throw new Error(
        "Name one person in this scene, or type ‘open fire’ and choose a target on the battlefield.",
      );
    if (matches[0]!.side !== "hostile")
      throw new Error("This scene currently supports attacks against its hostile actors only.");
    targetKey = matches[0]!.id;
  }
  return { version: 1, input: request.input, targetKey, weapon: request.weapon };
}
