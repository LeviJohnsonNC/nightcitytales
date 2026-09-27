/**
 * The character creator's soundtrack, played.
 *
 * One player for the whole creator, crossfading between cues as the scene
 * changes. It is a module rather than a component because the reveal's track
 * has to outlive the page that starts it: "Enter Night City" navigates to the
 * cold open and the music keeps going.
 *
 * Two voices decide what plays: the BASE cue, set by the step, and an OVERRIDE
 * a part of a step can hold while it is on screen (the Lifepath's "who is still
 * out there" chapter). Keeping them apart means it does not matter which of the
 * two effects React runs first.
 *
 * Nothing plays before the player has touched the page (browsers refuse
 * autoplay, and a page that starts shouting is rude anyway), while the tab is
 * hidden, or when the player has turned it off. A cue with no uploaded file is
 * silence, so the creator works the same before the soundtrack exists.
 * Everything is inert outside a browser.
 */
import { uploadedAsset } from "../art";
import { CUE_FILES, cueLoops, type Cue } from "./soundtrack";

const STORAGE_KEY = "nct.music";
/** Music sits under the reading, never over it. */
const LEVEL = 0.35;
const FADE_MS = 1400;
const STEP_MS = 50;

type Voice = { cue: Cue; el: HTMLAudioElement };

let base: Cue | null = null;
let override: Cue | null = null;
let current: Voice | null = null;
let unlocked = false;
let listening = false;
let enabled = readEnabled();
const listeners = new Set<(on: boolean) => void>();

function browser(): boolean {
  return typeof window !== "undefined" && typeof Audio !== "undefined";
}

function readEnabled(): boolean {
  try {
    if (typeof localStorage !== "undefined") return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    /* private mode or blocked storage: default on */
  }
  return true;
}

/** Ramp one voice's volume, then optionally let it go. */
function fade(el: HTMLAudioElement, to: number, then?: () => void): void {
  const from = el.volume;
  const steps = Math.max(1, Math.round(FADE_MS / STEP_MS));
  let i = 0;
  const timer = window.setInterval(() => {
    i += 1;
    el.volume = Math.max(0, Math.min(1, from + ((to - from) * i) / steps));
    if (i >= steps) {
      window.clearInterval(timer);
      then?.();
    }
  }, STEP_MS);
}

function release(voice: Voice | null): void {
  if (!voice) return;
  fade(voice.el, 0, () => {
    voice.el.pause();
    voice.el.removeAttribute("src");
    voice.el.load();
  });
}

function wanted(): Cue | null {
  return override ?? base;
}

function apply(): void {
  if (!browser()) return;
  const cue = wanted();
  if (!unlocked || !enabled || cue === null) {
    release(current);
    current = null;
    return;
  }
  // A hidden tab pauses in place, so coming back picks the track up where it was.
  if (document.hidden) {
    current?.el.pause();
    return;
  }
  if (current?.cue === cue) {
    if (current.el.paused && !current.el.ended) void current.el.play().catch(() => {});
    return;
  }
  release(current);
  current = null;
  const url = uploadedAsset(CUE_FILES[cue]);
  if (!url) return; // Not uploaded yet: silence, and the creator carries on.
  const el = new Audio(url);
  el.loop = cueLoops(cue);
  el.volume = 0;
  el.preload = "auto";
  current = { cue, el };
  void el.play().then(
    () => fade(el, LEVEL),
    () => {
      // Refused (usually autoplay). Try again on the next touch.
      if (current?.el === el) current = null;
      unlocked = false;
    },
  );
}

function listen(): void {
  if (listening || !browser()) return;
  listening = true;
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    apply();
  };
  window.addEventListener("pointerdown", unlock, { capture: true });
  window.addEventListener("keydown", unlock, { capture: true });
  document.addEventListener("visibilitychange", apply);
}

/** The step's cue. Null stops the music (leaving the creator). */
export function setBaseCue(cue: Cue | null): void {
  listen();
  base = cue;
  apply();
}

/** A part of a step holding its own cue while on screen; null hands back to the step. */
export function setCueOverride(cue: Cue | null): void {
  listen();
  override = cue;
  apply();
}

/** What is playing, or would be once the page is touched. */
export function currentCue(): Cue | null {
  return wanted();
}

export function isMusicEnabled(): boolean {
  return enabled;
}

export function setMusicEnabled(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn(on));
  if (on) unlocked = true; // The click that turned it on is the gesture.
  apply();
}

/** Subscribe to the toggle, so every control shows the same state. */
export function onMusicChange(fn: (on: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
