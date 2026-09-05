/**
 * NIGHT CITY — the wordmark, drawn as neon rather than set as type.
 *
 * A neon sign is a bent glass tube, so this is bent glass: one stroked path per
 * letter, round caps, no fills. Drawing it that way rather than shipping a PNG
 * is what lets the same mark be 40px in a header and 400px on a splash without
 * a second asset, keeps it crisp on any display, and lets the glow be a live
 * colour the surrounding UI can inherit.
 *
 * Presentation only.
 */

import "./nightCityMark.css";

/** One continuous tube per glyph, on a 300 x 92 board with the baseline at 64. */
const LETTERS = (
  <>
    {/* N */}
    <path d="M12 64V20l24 44V20" />
    {/* i */}
    <path d="M47 64V34" />
    {/* G — the letter whose transformer is going. */}
    <path
      className="night-city-flicker"
      d="M86 31c-5-10-17-13-24-6-7 8-8 27-1 36 6 8 19 8 25-1v-12H75"
    />
    {/* H */}
    <path d="M93 20v44M119 20v44M93 43h26" />
    {/* T */}
    <path d="M125 22h26M138 22v42" />
    {/* C */}
    <path d="M195 31c-5-10-18-13-25-6-7 8-8 27-1 36 6 8 20 8 26-2" />
    {/* i */}
    <path d="M206 64V34" />
    {/* T */}
    <path d="M217 22h26M230 22v42" />
    {/* Y */}
    <path d="M249 20l14 23 14-23M263 43v21" />
  </>
);

/** The tittles. A dot in neon is a blob of glass, not a zero-length tube. */
const DOTS = (
  <>
    <circle cx="47" cy="24" />
    <circle cx="206" cy="24" />
  </>
);

export function NightCityMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`night-city-mark ${className}`}
      viewBox="0 0 300 92"
      role="img"
      aria-label="Night City"
      focusable="false"
    >
      <g transform="skewX(-9)" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* The tube, then the hot filament inside it. */}
        <g className="night-city-tube">
          {LETTERS}
          {DOTS}
        </g>
        <g className="night-city-core">
          {LETTERS}
          {DOTS}
        </g>
      </g>
    </svg>
  );
}
