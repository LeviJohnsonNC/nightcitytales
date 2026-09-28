/**
 * NCAmp's small parts: the glyphs on its buttons, the seven-segment clock, the
 * scrolling title, the visualizer, and the sliders. Drawn in SVG, CSS and
 * canvas at the player's native pixel size; the windows are scaled up whole
 * with CSS `zoom`, so everything stays on the same pixel grid.
 */
import { useEffect, useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { analyserSize, readAnalyser } from "../musicDirector";

export type Glyph = "prev" | "play" | "pause" | "stop" | "next" | "eject";

const GLYPHS: Record<Glyph, ReactNode> = {
  prev: <path d="M1 1h1v6H1zM7 1v6L3 4zM4 1v6L0 4z" transform="translate(0.5 0)" />,
  play: <path d="M2 1l5 3-5 3z" />,
  pause: <path d="M2 1h1.5v6H2zM4.5 1H6v6H4.5z" />,
  stop: <path d="M1.5 1.5h5v5h-5z" />,
  next: <path d="M6.5 1h1v6h-1zM1 1v6l4-3zM4 1v6l3-3z" transform="translate(-0.5 0)" />,
  eject: <path d="M4 1.5l3 3H1zM1 5.5h6V7H1z" />,
};

export function GlyphIcon({ glyph }: { glyph: Glyph }) {
  return (
    <svg viewBox="0 0 8 8" aria-hidden className="ncamp-glyph">
      {GLYPHS[glyph]}
    </svg>
  );
}

/** A beveled NCAmp button. */
export function Btn({
  label,
  onClick,
  className,
  pressed,
  disabled,
  children,
}: {
  label: string;
  onClick?: () => void;
  className?: string;
  pressed?: boolean;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn("ncamp-btn", pressed && "is-on", className)}
    >
      {children}
    </button>
  );
}

// ── the clock ────────────────────────────────────────────────────────────

/** Which of the seven segments (a–g) each digit lights. */
const SEGMENTS: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abged",
  "3": "abgcd",
  "4": "fgbc",
  "5": "afgcd",
  "6": "afgedc",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
  "-": "g",
  " ": "",
};

const SEG_RECTS: Record<string, [number, number, number, number]> = {
  a: [2, 0, 5, 2],
  b: [7, 1, 2, 5],
  c: [7, 7, 2, 5],
  d: [2, 11, 5, 2],
  e: [0, 7, 2, 5],
  f: [0, 1, 2, 5],
  g: [2, 5.5, 5, 2],
};

/** "04:21", "-3:07": seven-segment digits, 9×13 each, as the big clock draws them. */
export function Digits({ text, className }: { text: string; className?: string }) {
  let x = 0;
  const parts: ReactNode[] = [];
  for (const [i, ch] of [...text].entries()) {
    if (ch === ":") {
      parts.push(
        <g key={i}>
          <rect x={x + 0.5} y={3} width={2} height={2} />
          <rect x={x + 0.5} y={8} width={2} height={2} />
        </g>,
      );
      x += 4;
      continue;
    }
    const lit = SEGMENTS[ch] ?? "";
    parts.push(
      <g key={i} transform={`translate(${x} 0)`}>
        {Object.entries(SEG_RECTS).map(([seg, [sx, sy, w, h]]) => (
          <rect
            key={seg}
            x={sx}
            y={sy}
            width={w}
            height={h}
            className={lit.includes(seg) ? "is-lit" : "is-dim"}
          />
        ))}
      </g>,
    );
    x += 11;
  }
  return (
    <svg
      viewBox={`0 0 ${Math.max(1, x - 2)} 13`}
      width={Math.max(1, x - 2)}
      height={13}
      aria-hidden
      className={cn("ncamp-digits", className)}
    >
      {parts}
    </svg>
  );
}

// ── the title ────────────────────────────────────────────────────────────

/** The scrolling title, `***` between laps, stepped a pixel at a time like the original. */
export function Marquee({ text, className }: { text: string; className?: string }) {
  const lap = `${text}  ***  `;
  // Roughly 5 native pixels a character; about 20 of them a second.
  const seconds = Math.max(4, (lap.length * 5) / 20);
  return (
    <div className={cn("ncamp-marquee", className)} aria-live="off">
      <span
        className="ncamp-marquee-track"
        style={{ animationDuration: `${seconds}s` }}
        aria-label={text}
      >
        <span aria-hidden>{lap}</span>
        <span aria-hidden>{lap}</span>
      </span>
    </div>
  );
}

// ── the visualizer ───────────────────────────────────────────────────────

export type VisMode = "spectrum" | "scope" | "off";

/**
 * The analyser, drawn. Spectrum: bars with the colour running up them and a
 * peak dot that falls. Oscilloscope: the waveform, dot by dot. Colours come
 * from the skin (`--vis-*`), so a skin change repaints it.
 */
export function Visualizer({
  width,
  height,
  mode,
  bar = 3,
  skin,
  onClick,
}: {
  width: number;
  height: number;
  mode: VisMode;
  bar?: number;
  skin: string;
  onClick?: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const css = getComputedStyle(el);
    const colour = (name: string, fallback: string) =>
      css.getPropertyValue(name).trim() || fallback;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, colour("--vis-top", "#e03a1a"));
    gradient.addColorStop(0.45, colour("--vis-mid", "#e0d020"));
    gradient.addColorStop(1, colour("--vis-bottom", "#1ec81e"));
    const peakColour = colour("--vis-peak", "#b8b8c8");
    const scopeColour = colour("--vis-scope", "#e0d020");
    const gap = 1;
    const count = Math.floor((width + gap) / (bar + gap));
    const peaks = new Array<number>(count).fill(0);
    const bins = new Uint8Array(new ArrayBuffer(analyserSize()));
    let frame = 0;

    const draw = () => {
      frame = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, width, height);
      if (mode === "off") return;
      const live = readAnalyser(bins, mode === "spectrum");
      if (mode === "scope") {
        ctx.fillStyle = scopeColour;
        if (!live) return;
        for (let x = 0; x < width; x += 1) {
          const v = bins[Math.floor((x / width) * bins.length)]! / 255;
          ctx.fillRect(x, Math.round(v * (height - 1)), 1, 1);
        }
        return;
      }
      // Bars on a log scale, so the bass is not one bar and the treble fifteen.
      const usable = bins.length * 0.7;
      for (let i = 0; i < count; i += 1) {
        let level = 0;
        if (live) {
          const lo = Math.floor(Math.pow(usable, i / count));
          const hi = Math.max(lo + 1, Math.floor(Math.pow(usable, (i + 1) / count)));
          for (let b = lo; b < hi && b < bins.length; b += 1) level = Math.max(level, bins[b]!);
        }
        const h = Math.round((level / 255) * height);
        const x = i * (bar + gap);
        ctx.fillStyle = gradient;
        ctx.fillRect(x, height - h, bar, h);
        peaks[i] = Math.max(h, (peaks[i] ?? 0) - 0.25);
        if (peaks[i]! >= 1) {
          ctx.fillStyle = peakColour;
          ctx.fillRect(x, height - Math.ceil(peaks[i]!), bar, 1);
        }
      }
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [width, height, mode, bar, skin]);

  return (
    <canvas
      ref={canvas}
      width={width}
      height={height}
      onClick={onClick}
      title={onClick ? "Click to change the visualization" : undefined}
      className="ncamp-vis"
      style={{ width, height }}
    />
  );
}

// ── sliders ──────────────────────────────────────────────────────────────

/**
 * A slider: horizontal (volume, balance, seek) or vertical (the EQ). `value`
 * runs 0 to 1 along it; for a vertical one, 1 is the top. Drag, click, or use
 * the arrow keys.
 */
export function Slider({
  label,
  value,
  onChange,
  vertical = false,
  className,
  disabled,
  valueText,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  vertical?: boolean;
  className?: string;
  disabled?: boolean;
  valueText?: string;
}) {
  const track = useRef<HTMLDivElement>(null);

  function at(e: PointerEvent<HTMLDivElement>): number {
    const rect = track.current!.getBoundingClientRect();
    const f = vertical
      ? 1 - (e.clientY - rect.top) / rect.height
      : (e.clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(1, f));
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 0.1 : 0.02;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange(Math.min(1, value + step));
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange(Math.max(0, value - step));
    else if (e.key === "Home") onChange(0);
    else if (e.key === "End") onChange(1);
    else return;
    e.preventDefault();
    e.stopPropagation();
  }

  const pct = `${Math.round(value * 1000) / 10}%`;
  return (
    <div
      ref={track}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-orientation={vertical ? "vertical" : "horizontal"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-valuetext={valueText}
      aria-disabled={disabled}
      title={valueText ? `${label}: ${valueText}` : label}
      className={cn(
        "ncamp-slider",
        vertical && "is-vertical",
        disabled && "is-disabled",
        className,
      )}
      onKeyDown={onKey}
      onPointerDown={(e) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        onChange(at(e));
      }}
      onPointerMove={(e) => {
        if (!disabled && e.currentTarget.hasPointerCapture(e.pointerId)) onChange(at(e));
      }}
    >
      <div className="ncamp-slider-fill" style={vertical ? { height: pct } : { width: pct }} />
      <div className="ncamp-thumb" style={vertical ? { bottom: pct } : { left: pct }} />
    </div>
  );
}
