/**
 * The descent: from seven million lights to one window.
 *
 * The opening takes about ten seconds to write, and this is what those ten
 * seconds are. It narrows the city by the player's own facts, falls into the
 * one light that is theirs, and lands at a rain-streaked window with their
 * photograph on the sill — then holds there for as long as the model needs,
 * and hands over to the prose with a cut. It plays to the window every time;
 * only the hold is elastic.
 *
 * A pure function of time since the button was pressed (`descentClock`), drawn
 * on one canvas (`descentRender`), with the HUD written straight to the DOM
 * each frame so React is not asked to re-render sixty times a second.
 *
 * Presentation only: no paid call, no rule, no write.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { PHOTO_ANCHOR_Y, POLAROID_WINDOW } from "@/features/chargen/polaroidCrop";
import { uploadedAsset } from "@/features/chargen/art";
import { usePortraitUrl } from "@/features/chargen/usePortraitUrl";
import { cityLights, SEARCH_STEPS, searchCounts } from "./cityLights";
import { releaseDuck } from "@/features/music/musicDirector";
import { acquireDescentAudio, landDescentAudio, releaseDescentAudio } from "./descentAudio";
import { descentElapsed } from "./descentClock";
import { CITY_SEED, lightCount, prefersReducedMotion, weakDevice } from "./descentDevice";
import { HINGE_BUZZ, LOCK_BUZZ, haptic } from "./descentHaptics";
import type { DescentFacts } from "./descentFacts";
import { createRenderer, type Renderer } from "./descentRender";
import {
  BLACK_END_MS,
  CITY_END_MS,
  DIVE_END_MS,
  HINGE_MS,
  REDUCED_START_MS,
  SEARCH_END_MS,
  SKIP_AFTER_MS,
  SKIP_TO_MS,
  beatAt,
  populationAt,
  virtualTime,
  type Beat,
} from "./descentTimeline";
import { scrambled, typed } from "./descentText";
import "./descent.css";

const POPULATION = 7_000_000;

const TAGLINE_A = "Somewhere in seven million people,";
const TAGLINE_B = "one of them is you.";

function format(n: number): string {
  return n.toLocaleString("en-US");
}

/** The photograph, propped on the sill: the same print the file kept, now fully developed. */
function Polaroid({ path, alt }: { path: string | null; alt: string }) {
  const portrait = usePortraitUrl(path);
  const frame = uploadedAsset("file-polaroid");
  const window_ = POLAROID_WINDOW;
  const photo = portrait ? (
    <img
      src={portrait}
      alt={alt}
      style={{ objectPosition: `50% ${PHOTO_ANCHOR_Y}%` }}
      className="absolute inset-0 h-full w-full object-cover"
    />
  ) : null;
  return (
    <div className="dsc-polaroid relative w-44 -rotate-3 drop-shadow-[0_10px_18px_rgb(0_0_0/0.7)] sm:w-56">
      {frame ? (
        <>
          <div
            className="absolute overflow-hidden bg-black"
            style={{
              top: `${window_.top}%`,
              left: `${window_.left}%`,
              width: `${window_.width}%`,
              height: `${window_.height}%`,
            }}
          >
            {photo}
          </div>
          <img src={frame} alt="" aria-hidden className="relative block w-full" />
        </>
      ) : (
        <div className="aspect-square w-full bg-[#e9e4d6] p-2 pb-8">
          <div className="relative h-full w-full overflow-hidden bg-black">{photo}</div>
        </div>
      )}
    </div>
  );
}

export function Descent({
  facts,
  ready,
  onDone,
}: {
  /** The player's facts, once the campaign has loaded. Null waits at the end of the city. */
  facts: DescentFacts | null;
  /** The prose has arrived. The descent still finishes its fall first. */
  ready: boolean;
  /** The hand-over is done: show the opening. */
  onDone: () => void;
}) {
  const reduced = useMemo(prefersReducedMotion, []);
  const lowPower = useMemo(weakDevice, []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const taglineRef = useRef<HTMLParagraphElement>(null);
  const handleRef = useRef<HTMLSpanElement>(null);
  const rendererRef = useRef<Renderer | null>(null);

  const [beat, setBeat] = useState<Beat>("black");
  const [step, setStep] = useState(0);
  const [hinging, setHinging] = useState(false);
  const [canSkip, setCanSkip] = useState(false);
  const [lineIndex, setLineIndex] = useState(0);

  // The loop reads these without being restarted when they change.
  const factsRef = useRef(facts);
  factsRef.current = facts;
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const skipRef = useRef(false);

  const city = useMemo(
    () =>
      cityLights({
        count: lightCount(lowPower),
        seed: CITY_SEED,
        districtKey: facts?.districtKey ?? null,
        placeKey: facts?.placeKey ?? null,
      }),
    [lowPower, facts?.districtKey, facts?.placeKey],
  );
  const counts = useMemo(() => searchCounts(city, POPULATION), [city]);
  const cityRef = useRef(city);
  cityRef.current = city;
  const countsRef = useRef(counts);
  countsRef.current = counts;

  useEffect(() => {
    rendererRef.current?.setCity(city);
  }, [city]);

  // The loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // The music steps back for the fall and swells again at the cut; the sound
    // of the descent is made here, and is silent for a player who has music off.
    const audio = acquireDescentAudio();
    let landedSound = false;
    const renderer = createRenderer(canvas, cityRef.current, lowPower ? 1.25 : 2);
    rendererRef.current = renderer;
    const onResize = () => renderer.resize();
    window.addEventListener("resize", onResize);
    renderer.resize();

    let virtual = reduced
      ? REDUCED_START_MS
      : virtualTime(descentElapsed(), factsRef.current !== null);
    let previous = virtual;
    let last = performance.now();
    let raf = 0;
    let hingeAt: number | null = null;
    let shownBeat: Beat = "black";
    let shownStep = -1;
    let shownSkip = false;
    let finished = false;

    const frame = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;

      const waiting = factsRef.current === null && virtual >= CITY_END_MS;
      if (!waiting && !reduced) virtual += dt;
      if (reduced) virtual = Math.min(DIVE_END_MS + 1, virtual + dt);
      if (skipRef.current) {
        skipRef.current = false;
        virtual = Math.max(virtual, SKIP_TO_MS);
      }

      renderer.draw(virtual);
      audio?.update(virtual, previous);
      if (previous < SEARCH_END_MS && virtual >= SEARCH_END_MS) haptic(LOCK_BUZZ);
      previous = virtual;

      const nextBeat = beatAt(virtual);
      if (nextBeat !== shownBeat) {
        shownBeat = nextBeat;
        setBeat(nextBeat);
      }
      // Which filter the search has reached.
      const span = (SEARCH_END_MS - CITY_END_MS) / SEARCH_STEPS.length;
      const reached =
        virtual < CITY_END_MS
          ? 0
          : Math.min(SEARCH_STEPS.length, 1 + Math.floor((virtual - CITY_END_MS) / span));
      if (reached !== shownStep) {
        shownStep = reached;
        setStep(reached);
      }
      const skippable = virtual >= SKIP_AFTER_MS && virtual < DIVE_END_MS;
      if (skippable !== shownSkip) {
        shownSkip = skippable;
        setCanSkip(skippable);
      }

      if (counterRef.current) {
        counterRef.current.textContent = format(
          populationAt(virtual, POPULATION, countsRef.current),
        );
      }
      if (taglineRef.current) {
        const a = typed(TAGLINE_A, virtual, BLACK_END_MS + 200);
        const b = typed(TAGLINE_B, virtual, CITY_END_MS + 1800, 22);
        taglineRef.current.textContent = b ? `${TAGLINE_A} ${b}` : a;
      }
      if (handleRef.current && factsRef.current) {
        const who = factsRef.current.handle
          ? `"${factsRef.current.handle}"`
          : factsRef.current.name;
        handleRef.current.textContent = scrambled(
          who.toUpperCase(),
          (virtual - (DIVE_END_MS - 300)) / 900,
          3,
        );
      }

      // The hand-over, once the window is up and the prose is ready.
      if (virtual >= DIVE_END_MS && readyRef.current && hingeAt === null) {
        hingeAt = now;
        setHinging(true);
        audio?.hinge();
        releaseDuck();
        haptic(HINGE_BUZZ);
      }
      if (hingeAt !== null && !finished && now - hingeAt >= HINGE_MS) {
        finished = true;
        landedSound = true;
        landDescentAudio();
        doneRef.current();
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onVisibility = () => {
      last = performance.now();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      renderer.dispose();
      rendererRef.current = null;
      // Left before it finished — an error, a reload — so the sound goes too.
      if (!landedSound) releaseDescentAudio();
    };
  }, [reduced, lowPower]);

  // Skip: Space, Enter, Escape, or a tap, once the descent has been running a moment.
  useEffect(() => {
    const skip = () => {
      skipRef.current = true;
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === " " || event.key === "Enter" || event.key === "Escape") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The window's lines, one at a time, for as long as there is a wait.
  const lines = facts?.lines ?? [];
  useEffect(() => {
    if (beat !== "hold" || lines.length === 0) return;
    const timer = window.setInterval(() => setLineIndex((i) => i + 1), 2800);
    return () => window.clearInterval(timer);
  }, [beat, lines.length]);

  const inWindow = beat === "hold" || beat === "dive";
  const windowUp = beat === "hold";
  const line = lines.length ? lines[lineIndex % lines.length] : null;
  const standfirst = facts
    ? [facts.role, facts.districtName, "night one"].filter(Boolean).join(" · ")
    : "";

  return (
    <div
      className="dsc-root fixed inset-0 overflow-hidden bg-[#06040f] text-foreground"
      data-beat={beat}
      aria-busy="true"
      role="status"
      aria-label="Night City is deciding what kind of night this is"
      onClick={() => {
        skipRef.current = true;
      }}
    >
      <canvas
        ref={canvasRef}
        className={`dsc-canvas absolute inset-0 h-full w-full ${windowUp ? "dsc-canvas-glass" : ""}`}
      />
      <div aria-hidden className="dsc-rain" data-heavy={inWindow ? "yes" : "no"} />
      <div aria-hidden className="dsc-scan" />
      <div aria-hidden className="dsc-vignette" />

      {/* The HUD: what the search is doing. */}
      <div
        className={`dsc-hud absolute left-5 top-5 space-y-4 sm:left-10 sm:top-9 ${beat === "black" || inWindow ? "dsc-hud-off" : ""}`}
      >
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.34em] text-accent">
            Night City
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Population
          </p>
          <span
            ref={counterRef}
            className="num font-mono text-3xl font-bold tabular-nums text-glow-pink sm:text-5xl"
          >
            7,000,000
          </span>
        </div>
        <ul className="space-y-1.5 font-mono text-[11px] uppercase tracking-[0.2em]">
          {(facts?.filters ?? []).slice(0, SEARCH_STEPS.length).map((filter, i) => (
            <li
              key={filter.label}
              className={`dsc-filter ${step > i ? "dsc-filter-on" : ""}`}
              aria-hidden={step <= i}
            >
              <span className="text-muted-foreground">{filter.label}</span>{" "}
              <span className="text-foreground">{filter.value}</span>
            </li>
          ))}
        </ul>
      </div>

      <p
        ref={taglineRef}
        className={`dsc-tagline absolute inset-x-0 bottom-[14%] px-6 text-center font-mono text-sm tracking-[0.12em] text-foreground sm:text-lg ${beat === "black" ? "opacity-0" : ""} ${inWindow ? "dsc-tagline-off" : ""}`}
      />

      {/* The window. */}
      <div
        className={`dsc-window absolute inset-0 ${inWindow ? "dsc-window-on" : ""}`}
        aria-hidden={!inWindow}
      >
        <div className="dsc-frame" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-5 px-6 pb-[9vh] sm:flex-row sm:items-end sm:justify-center sm:gap-10">
          <Polaroid
            path={facts?.portraitPath ?? null}
            alt={facts?.handle ?? facts?.name ?? "You"}
          />
          <div className="max-w-sm space-y-3 text-center sm:text-left">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">
              {standfirst}
            </p>
            <p className="font-display text-3xl font-bold uppercase tracking-[0.06em] text-glow-pink sm:text-5xl">
              <span ref={handleRef} />
            </p>
            <p
              key={line ?? "none"}
              className="dsc-line min-h-[3rem] text-base text-muted-foreground sm:text-lg"
            >
              {line}
            </p>
          </div>
        </div>
      </div>

      {canSkip && (
        <p className="absolute bottom-4 right-5 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60">
          Space · skip
        </p>
      )}
      {hinging && <div aria-hidden className="dsc-hinge" />}
    </div>
  );
}
