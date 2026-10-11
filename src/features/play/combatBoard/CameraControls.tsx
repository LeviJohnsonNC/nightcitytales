import { Eye, Hand, Maximize, Minus, Plus, RotateCcw } from "lucide-react";
import { battlefieldCameraPreset } from "../courtyard/courtyardPresentation";
import type { BoardArena, CameraView } from "./boardTypes";

/** The map's caption and its camera controls: reveal, art or diagram, zoom, pan, reset. */
export function CameraControls({
  arena,
  hasScenicArt,
  artEnabled,
  setArtEnabled,
  setArtReady,
  revealActivity,
  setRevealActivity,
  camera,
  setCamera,
  tool,
  setTool,
  frameAction,
}: {
  arena: BoardArena;
  hasScenicArt: boolean;
  artEnabled: boolean;
  setArtEnabled: (enabled: boolean) => void;
  setArtReady: (ready: boolean) => void;
  revealActivity: boolean;
  setRevealActivity: (reveal: boolean) => void;
  camera: CameraView;
  setCamera: (camera: CameraView | null) => void;
  tool: "select" | "pan";
  setTool: (tool: "select" | "pan") => void;
  frameAction: () => void;
}) {
  return (
    <div className="combat-map-chrome">
      <div className="combat-map-caption">
        <span className="combat-eyebrow">{arena.label}</span>
        <span>
          {arena.extent.width} × {arena.extent.height} m
        </span>
      </div>
      <div className="combat-camera" aria-label="Camera controls">
        {hasScenicArt && artEnabled && arena.environment && !arena.environment.interior && (
          <button
            className="combat-icon"
            aria-label="Reveal activity behind buildings"
            title="Reveal activity behind buildings (walls still block movement and shots)"
            aria-pressed={revealActivity}
            onClick={() => setRevealActivity(!revealActivity)}
          >
            <Eye size={17} />
          </button>
        )}
        {hasScenicArt && (
          <button
            className="combat-view-toggle"
            onClick={() => {
              setArtEnabled(!artEnabled);
              setArtReady(false);
            }}
            aria-pressed={artEnabled}
          >
            {artEnabled ? "Diagram view" : "Scenic view"}
          </button>
        )}
        <button
          className="combat-icon"
          aria-label="Zoom in"
          disabled={camera.zoom >= 2.5}
          onClick={() => setCamera({ ...camera, zoom: Math.min(2.5, camera.zoom + 0.25) })}
        >
          <Plus size={17} />
        </button>
        <button
          className="combat-icon"
          aria-label="Zoom out"
          disabled={camera.zoom <= 0.75}
          onClick={() => setCamera({ ...camera, zoom: Math.max(0.75, camera.zoom - 0.25) })}
        >
          <Minus size={17} />
        </button>
        <button
          className={`combat-icon ${tool === "pan" ? "is-selected" : ""}`}
          aria-label="Pan battlefield"
          aria-pressed={tool === "pan"}
          onClick={() => setTool(tool === "pan" ? "select" : "pan")}
        >
          <Hand size={17} />
        </button>
        <button
          className="combat-icon"
          aria-label="Reset camera"
          title={
            arena.environment?.recipe === "intersection"
              ? "Frame the current participants"
              : "Reset camera"
          }
          onClick={frameAction}
        >
          <RotateCcw size={17} />
        </button>
        {arena.environment && (
          <button
            className="combat-icon"
            aria-label="Overview"
            title="Overview"
            onClick={() => setCamera(battlefieldCameraPreset(arena, "overview"))}
          >
            <Maximize size={17} />
          </button>
        )}
      </div>
    </div>
  );
}
