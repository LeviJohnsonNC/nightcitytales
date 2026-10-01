/**
 * The soundtrack, played: the engine behind NCAmp.
 *
 * A shuffled playlist (`soundtrack.ts`): one track after another, each fading
 * into the next a few seconds before it ends, reshuffling when the round is
 * done, never two takes of one song back to back. On top of that sit the
 * controls a player has — play, pause, stop, previous, next, seek, pick a
 * track, volume, balance, shuffle, repeat, a ten-band equalizer — and one
 * state object every view of the player reads (`subscribePlayer`), so the
 * strip in the bar and the full window can never disagree.
 *
 * It is a module rather than a component because the music has to outlive the
 * page that starts it: "Enter Night City" navigates to the cold open, and the
 * track that was playing carries on into it and ends there, with nothing after.
 *
 * It tries to play as soon as the creator opens. Arriving from the roster is a
 * click, and a browser that has seen one lets the page play sound. When the
 * browser does refuse — a reload, or /create opened directly — the player
 * says the music is waiting and the next touch starts it.
 *
 * Sound goes through Web Audio when every track is served from this site:
 * each element → its own fade gain → preamp → ten filters → balance → volume
 * → analyser → speakers. That is what makes the equalizer and the visualizer
 * real. A file from another origin would come through that chain as silence,
 * so if any track is not same-origin, the chain is not built at all: the music
 * still plays, with volume only, and the visualizer lies flat.
 *
 * Two audio elements are made once and reused for every track: Safari unlocks
 * an element, not a page, so an element that has played once may play again.
 *
 * Nothing plays while the tab is hidden, and a player who pressed Stop is
 * remembered as having done so. Everything is inert outside a browser.
 */
import { uploadedAsset } from "@/features/chargen/art";
import { EQ_BANDS, dbToGain, normalizeEq, type EqSettings } from "./equalizer";
import { playlist as rotation, shuffleRound } from "./soundtrack";
import { inTitleOrder } from "./trackTitles";

/** Every track, in the order the playlist window lists them. */
function playlist(): string[] {
  return inTitleOrder(rotation());
}

const ENABLED_KEY = "nct.music";
const PREFS_KEY = "nct.ncamp.player";
/** Starting, stopping, pausing: quick enough to feel like a response. */
const FADE_MS = 1400;
/** One track into the next: long enough to be a blend rather than a cut. */
const CROSSFADE_MS = 5000;
const STEP_MS = 50;
/** Music sits under the reading unless the player turns it up. */
const DEFAULT_VOLUME = 0.35;

export type PlayerStatus = "playing" | "paused" | "stopped";

export type PlayerState = {
  status: PlayerStatus;
  /** The track playing, paused, or last played. */
  track: string | null;
  position: number;
  duration: number;
  /** The browser is holding the music until the page is touched. */
  blocked: boolean;
  /** Every track in the rotation, in playlist order. */
  tracks: string[];
  /** Lengths, in seconds, as they become known. */
  durations: Record<string, number>;
  /** Average bitrate, in kbps, as it becomes known. */
  bitrates: Record<string, number>;
  shuffle: boolean;
  repeat: boolean;
  /** 0 to 1. */
  volume: number;
  /** -1 (left) to 1 (right). */
  balance: number;
  eq: EqSettings;
  /** Whether the equalizer, balance and visualizer are wired to real sound. */
  analysable: boolean;
};

type Prefs = Pick<PlayerState, "shuffle" | "repeat" | "volume" | "balance" | "eq">;
type Voice = { track: string; el: HTMLAudioElement };

type Graph = {
  ctx: AudioContext;
  preamp: GainNode;
  filters: BiquadFilterNode[];
  panner: StereoPannerNode;
  master: GainNode;
  analyser: AnalyserNode;
  voices: Map<HTMLAudioElement, GainNode>;
};

/** Whether the creator (or the track it handed on) wants music at all. */
let active = false;
/** Play out the current track, then stop: the hand-off into night one. */
let finishing = false;
/** False after the player pressed Stop (remembered); Play sets it again. */
let enabled = readEnabled();
/** The player pressed Pause; the track waits where it is. */
let paused = false;
let current: Voice | null = null;
/** What is left of this round of the shuffle. */
let queue: string[] = [];
/** Rounds started since the player last pressed Play, for repeat-off. */
let rounds = 0;
/** The tracks played, most recent last, for Previous. */
let history: string[] = [];
let lastPlayed: string | null = null;
/** False only after the browser has refused to play; a touch sets it again. */
let allowed = true;
/** When a touch last started music the browser had refused. */
let unblockedAt = -Infinity;
let listening = false;
let prefs: Prefs = readPrefs();
const durations: Record<string, number> = {};
const bitrates: Record<string, number> = {};
let pool: HTMLAudioElement[] = [];
/** Each element's own fade level, 0 to 1, before volume. */
const levels = new Map<HTMLAudioElement, number>();
const fades = new Map<HTMLAudioElement, number>();
let graph: Graph | null = null;
let graphTried = false;

const enabledListeners = new Set<(on: boolean) => void>();
const blockedListeners = new Set<(blocked: boolean) => void>();
const stateListeners = new Set<() => void>();
let snapshot: PlayerState = buildSnapshot();

// ── storage ──────────────────────────────────────────────────────────────

function browser(): boolean {
  return typeof window !== "undefined" && typeof Audio !== "undefined";
}

function readEnabled(): boolean {
  try {
    if (typeof localStorage !== "undefined") return localStorage.getItem(ENABLED_KEY) !== "off";
  } catch {
    /* private mode or blocked storage: default on */
  }
  return true;
}

function writeEnabled(on: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, on ? "on" : "off");
  } catch {
    /* ignore */
  }
}

function readPrefs(): Prefs {
  const fallback: Prefs = {
    shuffle: true,
    repeat: true,
    volume: DEFAULT_VOLUME,
    balance: 0,
    eq: normalizeEq(null),
  };
  try {
    if (typeof localStorage === "undefined") return fallback;
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null") as Partial<Prefs> | null;
    if (!raw) return fallback;
    return {
      shuffle: raw.shuffle !== false,
      repeat: raw.repeat !== false,
      volume: clamp01(Number(raw.volume ?? DEFAULT_VOLUME)),
      balance: Math.max(-1, Math.min(1, Number(raw.balance ?? 0) || 0)),
      eq: normalizeEq(raw.eq),
    };
  } catch {
    return fallback;
  }
}

function writePrefs(): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : DEFAULT_VOLUME;
}

// ── state ────────────────────────────────────────────────────────────────

function status(): PlayerStatus {
  if (current && !current.el.paused) return "playing";
  if (current && paused) return "paused";
  return "stopped";
}

function buildSnapshot(): PlayerState {
  const el = current?.el;
  return {
    status: status(),
    track: current?.track ?? lastPlayed,
    position: el ? el.currentTime || 0 : 0,
    duration: el && Number.isFinite(el.duration) ? el.duration : 0,
    blocked: !allowed && enabled && active,
    tracks: browser() ? playlist() : [],
    durations: { ...durations },
    bitrates: { ...bitrates },
    ...prefs,
    analysable: graph !== null,
  };
}

function emit(): void {
  snapshot = buildSnapshot();
  stateListeners.forEach((fn) => fn());
}

/** For `useSyncExternalStore`: every change to anything the player shows. */
export function subscribePlayer(fn: () => void): () => void {
  stateListeners.add(fn);
  return () => stateListeners.delete(fn);
}

export function getPlayerState(): PlayerState {
  return snapshot;
}

function setAllowed(next: boolean): void {
  if (allowed === next) return;
  allowed = next;
  blockedListeners.forEach((fn) => fn(!next));
  emit();
}

// ── sound ────────────────────────────────────────────────────────────────

function sameOrigin(url: string): boolean {
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

/** Build the Web Audio chain once, if every track can go through it. */
function ensureGraph(): Graph | null {
  if (graph || graphTried) return graph;
  graphTried = true;
  const Ctor =
    typeof AudioContext !== "undefined"
      ? AudioContext
      : (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  const urls = playlist().map((track) => uploadedAsset(track));
  if (urls.length === 0 || urls.some((url) => !url || !sameOrigin(url))) return null;
  try {
    const ctx = new Ctor();
    const preamp = ctx.createGain();
    const filters = EQ_BANDS.map((hz, i) => {
      const filter = ctx.createBiquadFilter();
      filter.type = i === 0 ? "lowshelf" : i === EQ_BANDS.length - 1 ? "highshelf" : "peaking";
      filter.frequency.value = hz;
      filter.Q.value = 1.4;
      return filter;
    });
    const panner = ctx.createStereoPanner();
    const master = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.6;
    let node: AudioNode = preamp;
    for (const filter of filters) {
      node.connect(filter);
      node = filter;
    }
    node.connect(panner);
    panner.connect(master);
    master.connect(analyser);
    analyser.connect(ctx.destination);
    const voices = new Map<HTMLAudioElement, GainNode>();
    for (const el of elements()) {
      const source = ctx.createMediaElementSource(el);
      const gain = ctx.createGain();
      gain.gain.value = levels.get(el) ?? 0;
      source.connect(gain);
      gain.connect(preamp);
      voices.set(el, gain);
      el.volume = 1;
    }
    graph = { ctx, preamp, filters, panner, master, analyser, voices };
    applyMix();
    return graph;
  } catch {
    graph = null;
    return null;
  }
}

/** Push volume, balance and the equalizer onto whatever carries the sound. */
function applyMix(): void {
  if (graph) {
    const eq = prefs.eq;
    graph.preamp.gain.value = eq.on ? dbToGain(eq.preamp) : 1;
    graph.filters.forEach((filter, i) => {
      filter.gain.value = eq.on ? (eq.bands[i] ?? 0) : 0;
    });
    graph.panner.pan.value = prefs.balance;
    graph.master.gain.value = prefs.volume * duckLevel;
    return;
  }
  for (const el of pool) el.volume = clamp01((levels.get(el) ?? 0) * prefs.volume * duckLevel);
}

function setLevel(el: HTMLAudioElement, level: number): void {
  levels.set(el, level);
  const voice = graph?.voices.get(el);
  if (voice) voice.gain.value = level;
  else el.volume = Math.max(0, Math.min(1, level * prefs.volume * duckLevel));
}

// ── ducking ──────────────────────────────────────────────────────────────

/** How far under the music sits while something else speaks: 1 is not at all. */
let duckLevel = 1;
let duckTimer: number | null = null;
let duckUntil = 0;
/** How far the music dips under a dice roll. */
const DUCK_DEPTH = 0.65;
/** The depth of the dip in force now; the deepest of any that overlap. */
let duckDepth = DUCK_DEPTH;

/**
 * Dip the music for `ms`, then bring it back: a dice roll is heard over the
 * soundtrack rather than fighting it. Overlapping dips extend one another
 * instead of stacking deeper — unless one asks for a deeper `depth`, as the
 * descent into a new campaign does, in which case the deepest wins.
 */
export function duckMusic(ms: number, depth: number = DUCK_DEPTH): void {
  if (typeof window === "undefined") return;
  const now = performance.now();
  duckDepth = now < duckUntil ? Math.min(duckDepth, depth) : depth;
  duckUntil = Math.max(duckUntil, now + ms);
  if (duckTimer !== null) return;
  duckTimer = window.setInterval(() => {
    const target = performance.now() < duckUntil ? duckDepth : 1;
    // Down fast, back up slowly.
    const rate = target < duckLevel ? 0.35 : 0.06;
    duckLevel += (target - duckLevel) * rate;
    if (target === 1 && Math.abs(1 - duckLevel) < 0.01) {
      duckLevel = 1;
      window.clearInterval(duckTimer!);
      duckTimer = null;
    }
    applyMix();
  }, STEP_MS);
}

/** End a dip now, so the music swells back rather than waiting out the time it was asked for. */
export function releaseDuck(): void {
  duckUntil = 0;
}

/** Ramp one element's fade level, then optionally let it go. A new fade cancels the old. */
function fade(el: HTMLAudioElement, to: number, ms: number, then?: () => void): void {
  const running = fades.get(el);
  if (running !== undefined) window.clearInterval(running);
  const from = levels.get(el) ?? 0;
  const steps = Math.max(1, Math.round(ms / STEP_MS));
  let i = 0;
  const timer = window.setInterval(() => {
    i += 1;
    setLevel(el, from + ((to - from) * i) / steps);
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
  fade(voice.el, 0, ms, () => {
    voice.el.pause();
    emit();
  });
}

/** The two elements, made once, each handing on to the next track as it nears its end. */
function elements(): HTMLAudioElement[] {
  if (pool.length > 0) return pool;
  pool = [new Audio(), new Audio()];
  for (const el of pool) {
    el.preload = "auto";
    el.loop = false;
    levels.set(el, 0);
    el.addEventListener("timeupdate", () => {
      if (current?.el !== el) return;
      emit();
      if (!Number.isFinite(el.duration) || el.paused) return;
      if (el.duration - el.currentTime <= CROSSFADE_MS / 1000) advance();
    });
    el.addEventListener("loadedmetadata", () => {
      if (current?.el === el && Number.isFinite(el.duration)) {
        durations[current.track] = el.duration;
        emit();
      }
    });
    el.addEventListener("ended", () => {
      if (current?.el === el) advance();
    });
    el.addEventListener("pause", emit);
    el.addEventListener("play", emit);
  }
  return pool;
}

/** The element not carrying `outgoing`, which is still fading out and must be left to finish. */
function spareElement(outgoing: HTMLAudioElement | undefined): HTMLAudioElement {
  const [a, b] = elements();
  return a === outgoing ? b! : a!;
}

/** Only the autoplay rule waits for a touch; a file this browser cannot decode is skipped. */
function refused(error: unknown): boolean {
  if ((error as { name?: string } | null)?.name !== "NotAllowedError") return false;
  setAllowed(false);
  return true;
}

/** The Web Audio clock is also held until a touch; give it a moment to start. */
async function soundReady(): Promise<boolean> {
  const g = ensureGraph();
  if (!g || g.ctx.state === "running") return true;
  await Promise.race([g.ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 300))]);
  // Read again: resume() has had its chance to change it.
  return (g.ctx.state as AudioContextState) === "running";
}

// ── the playlist ─────────────────────────────────────────────────────────

/** The next track by the player's rules, or null when repeat is off and it has all played. */
function pickNext(): string | null {
  const tracks = playlist();
  if (tracks.length === 0) return null;
  if (prefs.shuffle) {
    if (queue.length === 0) {
      if (rounds > 0 && !prefs.repeat) return null;
      queue = shuffleRound(tracks, lastPlayed);
      rounds += 1;
    }
    return queue.shift() ?? null;
  }
  const i = lastPlayed ? tracks.indexOf(lastPlayed) : -1;
  if (i + 1 < tracks.length) return tracks[i + 1]!;
  return prefs.repeat ? tracks[0]! : null;
}

/** Start `track` on the spare element, crossfading from what is playing over `ms`. */
function begin(track: string, ms: number, attempts = playlist().length): void {
  if (!browser()) return;
  const url = uploadedAsset(track);
  if (!url) return;
  const outgoing = current;
  release(outgoing, ms);
  const el = spareElement(outgoing?.el);
  const running = fades.get(el);
  if (running !== undefined) window.clearInterval(running);
  fades.delete(el);
  el.pause();
  el.src = url;
  setLevel(el, 0);
  el.currentTime = 0;
  const voice = { track, el };
  current = voice;
  paused = false;
  lastPlayed = track;
  if (history[history.length - 1] !== track) history = [...history.slice(-49), track];
  emit();
  void (async () => {
    if (!(await soundReady())) {
      if (current === voice) current = null;
      setAllowed(false);
      return;
    }
    if (current !== voice) return;
    el.play().then(
      () => {
        if (current === voice) fade(el, 1, ms);
        emit();
      },
      (e: unknown) => {
        if (current !== voice) return;
        current = null;
        if (!refused(e) && attempts > 1) {
          const next = pickNext();
          if (next) begin(next, ms, attempts - 1);
        }
        emit();
      },
    );
  })();
}

/** The current track is nearly over: hand on to the next, or end if that was the last. */
function advance(): void {
  const outgoing = current;
  if (finishing || !active) {
    current = null;
    release(outgoing, CROSSFADE_MS);
    active = false;
    finishing = false;
    emit();
    return;
  }
  if (!enabled || !allowed || document.hidden) return;
  const next = pickNext();
  if (!next) {
    current = null;
    release(outgoing, CROSSFADE_MS);
    emit();
    return;
  }
  begin(next, CROSSFADE_MS);
}

/** Bring what is playing in line with whether it should be. */
function apply(): void {
  if (!browser()) return;
  if (!active || !enabled) {
    const outgoing = current;
    current = null;
    paused = false;
    release(outgoing);
    emit();
    return;
  }
  // A hidden tab pauses in place, so coming back picks the track up where it was.
  if (document.hidden) {
    for (const el of pool) el.pause();
    return;
  }
  if (!allowed || paused) return;
  if (current) {
    if (current.el.paused && !current.el.ended) resume();
    return;
  }
  const next = pickNext();
  if (next) begin(next, FADE_MS);
}

function resume(): void {
  if (!current) return;
  const { el } = current;
  paused = false;
  void soundReady().then((ready) => {
    if (!ready) return setAllowed(false);
    el.play().then(
      () => fade(el, 1, 300),
      (e: unknown) => refused(e),
    );
  });
}

function listen(): void {
  if (listening || !browser()) return;
  listening = true;
  // Runs inside the gesture, so what it starts counts as the player's.
  const unlock = () => {
    if (graph && graph.ctx.state !== "running") void graph.ctx.resume();
    if (allowed) return;
    setAllowed(true);
    unblockedAt = performance.now();
    apply();
  };
  window.addEventListener("pointerdown", unlock, { capture: true });
  window.addEventListener("keydown", unlock, { capture: true });
  document.addEventListener("visibilitychange", apply);
}

// ── the creator's hooks ──────────────────────────────────────────────────

/** The creator is open: play the soundtrack. Already playing, it carries on. */
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

// ── the controls ─────────────────────────────────────────────────────────

function turnOn(): void {
  if (!enabled) {
    enabled = true;
    writeEnabled(true);
    enabledListeners.forEach((fn) => fn(true));
  }
  setAllowed(true); // The click on a control is the gesture.
}

/** Play: resume a pause, restart the track playing, or start the last one again. */
export function play(): void {
  listen();
  turnOn();
  active = true;
  if (current && paused) return resume();
  if (current) {
    current.el.currentTime = 0;
    emit();
    return;
  }
  rounds = 0;
  const track = lastPlayed ?? pickNext();
  if (track) begin(track, 300);
}

/** Pause toggles, as it always has. */
export function pause(): void {
  if (!current) return;
  if (paused || current.el.paused) return play();
  paused = true;
  current.el.pause();
  emit();
}

/** Stop: silence, back to the top of the track, and remembered until Play. */
export function stop(): void {
  enabled = false;
  writeEnabled(false);
  enabledListeners.forEach((fn) => fn(false));
  const outgoing = current;
  current = null;
  paused = false;
  release(outgoing, 250);
  emit();
}

/** Next track, by the shuffle and repeat rules — but the button always goes somewhere. */
export function next(): void {
  const track = pickNext() ?? playlist()[0];
  if (!track) return;
  turnOn();
  active = true;
  begin(track, 600);
}

/** The track before this one, or the one above it in the list without a history. */
export function previous(): void {
  const tracks = playlist();
  if (tracks.length === 0) return;
  const earlier = history.slice(0, -1);
  let track = earlier[earlier.length - 1];
  if (track) history = earlier.slice(0, -1);
  else {
    const i = lastPlayed ? tracks.indexOf(lastPlayed) : 0;
    track = tracks[(i - 1 + tracks.length) % tracks.length]!;
  }
  turnOn();
  active = true;
  begin(track, 600);
}

/** Play this track now (a double-click in the playlist). */
export function playTrack(track: string): void {
  if (!playlist().includes(track)) return;
  queue = queue.filter((t) => t !== track);
  turnOn();
  active = true;
  begin(track, 600);
}

/** Jump to a point in the track, 0 to 1 of the way through. */
export function seek(fraction: number): void {
  const el = current?.el;
  if (!el || !Number.isFinite(el.duration)) return;
  el.currentTime = Math.max(0, Math.min(el.duration - 0.5, fraction * el.duration));
  emit();
}

function updatePrefs(patch: Partial<Prefs>): void {
  prefs = { ...prefs, ...patch };
  writePrefs();
  applyMix();
  emit();
}

export function setVolume(volume: number): void {
  updatePrefs({ volume: clamp01(volume) });
}

export function setBalance(balance: number): void {
  const b = Math.max(-1, Math.min(1, balance));
  updatePrefs({ balance: Math.abs(b) < 0.08 ? 0 : b });
}

export function setShuffle(on: boolean): void {
  queue = [];
  rounds = 0;
  updatePrefs({ shuffle: on });
}

export function setRepeat(on: boolean): void {
  updatePrefs({ repeat: on });
}

export function setEq(eq: EqSettings): void {
  updatePrefs({ eq: normalizeEq(eq) });
}

/**
 * Learn every track's length and bitrate, for the playlist's times and the
 * kbps box. Metadata only: a few kilobytes per track, once per session.
 */
let surveyed = false;
export function surveyTracks(): void {
  if (surveyed || !browser()) return;
  surveyed = true;
  for (const track of playlist()) {
    const url = uploadedAsset(track);
    if (!url) continue;
    const probe = new Audio();
    probe.preload = "metadata";
    probe.addEventListener(
      "loadedmetadata",
      () => {
        if (Number.isFinite(probe.duration)) durations[track] = probe.duration;
        emit();
        probe.removeAttribute("src");
        probe.load();
        void fetch(url, { method: "HEAD" })
          .then((res) => {
            const bytes = Number(res.headers.get("content-length"));
            if (bytes > 0 && durations[track]) {
              bitrates[track] = Math.round((bytes * 8) / durations[track]! / 1000);
              emit();
            }
          })
          .catch(() => {});
      },
      { once: true },
    );
    probe.src = url;
  }
}

/**
 * Fill `into` with the spectrum (true) or the waveform (false), 0–255 per bin.
 * False when nothing real can be read — no chain, or nothing playing.
 */
export function readAnalyser(into: Uint8Array<ArrayBuffer>, spectrum: boolean): boolean {
  if (!graph || status() !== "playing") return false;
  if (spectrum) graph.analyser.getByteFrequencyData(into);
  else graph.analyser.getByteTimeDomainData(into);
  return true;
}

/** How many bins `readAnalyser` fills; size the buffer to this. */
export function analyserSize(): number {
  return graph?.analyser.frequencyBinCount ?? 1024;
}

/** The sample rate the chain runs at, for the kHz box. */
export function sampleRateKhz(): number {
  return graph ? Math.round(graph.ctx.sampleRate / 1000) : 44;
}

// ── the older switch-shaped API, still used by tests and the toggle ──────

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
  if (on) {
    turnOn();
    apply();
  } else stop();
}

/** True while the browser has refused to play and is waiting for a touch. */
export function isMusicBlocked(): boolean {
  return !allowed;
}

/**
 * Whether a touch in the last moment was the one that started refused music,
 * so a control does not then undo what that touch began.
 */
export function justUnblocked(): boolean {
  return performance.now() - unblockedAt < 1000;
}

export function onMusicBlocked(fn: (blocked: boolean) => void): () => void {
  blockedListeners.add(fn);
  return () => blockedListeners.delete(fn);
}

export function onMusicChange(fn: (on: boolean) => void): () => void {
  enabledListeners.add(fn);
  return () => enabledListeners.delete(fn);
}
