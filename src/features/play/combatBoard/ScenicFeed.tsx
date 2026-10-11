import type { LiveEncounter } from "@/features/campaign/encounterState";
import type { PlaybackFrame } from "../combatPlayback";
import type { Interaction } from "../combatInteraction";
import { CourtyardLayer } from "../courtyard/CourtyardLayer";
import { REFLECTION_MODE_DEFAULT, type ReflectionMode } from "../courtyard/groundReflection";
import { overlayMode } from "../overlayModel";
import type { Tile } from "@/engine";
import type {
  BoardActor,
  BoardArena,
  CameraView,
  EdgeRun,
  LitSquare,
  RoutePreview,
} from "./boardTypes";

/**
 * The Phaser scene under the board, and the boot screen held over it until it is
 * up. A renderer that fails is reported through `handleArtFailure`; the board then
 * falls back to the diagram.
 */
export function ScenicFeed({
  hasScenicArt,
  artEnabled,
  artReady,
  arena,
  live,
  revealActivity,
  lights,
  night,
  reflections,
  playback,
  displayCamera,
  aimed,
  scenic,
  showSquares,
  litSquares,
  route,
  spotTile,
  interaction,
  reachEdge,
  setArtReady,
  handleArtFailure,
}: {
  hasScenicArt: boolean;
  artEnabled: boolean;
  artReady: boolean;
  arena: BoardArena;
  live: LiveEncounter;
  revealActivity: boolean;
  lights: boolean | undefined;
  night: boolean | undefined;
  reflections: ReflectionMode | undefined;
  playback: PlaybackFrame | null | undefined;
  displayCamera: CameraView;
  aimed: BoardActor | undefined;
  scenic: boolean;
  showSquares: boolean;
  litSquares: LitSquare[];
  route: RoutePreview | null;
  spotTile: Tile | null;
  interaction: Interaction;
  reachEdge: EdgeRun;
  setArtReady: (ready: boolean) => void;
  handleArtFailure: () => void;
}) {
  return (
    <>
      {hasScenicArt && artEnabled && (
        <CourtyardLayer
          key={arena.key}
          live={live}
          revealActivity={revealActivity}
          lights={lights !== false}
          night={night !== false}
          reflections={reflections ?? REFLECTION_MODE_DEFAULT}
          playback={playback}
          camera={displayCamera}
          aimTargetId={aimed?.actor.id ?? null}
          // Over the art the squares belong ON the floor, under everything
          // standing on it, so the scene draws them rather than the SVG.
          grid={
            scenic && showSquares
              ? {
                  squares: litSquares,
                  chosen: route?.ok ? spotTile : null,
                  route: route?.ok ? route.path : null,
                  mode: overlayMode(interaction.type),
                  edge: reachEdge,
                }
              : null
          }
          onReady={setArtReady}
          onFailure={handleArtFailure}
        />
      )}
      {/* The art loads in a beat or two. Showing the wireframe underneath
          while it does reads as the screen changing its mind, so hold a
          deliberate one until the feed is up — and drop it, uncovering the
          diagram for real, if the renderer never arrives. */}
      {hasScenicArt && artEnabled && (
        <div
          className={`combat-boot ${artReady ? "is-live" : ""}`}
          role="status"
          aria-live="polite"
          {...(artReady ? { "aria-hidden": true } : {})}
        >
          <span className="combat-boot-scan" aria-hidden="true" />
          <span className="combat-boot-label">
            <span className="combat-eyebrow">Establishing feed</span>
            <strong>{arena.label}</strong>
          </span>
        </div>
      )}
    </>
  );
}
