import { describe, expect, it } from "vitest";
import type { Combatant } from "@/engine";
import type { EncounterCombatant } from "@/lib/backend";
import { combatantDataOf } from "../encounterModel";
import type { PlaybackFrame } from "../combatPlayback";
import {
  animationCell,
  facingFor,
  movementSample,
  poseFor,
  muzzleOffset,
} from "../courtyard/characterAnimation";
import { battlefieldProjection } from "../battlefieldProjection";

const actor = { id: "p", hp: 20, hpMax: 35, defeated: false } as Combatant;
const shot = {
  sequence: 1,
  kind: "attack",
  actorId: "h",
  targetId: "p",
  targetHpBefore: 30,
  text: "arbitrary prose",
} as PlaybackFrame;
const pose = (over: Partial<Parameters<typeof poseFor>[0]> = {}) =>
  poseFor({
    actor,
    frame: shot,
    elapsed: 300,
    reducedMotion: false,
    movementDuration: 650,
    ...over,
  });

describe("character animation follows resolved outcomes", () => {
  it("aims, fires and recovers without changing combat state", () => {
    const before = JSON.stringify(actor);
    const frame = { ...shot, actorId: "p", targetId: "h" };
    expect(pose({ frame, elapsed: 80 })).toBe("aim");
    expect(pose({ frame, elapsed: 180 })).toBe("fire");
    expect(pose({ frame, elapsed: 700 })).toBe("aim");
    expect(pose({ frame: { ...frame, attackStyle: "melee" }, elapsed: 180 })).toBe("aim");
    expect(JSON.stringify(actor)).toBe(before);
  });
  it("reacts to HP loss after impact, never to miss text or armor-only hits", () => {
    expect(pose({ elapsed: 100 })).toBe("aim");
    expect(pose()).toBe("hurt");
    expect(pose({ frame: { ...shot, targetHpBefore: 20, impact: "HIT" } })).toBe("aim");
    expect(pose({ frame: { ...shot, targetHpBefore: 20, impact: "MISS" } })).toBe("aim");
    expect(pose({ frame: { ...shot, kind: "cover" } })).toBe("aim");
    expect(pose({ frame: { ...shot, targetId: "someone_else" } })).toBe("aim");
  });
  it("does not mistake zero HP, surrender or legacy defeat for death", () => {
    expect(pose({ actor: { ...actor, hp: 0 }, frame: null })).toBe("aim");
    expect(pose({ actor: { ...actor, defeated: true }, exitReason: "withdrawn" })).toBe("aim");
    expect(pose({ actor: { ...actor, defeated: true } })).toBe("aim");
    expect(pose({ actor, exitReason: "dead", frame: null })).toBe("aim");
  });
  it("plays a confirmed death, then retains the prone pose across reload and skip", () => {
    const input = {
      actor: { ...actor, defeated: true },
      exitReason: "dead" as const,
      frame: { ...shot, kind: "status" as const, actorId: "p" },
    };
    expect(pose({ ...input, elapsed: 80 })).toBe("hurt");
    expect(pose({ ...input, elapsed: 350 })).toBe("fall");
    expect(pose({ ...input, elapsed: 800 })).toBe("dead");
    expect(pose({ ...input, frame: null })).toBe("dead");
    expect(pose({ ...input, frame: { ...input.frame, animate: false } })).toBe("dead");
    expect(pose({ ...input, reducedMotion: true })).toBe("dead");
  });
  it("stops walking at the saved destination and respects skip and reduced motion", () => {
    const frame = {
      ...shot,
      kind: "move" as const,
      actorId: "p",
      path: [
        { x: 0, y: 0 },
        { x: 4, y: 2 },
      ],
    };
    expect(pose({ frame })).toBe("walk");
    expect(pose({ frame, elapsed: 650 })).toBe("aim");
    expect(pose({ frame: { ...frame, animate: false } })).toBe("aim");
    expect(pose({ frame, reducedMotion: true })).toBe("aim");
  });
  it("registers facing at a route corner instead of aiming at the final destination throughout", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 0, y: 4 },
      { x: 8, y: 4 },
    ];
    const { project } = battlefieldProjection(24, 24);
    const first = movementSample(path, 0.2),
      last = movementSample(path, 0.8);
    expect(facingFor(project(first.from!), project(first.to!), "sw")).toBe("ne");
    expect(facingFor(project(last.from!), project(last.to!), "sw")).toBe("se");
    expect(movementSample(path, 1).position).toEqual(path[2]);
    expect(facingFor({ x: 1, y: 1 }, { x: 1, y: 1 }, "nw")).toBe("nw");
    expect(movementSample([], 0.4).position).toBeNull();
  });
  it("uses inspected sheet directions and a four-frame gait, with correct muzzle sides", () => {
    expect(animationCell("ne", "aim", 0, true)).toEqual({ frame: 24, flipX: true });
    expect(animationCell("sw", "aim", 0, true)).toEqual({ frame: 16, flipX: false });
    expect(animationCell("se", "aim", 0, false)).toEqual({ frame: 8, flipX: false });
    expect(
      new Set([0, 105, 210, 315].map((t) => animationCell("ne", "walk", t, false).frame)).size,
    ).toBe(4);
    expect(muzzleOffset("ne").x).toBeGreaterThan(0);
    expect(muzzleOffset("sw").x).toBeLessThan(0);
  });
  it("loads only known exit receipts from the existing combatant JSON", () => {
    const row = (reason: unknown) =>
      ({ id: "h", data: { exitReason: reason } }) as unknown as EncounterCombatant;
    expect(combatantDataOf(row("dead")).exitReason).toBe("dead");
    expect(combatantDataOf(row("withdrawn")).exitReason).toBe("withdrawn");
    expect(combatantDataOf(row("exploded" as unknown)).exitReason).toBeUndefined();
    expect(combatantDataOf(row(undefined)).exitReason).toBeUndefined();
  });
});
