import { arenaFor, coverStatuses } from "@/engine";
import type { PlaybackFrame } from "./combatPlayback";
import { SHOT_TIMING } from "./courtyard/characterAnimation";

export type CombatSound =
  | "pistol"
  | "rifle"
  | "shotgun"
  | "smg"
  | "bow"
  | "launcher"
  | "melee"
  | "body"
  | "metal"
  | "wood"
  | "concrete"
  | "miss"
  | "reload"
  | "step"
  | "turn";
export type FeedbackCue = { at: number; sound: CombatSound };
/** Cancelable, once-only cues. Late/hidden-tab timers never dump stale sounds on return. */
export function scheduleCombatCues(
  frame: PlaybackFrame,
  played: Set<number>,
  play: (sound: CombatSound) => void,
) {
  const start = frame.startedAt ?? Date.now();
  const timers = feedbackCues(frame).map((cue, i) => {
    if (played.has(i) || Date.now() - start > cue.at + 70) return null;
    return setTimeout(
      () => {
        played.add(i);
        if (Date.now() - start - cue.at < 100) play(cue.sound);
      },
      Math.max(0, cue.at - (Date.now() - start)),
    );
  });
  return () =>
    timers.forEach((timer) => {
      if (timer !== null) clearTimeout(timer);
    });
}
export function feedbackCues(frame: PlaybackFrame): FeedbackCue[] {
  if (frame.animate === false) return [];
  if (frame.kind === "turn") return [{ at: 0, sound: "turn" }];
  if (frame.kind === "reload")
    return [
      { at: 80, sound: "reload" },
      { at: 430, sound: "reload" },
    ];
  if (frame.kind === "move") return [100, 320, 540].map((at) => ({ at, sound: "step" }));
  if (frame.kind !== "attack" && frame.kind !== "cover") return [];
  const weapons: Record<string, CombatSound> = {
    pistol: "pistol",
    smg: "smg",
    assault_rifle: "rifle",
    sniper_rifle: "rifle",
    shotgun_slug: "shotgun",
    bow_crossbow: "bow",
    grenade_launcher: "launcher",
    rocket_launcher: "launcher",
  };
  const fire: CombatSound =
    frame.attackStyle === "melee" ? "melee" : (weapons[frame.weaponRange ?? ""] ?? "pistol");
  const cues: FeedbackCue[] = [{ at: SHOT_TIMING.fire, sound: fire }];
  if (frame.hit === false) cues.push({ at: SHOT_TIMING.impact, sound: "miss" });
  if (frame.hit === true) {
    const cover = frame.coverPieceId
      ? coverStatuses(arenaFor(frame.live.arena), frame.live.cover).find(
          (s) => s.piece.id === frame.coverPieceId,
        )
      : null;
    const target = frame.targetId ? frame.live.state.combatants[frame.targetId] : null;
    const sound: CombatSound = cover
      ? cover.material === "wood"
        ? "wood"
        : cover.material === "concrete" || cover.material === "stone"
          ? "concrete"
          : "metal"
      : target && frame.targetHpBefore !== undefined && target.hp < frame.targetHpBefore
        ? "body"
        : "metal";
    cues.push({ at: SHOT_TIMING.impact, sound });
  }
  return cues;
}

/** Small shared-camera impulse; never a game position, never cumulative camera drift. */
export function feedbackOffset(
  frame: PlaybackFrame | null | undefined,
  elapsed: number,
  reduced: boolean,
) {
  if (!frame || frame.animate === false || reduced || !["attack", "cover"].includes(frame.kind))
    return { x: 0, y: 0 };
  const t = elapsed - SHOT_TIMING.fire;
  if (t < 0 || t > 230) return { x: 0, y: 0 };
  const amount = Math.sin((t / 230) * Math.PI * 2) * Math.pow(1 - t / 230, 2);
  return { x: amount * 2.5, y: amount * 1.1 };
}

export function playbackHeading(frame: PlaybackFrame) {
  const actor = frame.actorId ? frame.live.state.combatants[frame.actorId] : null;
  const target = frame.targetId ? frame.live.state.combatants[frame.targetId] : null;
  const verbs = {
    move: "Moving",
    attack: "Attacking",
    cover: "Attacking cover",
    turn: "Turn",
    reload: "Reloading",
    status: "Status",
  };
  return `${actor?.name ?? "Combat"} · ${verbs[frame.kind]}${target ? ` → ${target.name}` : ""}`;
}
