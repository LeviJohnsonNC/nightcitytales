/**
 * The character creator's soundtrack, played.
 *
 * A shuffled playlist (`soundtrack.ts`): one track after another, each fading
 * into the next a few seconds before it ends, reshuffling when the round is
 * done. Where the player is in the creator no longer decides what plays — the
 * steps took thirty seconds or ten minutes, and music cut to fit them either
 * stopped short or wore out.
 *
 * It is a module rather than a component because the music has to outlive the
 * page that starts it: "Enter Night City" navigates to the cold open, and the
 * track that was playing carries on into it and ends there, with nothing after.
 *
 * It tries to play as soon as the creator opens. Arriving from the roster is a
 * click, and a browser that has seen one lets the page play sound. When the
 * browser does refuse — a reload, or /create opened directly, where no page
 * can play sound before a touch — the player is told the music is waiting
 * (`onMusicBlocked`) and the next touch starts it.
 *
 * Two audio elements are made once and reused for every track, crossfading
 * between them: Safari unlocks an element, not a page, so an element that has
 * played once may play again unprompted.
 *
 * Nothing plays while the tab is hidden or when the player has turned it off.
 * With no tracks uploaded it is silence, and the creator works the same.
 * Everything is inert outside a browser.
 */
import { uploadedAsset } from "../art";
import { playlist, shuffleRound } from "./soundtrack";

const STORAGE_KEY = "nct.music";
/** Music sits under the reading, never over it. */
const LEVEL = 0.35;
/** Starting, stopping, pausing: quick enough to feel like a response. */
const FADE_MS = 1400;
/** One track into the next: long enough to be a blend rather than a cut. */
const CROSSFADE_MS = 5000;
const STEP_MS = 50;

type Voice = { track: string; el: HTMLAudioElement };

/** Whether the creator (or the track it handed on) wants music at all. */
let active = false;
/** Play out the current track, then stop: the hand-off into night one. */
let finishing = false;
let current: Voice | null = null;
/** What is left of this round of the shuffle. */
let queue: string[] = [];
let lastPlayed: string | null = null;
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
function fade(el: HTMLAudioElement, to: number, ms: number, then?: () => void): void {
  const running = fades.get(el);
  if (running !== undefined) window.clearInterval(running);
  const from = el.volume;
  const steps = Math.max(1, Math.round(ms / STEP_MS));
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

function release(voice: Voice | null, ms = FADE_MS): void {
  if (!voice) return;
  fade(voice.el, 0, ms, () => voice.el.pause());
}

/** The two elements, made once, each handing on to the next track as it nears its end. */
function elements(): HTMLAudioElement[] {
  if (pool.length > 0) return pool;
  pool = [new Audio(), new Audio()];
  for (const el of pool) {
    el.preload = "auto";
    el.loop = false;
    const nearEnd = () => {
      if (current?.el !== el || !Number.isFinite(el.duration)) return;
      if (el.duration - el.currentTime <= CROSSFADE_MS / 1000) advance();
    };
    el.addEventListener("timeupdate", nearEnd);
    el.addEventListener("ended", () => {
      if (current?.el === el) advance();
    });
  }
  return pool;
}

/** The element not carrying `outgoing`, which is still fading out and must be left to finish. */
function spareElement(outgoing: HTMLAudioElement | undefined): HTMLAudioElement {
  const [a, b] = elements();
  return a === outgoing ? b! : a!;
}

/**
 * A play() the browser turned down. Only the autoplay rule waits for a touch;
 * a file this browser cannot decode is skipped, and asking the player to tap
 * for music that will never come would be a lie.
 */
function refused(error: unknown): boolean {
  if ((error as { name?: string } | null)?.name !== "NotAllowedError") return false;
  setAllowed(false);
  return true;
}

/** The next track to play, reshuffling when the round runs out. */
function nextTrack(): string | null {
  if (queue.length === 0) queue = shuffleRound(playlist(), lastPlayed);
  return queue.shift() ?? null;
}

/** Start the next track on the spare element, fading it in over `ms`. */
function startNext(outgoing: Voice | null, ms: number, attempts = playlist().length): void {
  const track = nextTrack();
  const url = track ? uploadedAsset(track) : null;
  if (!track || !url) return; // Nothing uploaded: silence, and the creator carries on.
  const el = spareElement(outgoing?.el);
  const running = fades.get(el);
  if (running !== undefined) window.clearInterval(running);
  fades.delete(el);
  el.pause();
  el.src = url;
  el.volume = 0;
  el.currentTime = 0;
  const voice = { track, el };
  current = voice;
  lastPlayed = track;
  void el.play().then(
    () => {
      if (current === voice) fade(el, LEVEL, ms);
    },
    (e: unknown) => {
      if (current !== voice) return;
      current = null;
      if (refused(e)) {
        // Keep the track for the touch that will start it.
        queue.unshift(track);
        return;
      }
      // Undecodable here: try the next one, once round the list at most.
      if (attempts > 1) startNext(outgoing, ms, attempts - 1);
    },
  );
}

/** The current track is nearly over: hand on to the next, or end the music if it was the last. */
function advance(): void {
  const outgoing = current;
  current = null;
  if (finishing || !active) {
    release(outgoing, CROSSFADE_MS);
    active = false;
    finishing = false;
    return;
  }
  release(outgoing, CROSSFADE_MS);
  if (!enabled || !allowed || document.hidden) return;
  startNext(outgoing, CROSSFADE_MS);
}

function apply(): void {
  if (!browser()) return;
  if (!active || !enabled) {
    release(current);
    current = null;
    return;
  }
  // A hidden tab pauses in place, so coming back picks the track up where it was.
  if (document.hidden) {
    for (const el of pool) el.pause();
    return;
  }
  if (!allowed) return; // Refused once already; the next touch tries again.
  if (current) {
    if (current.el.paused && !current.el.ended) {
      const el = current.el;
      void el.play().then(
        () => fade(el, LEVEL, FADE_MS),
        (e: unknown) => refused(e),
      );
    }
    return;
  }
  startNext(null, FADE_MS);
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

/** The creator is open: play the shuffled soundtrack. Already playing, it carries on. */
export function startMusic(): void {
  listen();
  active = true;
  finishing = false;
  apply();
}

/** Leaving the creator: fade out now. */
export function stopMusic(): void {
  active = false;
  finishing = false;
  apply();
}

/**
 * Leaving the creator INTO the game: let the track that is playing run out,
 * then stop, so the character walks into night one under the music they were
 * made to and nothing starts after it.
 */
export function finishTrackThenStop(): void {
  if (current && !current.el.paused) finishing = true;
  else stopMusic();
}

/** What is playing now, by name; null when nothing is. */
export function currentTrack(): string | null {
  return current?.track ?? null;
}

/** Whether the creator currently wants music (it may still be waiting for a touch). */
export function isMusicActive(): boolean {
  return active;
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
