/**
 * Where you are, as a picture.
 *
 * It opens at full height, because a new campaign's first screen is otherwise
 * an empty column, and settles to a lit strip once the log has something in it
 * — the place keeps a face all session without ever costing the prose its room.
 * Arriving somewhere new opens it again for a few seconds, which is the only
 * announcement travel gets that is not a line of monospace.
 *
 * Which picture is `sceneArt.ts`'s decision, and it walks up the geography when
 * the exact venue has none. When nothing in the chain has art — which no place
 * on the map is today — the whole thing stays away rather than standing in with
 * a drawn plate: a lit gradient where a photograph should be is worse than the
 * prose starting where the prose starts.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import "./life.css";
import { sceneArt } from "./sceneArt";

/** How long a new location stays open before settling back to the strip. */
const ARRIVAL_MS = 6000;

export function SceneHero({
  locationKey,
  /** True while the log has nothing in it — the opening of a campaign. */
  opening,
}: {
  locationKey: string;
  opening: boolean;
}) {
  const scene = sceneArt(locationKey);
  const [arrived, setArrived] = useState(false);
  const previous = useRef(locationKey);

  useEffect(() => {
    if (previous.current === locationKey) return;
    previous.current = locationKey;
    setArrived(true);
    const timer = setTimeout(() => setArrived(false), ARRIVAL_MS);
    return () => clearTimeout(timer);
  }, [locationKey]);

  const open = opening || arrived;

  // Nothing to show. Every atlas place and district has a picture, so this is
  // the guard for one added without art rather than a state the game is in.
  if (!scene.artwork) return null;

  return (
    <figure
      className={cn(
        "relative w-full overflow-hidden border border-hairline bg-ground transition-[height] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
        open ? "h-52 sm:h-64 lg:h-72" : "h-16 sm:h-20",
      )}
    >
      <img
        key={scene.artwork.src}
        src={scene.artwork.src}
        srcSet={scene.artwork.srcSet}
        // The Life column is 1fr of a 72rem grid beside a 20rem rail.
        sizes="(min-width: 1024px) 48rem, 96vw"
        alt={scene.alt}
        className="scene-hero-img h-full w-full object-cover object-center"
      />

      {/* The picture is a backdrop, not a card: it darkens into the page at the
          bottom so the caption and the log below read as sitting in front of it. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/35 to-transparent" />
      <div
        className="scene-hero-scan pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cool/70 to-transparent"
        style={{ ["--scan-travel" as string]: "20rem" }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-ember/60 to-transparent" />

      <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-[11px] uppercase tracking-[0.24em] text-chrome">
            {scene.title}
          </p>
          {scene.subtitle ? (
            <p className="truncate font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">
              {scene.subtitle}
            </p>
          ) : null}
        </div>
      </figcaption>
    </figure>
  );
}
