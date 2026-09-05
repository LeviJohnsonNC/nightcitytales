import { useEffect, useRef, useState } from "react";
import type { PlaybackFrame } from "./combatPlayback";
import { createCombatAudio } from "./combatSound";
import { scheduleCombatCues, feedbackOffset } from "./combatFeedback";

export function useCombatFeedback(frame?: PlaybackFrame | null) {
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.45);
  const [reduced, setReduced] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const audio = useRef<ReturnType<typeof createCombatAudio> | null>(null);
  const played = useRef({ sequence: -1, cues: new Set<number>() });
  useEffect(() => {
    try {
      setMuted(localStorage.getItem("combat-muted") === "true");
      const saved = Number(localStorage.getItem("combat-volume") ?? 0.45);
      if (Number.isFinite(saved)) setVolume(Math.max(0, Math.min(1, saved)));
    } catch {
      /* Private storage is optional. */
    }
    const controller = createCombatAudio();
    audio.current = controller;
    const unlock = () => controller.unlock();
    const hide = () => {
      if (document.hidden) controller.stop();
    };
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(motion.matches);
    update();
    window.addEventListener("pointerdown", unlock, { capture: true });
    window.addEventListener("keydown", unlock, { capture: true });
    document.addEventListener("visibilitychange", hide);
    motion.addEventListener("change", update);
    return () => {
      controller.dispose();
      audio.current = null;
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      document.removeEventListener("visibilitychange", hide);
      motion.removeEventListener("change", update);
    };
  }, []);
  useEffect(() => {
    setOffset({ x: 0, y: 0 });
    if (!frame || frame.animate === false) {
      audio.current?.stop();
      return;
    }
    if (played.current.sequence !== frame.sequence)
      played.current = { sequence: frame.sequence, cues: new Set() };
    const start = frame.startedAt ?? Date.now();
    const cancelSound = muted
      ? () => {}
      : scheduleCombatCues(frame, played.current.cues, (sound) => {
          if (!document.hidden) audio.current?.play(sound, volume);
        });
    let raf = 0;
    const tick = () => {
      const elapsed = Date.now() - start;
      setOffset(feedbackOffset(frame, elapsed, reduced || document.hidden));
      if (elapsed < 500 && !reduced) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelSound();
      cancelAnimationFrame(raf);
      audio.current?.stop();
    };
    // A camera/selection render must not restart an effect or schedule a second shot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame?.sequence, frame?.animate, muted, volume, reduced]);
  return {
    offset,
    muted,
    volume,
    toggleMute: () => {
      const value = !muted;
      setMuted(value);
      if (value) audio.current?.stop();
      else audio.current?.unlock();
      try {
        localStorage.setItem("combat-muted", String(value));
      } catch {
        /* Optional. */
      }
    },
    changeVolume: (value: number) => {
      setVolume(value);
      try {
        localStorage.setItem("combat-volume", String(value));
      } catch {
        /* Optional. */
      }
    },
  };
}
