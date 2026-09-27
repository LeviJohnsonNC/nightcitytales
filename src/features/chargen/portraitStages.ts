/**
 * The portrait that develops as the character is answered.
 *
 * A face used to arrive at step nine of eleven, after forty minutes of building
 * somebody nobody could see. Now the fixer's file gets a picture as soon as
 * there is something to picture, and a better one each time the answers give
 * the camera more to work with:
 *
 *  1. SURVEILLANCE STILL — the Role, pronouns, and how they look (clothes,
 *     hair, the thing they are never without) from the Lifepath.
 *  2. UNDER THE LIGHTS — the same, once the STATs say how they are built.
 *  3. FILE PHOTO — once the gear and chrome they carry are chosen.
 *
 * Each stage is one generation from the same capped budget the portrait studio
 * spends, so three are automatic and the rest stay the player's own. Once the
 * player draws a portrait by hand, development stops: theirs is the one on
 * the file.
 *
 * Every image is generated fresh, so a face would drift from stage to stage.
 * `faceFact` pins the few things a face is recognised by — age, shape, eyes,
 * one mark — from the draft's own seed, and every stage sends the same line.
 *
 * Pure. Nothing here generates, stores or spends anything.
 */
import { STAT_ORDER, seededRng } from "@/engine";
import { readGeneralLifepath } from "./lifepathState";
import type { ChargenState } from "./store";
import { stepsFor } from "./steps";
import { validateStep } from "./validation";

export type PortraitStage = 1 | 2 | 3;

export const PORTRAIT_STAGES: Record<PortraitStage, { name: string; caption: string }> = {
  1: { name: "Surveillance still", caption: "Long lens, bad light. Enough to know the face." },
  2: { name: "Under the lights", caption: "A better look, now they know how you carry yourself." },
  3: { name: "File photo", caption: "Kitted out, the way the street will see you." },
};

/** The Lifepath answers the first picture needs: how somebody looks at a glance. */
export const LOOK_ANSWERS = ["clothing_style", "hairstyle", "affectation"] as const;

/** What stage 1 is still waiting for, in words a player can act on. */
export function firstPictureNeeds(state: ChargenState): string[] {
  const needs: string[] = [];
  if (!state.roleId) needs.push("what you do");
  if (!state.pronouns.trim()) needs.push("your pronouns");
  const entries = readGeneralLifepath(state.lifepath.general).entries;
  if (LOOK_ANSWERS.some((id) => !entries[id])) needs.push("how you look");
  return needs;
}

/** The highest stage the answers so far can support; 0 when not even a still. */
export function portraitStageReady(state: ChargenState): 0 | PortraitStage {
  if (firstPictureNeeds(state).length > 0) return 0;
  if (!STAT_ORDER.every((stat) => typeof state.stats[stat] === "number")) return 1;
  const kit = stepsFor(state.method).filter((s) => ["package", "gear", "cyberware"].includes(s.id));
  const kitted =
    kit.length > 0 &&
    kit.every((s) => state.visited.includes(s.id)) &&
    kit.every((s) => validateStep(s.id, state).violations.length === 0);
  return kitted ? 3 : 2;
}

/** The stage to develop next, if any: straight to the best the answers support. */
export function nextStageToDevelop(state: ChargenState): PortraitStage | null {
  const ready = portraitStageReady(state);
  return ready !== 0 && ready > state.portraitStage ? ready : null;
}

const AGES = [
  "early twenties",
  "mid twenties",
  "late twenties",
  "early thirties",
  "late thirties",
  "mid forties",
];
const SHAPES = [
  "an angular face with sharp cheekbones",
  "a round face with a soft jaw",
  "a long, narrow face",
  "a square jaw and a heavy brow",
  "a heart-shaped face",
  "a lean, hollow-cheeked face",
];
const EYES = [
  "hooded, watchful eyes",
  "wide dark eyes",
  "narrow pale eyes",
  "tired, deep-set eyes",
  "bright, restless eyes",
];
const MARKS = [
  "a thin scar through one eyebrow",
  "a crooked, once-broken nose",
  "freckles across the nose",
  "a chipped front tooth",
  "a small tattoo under one eye",
  "no distinguishing marks",
];

/**
 * The face every stage shares, fixed by the draft's seed so it is the same
 * person at every stage and after every reload. Null before the draft has one.
 */
export function faceFact(seed: number | null | undefined): { label: string; value: string } | null {
  if (typeof seed !== "number") return null;
  const rng = seededRng((seed ^ 0xface) >>> 0);
  const pick = (list: string[]) => list[Math.floor(rng() * list.length)]!;
  return {
    label: "Face (keep consistent)",
    value: `${pick(AGES)}, ${pick(SHAPES)}, ${pick(EYES)}, ${pick(MARKS)}`,
  };
}
