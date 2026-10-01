/**
 * The portrait that develops as the character is answered.
 *
 * A face used to arrive at step nine of eleven, after forty minutes of building
 * somebody nobody could see. Now the fixer's file gets a picture as soon as
 * there is something to picture, and a better one each time the answers give
 * the camera more to work with:
 *
 *  1. SURVEILLANCE STILL — the Role, sex and age, and how they look (clothes,
 *     hair, the thing they are never without) from the Lifepath.
 *  2. UNDER THE LIGHTS — the same, once the STATs say how they are built.
 *  3. FILE PHOTO — once the gear and chrome they carry are chosen.
 *
 * Each stage is one generation from a capped budget. Three are the stages; the
 * rest are spent on retrying a stage that failed and on developing the picture
 * again when who the character is on sight changes (`portraitIsStale`).
 *
 * Every image is generated fresh, so a face would drift from stage to stage.
 * `faceFact` pins the few things a face is recognised by — age, shape, eyes,
 * one mark — from the draft's own seed, and every stage sends the same line.
 *
 * Pure. Nothing here generates, stores or spends anything.
 */
import { STAT_ORDER, seededRng, validAge } from "@/engine";
import { displayValue, readGeneralLifepath } from "./lifepathState";
import type { ChargenState } from "./store";
import { stepsFor } from "./steps";
import { validateStep } from "./validation";

export type PortraitStage = 1 | 2 | 3;

/** The Lifepath answers the first picture needs: how somebody looks at a glance. */
export const LOOK_ANSWERS = ["clothing_style", "hairstyle", "affectation"] as const;

/** What stage 1 is still waiting for, in words a player can act on. */
export function firstPictureNeeds(state: ChargenState): string[] {
  const needs: string[] = [];
  if (!state.roleId) needs.push("what you do");
  if (!state.sex || validAge(state.age) === null) needs.push("your sex and age");
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

/**
 * Who the picture is of: Role, sex, age, how they look and the draft's seed.
 * Gear and chrome are deliberately not in it — buying a jacket must not redraw
 * a face — but changing the answers that make the face does.
 */
export function portraitBasis(state: ChargenState): string {
  const entries = readGeneralLifepath(state.lifepath.general).entries;
  return JSON.stringify([
    state.roleId,
    state.sex,
    validAge(state.age),
    state.castPlan?.seed ?? null,
    ...LOOK_ANSWERS.map((id) => (entries[id] ? displayValue(entries[id]) : null)),
  ]);
}

/** A picture drawn as somebody the answers no longer describe. */
export function portraitIsStale(state: ChargenState): boolean {
  return (
    state.portraitPath !== null &&
    state.portraitBasis !== null &&
    state.portraitBasis !== portraitBasis(state)
  );
}

/**
 * The stage to develop next, if any: straight to the best the answers support.
 * A stale picture develops again at that best stage even if it is not a better
 * one, because it is a picture of the wrong person.
 */
export function nextStageToDevelop(state: ChargenState): PortraitStage | null {
  const ready = portraitStageReady(state);
  if (ready === 0) return null;
  if (portraitIsStale(state)) return ready;
  return ready > state.portraitStage ? ready : null;
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

/**
 * How far through the interview the file is: the share of the steps BEFORE the
 * one that asks for a name that have been visited and answered. A step that
 * asks nothing still has to be reached, so skipping ahead does not sharpen the
 * picture. It is 1 on arriving at the identity step — the file does not wait
 * for the player to type a handle before it is in focus.
 */
export function fileProgress(state: ChargenState): number {
  const steps = stepsFor(state.method);
  const identity = steps.findIndex((s) => s.id === "identity");
  const before = identity >= 0 ? steps.slice(0, identity) : steps;
  if (before.length === 0) return 0;
  const done = before.filter(
    (s) => state.visited.includes(s.id) && validateStep(s.id, state).violations.length === 0,
  ).length;
  return done / before.length;
}

/**
 * How far through the interview the FIRST picture can appear: the Lifepath is
 * the step that answers how they look. The curve starts here, so the first
 * still is as blurred as the file ever gets and every answered step after it
 * sharpens the picture a little.
 */
export function firstPictureProgress(state: ChargenState): number {
  const steps = stepsFor(state.method);
  const identity = steps.findIndex((s) => s.id === "identity");
  const lifepath = steps.findIndex((s) => s.id === "lifepath");
  if (identity <= 0 || lifepath < 0) return 0;
  return (lifepath + 1) / identity;
}

/** How blurred the very first still is. Barely a face, on purpose. */
export const CLARITY_FLOOR = 0.1;

/**
 * The most each stage's picture may be developed before a better one exists.
 * It is a ceiling, not a band: the curve rises on its own and only waits at a
 * ceiling if the next picture is slow, so a file photo is never sharp before
 * the gear is on it.
 */
const CLARITY_CEILING: Record<PortraitStage, number> = { 1: 0.5, 2: 0.8, 3: 1 };

/**
 * How clear the picture on the file is, 0 (black) to 1 (sharp). One curve from
 * the first picture to the identity step — every answered step is a little
 * less fuzzy — and a new picture arrives at the clarity the curve is already
 * at, so nothing jumps. `start` is where the curve begins (`firstPictureProgress`).
 * `lifted` removes the ceiling when no better picture is coming (it failed, or
 * the budget is spent), so the file never stays blurred for want of one.
 */
export function portraitClarity(
  stage: 0 | PortraitStage,
  progress: number,
  start = 0,
  lifted = false,
): number {
  if (stage === 0) return 0;
  const along = start >= 1 ? 1 : (progress - start) / (1 - start);
  const raw = CLARITY_FLOOR + (1 - CLARITY_FLOOR) * Math.min(1, Math.max(0, along));
  return Math.min(lifted ? 1 : CLARITY_CEILING[stage], raw);
}
