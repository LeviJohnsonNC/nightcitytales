/**
 * The wait.
 *
 * Shown while a campaign turn resolves. The line comes from `cityTurnModel.ts`
 * — picked per turn from where and when the character is — and the motion is in
 * `life.css`: a light sweep through the glyphs, a pulsing signal glyph, and a
 * hairline travelling under it. Nothing here spins, and nothing says "loading".
 *
 * The line is chosen from a seed rather than at random on render, so a React
 * re-render mid-wait cannot swap the sentence out from under the player.
 */
import "./life.css";
import { useState } from "react";
import { getDistrict, getPlace, isCombatZone, partOfDay, resolvePosition } from "@/engine";
import { turnLine, type TurnHue } from "./cityTurnModel";

/** The palette each hue draws from: the lit colour, and the same colour resting. */
const HUES: Record<TurnHue, { hue: string; dim: string }> = {
  // The dim end is the line AT REST and has to be readable on its own: the
  // sweep is the city breathing on the words, not the only thing showing them.
  ember: { hue: "#ff7ac0", dim: "rgba(255, 61, 154, 0.72)" },
  cool: { hue: "#7ae8f4", dim: "rgba(52, 213, 230, 0.70)" },
  purple: { hue: "#c79bff", dim: "rgba(161, 92, 255, 0.74)" },
};

export function CityTurns({
  locationKey,
  minute,
  seed,
  message,
  action,
}: {
  locationKey: string | null;
  minute: number;
  seed: number;
  message?: string | undefined;
  action?: string | undefined;
}) {
  return (
    <>
      <p className="sr-only" role="status">
        {message && (action ? `${message} ${action}` : message)}
      </p>
      {message && (
        <CitySignal locationKey={locationKey} minute={minute} seed={seed} action={action} />
      )}
    </>
  );
}

function CitySignal({
  locationKey,
  minute,
  seed,
  action,
}: {
  locationKey: string | null;
  minute: number;
  seed: number;
  action?: string | undefined;
}) {
  // Capture the atmosphere for this wait, even if an interim refetch updates the scene.
  const [line] = useState(() => {
    const at = resolvePosition(locationKey);
    const district = at ? getDistrict(at.districtKey) : undefined;
    const place = at?.placeKey ? getPlace(at.placeKey) : undefined;
    return turnLine(
      {
        dayPart: partOfDay(minute),
        districtName: district?.name,
        combatZone: district ? isCombatZone(district.key) : undefined,
        placeName: place?.name,
      },
      seed,
    );
  });
  const palette = HUES[line.hue];
  const style = {
    "--turn-hue": palette.hue,
    "--turn-dim": palette.dim,
  } as React.CSSProperties;
  return (
    <div className="life-wait" style={style} aria-hidden="true">
      {action && <p>{action}</p>}
      <div className="space-y-1.5 py-1">
        <p className="life-turn text-sm italic">
          <span className="life-turn-mark not-italic">◆</span>
          <span className="life-turn-text">{line.text}</span>
        </p>
        <div className="life-turn-rule h-px w-full" />
      </div>
    </div>
  );
}
