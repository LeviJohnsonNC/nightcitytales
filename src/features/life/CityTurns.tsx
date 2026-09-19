/**
 * The wait.
 *
 * Shown while a Life turn is with the model. The line comes from `cityTurns.ts`
 * — picked per turn from where and when the character is — and the motion is in
 * `life.css`: a light sweep through the glyphs, a pulsing signal glyph, and a
 * hairline travelling under it. Nothing here spins, and nothing says "loading".
 *
 * The line is chosen from a seed rather than at random on render, so a React
 * re-render mid-wait cannot swap the sentence out from under the player.
 */
import "./life.css";
import { turnLine, type TurnContext, type TurnHue } from "./cityTurns";

/** The palette each hue draws from: the lit colour, and the same colour resting. */
const HUES: Record<TurnHue, { hue: string; dim: string }> = {
  // The dim end is the line AT REST and has to be readable on its own: the
  // sweep is the city breathing on the words, not the only thing showing them.
  ember: { hue: "#ff7ac0", dim: "rgba(255, 61, 154, 0.72)" },
  cool: { hue: "#7ae8f4", dim: "rgba(52, 213, 230, 0.70)" },
  purple: { hue: "#c79bff", dim: "rgba(161, 92, 255, 0.74)" },
};

export function CityTurns({ context, seed }: { context: TurnContext; seed: number }) {
  const line = turnLine(context, seed);
  const palette = HUES[line.hue];
  const style = {
    "--turn-hue": palette.hue,
    "--turn-dim": palette.dim,
  } as React.CSSProperties;

  return (
    // aria-live, because a sighted player sees the city thinking and a screen
    // reader user otherwise gets silence until the narration lands.
    <div className="space-y-1.5 py-1" aria-live="polite" aria-busy="true" style={style}>
      <p className="life-turn text-sm italic">
        <span className="life-turn-mark not-italic" aria-hidden>
          ◆
        </span>
        <span className="life-turn-text">{line.text}</span>
      </p>
      <div className="life-turn-rule h-px w-full" aria-hidden />
    </div>
  );
}
