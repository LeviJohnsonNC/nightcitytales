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
 * It tries to play as soon as a cue is set. Arriving from the roster is a
 * click, and a browser that has seen one lets the page play sound; waiting for
 * a SECOND touch, as this once did, left the meet silent until the player
 * clicked something on it. When the browser does refuse — a reload, or /create
 * opened directly, where no page can play sound before a touch — the player is
 * told the music is waiting (`onMusicBlocked`) and the next touch starts it.
 *
 * Two audio elements are made once and reused for every cue, crossfading
 * between them, rather than a new one per cue: Safari unlocks an element, not
 * a page, so an element that has played once may play again unprompted.
 *
 * Nothing plays while the tab is hidden or when the player has turned it off.
 * A cue with no uploaded file is silence, so the creator works the same before
 * the soundtrack exists. Everything is inert outside a browser.
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
/** False only after the browser has refused to play; a touch sets it again. */
let allowed = true;
/** When a touch last started music the browser had refused, so the toggle can ignore that click. */
let unblockedAt = -Infinity;
let listening = false;
let enabled = readEnabled();
const listeners = new Set<(on: boolean) => void>();
const blockedListeners = new Set<(blocked: boolean) => void>();
/** The two reusable elements, made on first use. */
let pool: HTMLAudioElement[] = [];
const fades = new Map<HTMLAudioElement, number>();

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

function setAllowed(next: boolean): void {
  if (allowed === next) return;
  allowed = next;
  blockedListeners.forEach((fn) => fn(!next));
}

/** Ramp one element's volume, then optionally let it go. A new fade cancels the old. */
function fade(el: HTMLAudioElement, to: number, then?: () => void): void {
  const running = fades.get(el);
  if (running !== undefined) window.clearInterval(running);
  const from = el.volume;
  const steps = Math.max(1, Math.round(FADE_MS / STEP_MS));
  let i = 0;
  const timer = window.setInterval(() => {
    i += 1;
    el.volume = Math.max(0, Math.min(1, from + ((to - from) * i) / steps));
    if (i >= steps) {
      window.clearInterval(timer);
      fades.delete(el);
      then?.();
    }
  }, STEP_MS);
  fades.set(el, timer);
}

function release(voice: Voice | null): void {
  if (!voice) return;
  fade(voice.el, 0, () => voice.el.pause());
}

/** The element not carrying `outgoing`, which is still fading out and must be left to finish. */
function spareElement(outgoing: HTMLAudioElement | undefined): HTMLAudioElement {
  if (pool.length === 0) {
    pool = [new Audio(), new Audio()];
    for (const el of pool) el.preload = "auto";
  }
  return pool[0] === outgoing ? pool[1]! : pool[0]!;
}

/**
 * A play() the browser turned down. Only the autoplay rule waits for a touch;
 * a file this browser cannot decode is silence, and asking the player to tap
 * for music that will never come would be a lie.
 */
function refused(error: unknown): void {
  if ((error as { name?: string } | null)?.name === "NotAllowedError") setAllowed(false);
}

function wanted(): Cue | null {
  return override ?? base;
}

function apply(): void {
  if (!browser()) return;
  const cue = wanted();
  if (!enabled || cue === null) {
    release(current);
    current = null;
    return;
  }
  // A hidden tab pauses in place, so coming back picks the track up where it was.
  if (document.hidden) {
    current?.el.pause();
    return;
  }
  if (!allowed) return; // Refused once already; the next touch tries again.
  if (current?.cue === cue) {
    if (current.el.paused && !current.el.ended) {
      const el = current.el;
      void el.play().then(
        () => fade(el, LEVEL),
        (e: unknown) => refused(e),
      );
    }
    return;
  }
  const url = uploadedAsset(CUE_FILES[cue]);
  const outgoing = current;
  release(outgoing);
  current = null;
  if (!url) return; // Not uploaded yet: silence, and the creator carries on.
  const el = spareElement(outgoing?.el);
  const running = fades.get(el);
  if (running !== undefined) window.clearInterval(running);
  fades.delete(el);
  el.pause();
  el.src = url;
  el.loop = cueLoops(cue);
  el.volume = 0;
  el.currentTime = 0;
  const voice = { cue, el };
  current = voice;
  void el.play().then(
    () => {
      if (current === voice) fade(el, LEVEL);
    },
    (e: unknown) => {
      // Keep nothing half-started; if it was the autoplay rule, the next touch plays the cue.
      if (current === voice) current = null;
      refused(e);
    },
  );
}

function listen(): void {
  if (listening || !browser()) return;
  listening = true;
  // Runs inside the gesture, so the play() it leads to counts as the player's.
  const unlock = () => {
    if (allowed) return;
    setAllowed(true);
    unblockedAt = performance.now();
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
  if (on) setAllowed(true); // The click that turned it on is the gesture.
  apply();
}

/** True while the browser has refused to play and is waiting for a touch. */
export function isMusicBlocked(): boolean {
  return !allowed;
}

/**
 * Whether a touch in the last moment was the one that started refused music.
 * That touch is usually a click on the music switch itself, which would
 * otherwise turn off the music it has just started.
 */
export function justUnblocked(): boolean {
  return performance.now() - unblockedAt < 1000;
}

/** Subscribe to the browser refusing (true) and then allowing (false) the music. */
export function onMusicBlocked(fn: (blocked: boolean) => void): () => void {
  blockedListeners.add(fn);
  return () => blockedListeners.delete(fn);
}

/** Subscribe to the toggle, so every control shows the same state. */
export function onMusicChange(fn: (on: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
