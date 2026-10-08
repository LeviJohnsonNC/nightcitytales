import { sceneryOccludes, type SceneryMask } from "./sceneryOcclusion";

type Unit = { x: number; y: number; visible: boolean; depth?: number };
type Bounds = { x: number; y: number; depth: number; displayWidth: number; displayHeight: number };
export interface CartWindow {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

/** Local texture-space windows, only where actual cart ink hides an actor behind it. */
export function cartWindows(
  bounds: Bounds,
  units: readonly Unit[],
  height: number,
  mask: SceneryMask,
): CartWindow[] {
  return units
    .filter((u) => sceneryOccludes(bounds, u, height, mask))
    .map((u) => ({
      x: mask.flipX ? 1 - (u.x - mask.left) / mask.width : (u.x - mask.left) / mask.width,
      y: (u.y - height * 0.52 - mask.top) / mask.height,
      rx: (height * 0.26) / mask.width,
      ry: (height * 0.6) / mask.height,
    }));
}

/** Repaint only when projected actor windows change; no pixel readback in the frame loop. */
export function paintCartWindows(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  width: number,
  height: number,
  windows: readonly CartWindow[],
) {
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  for (const w of windows) {
    ctx.save();
    ctx.translate(w.x * width, w.y * height);
    ctx.scale(w.rx * width, w.ry * height);
    const fade = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    fade.addColorStop(0, "rgba(0,0,0,.72)");
    fade.addColorStop(0.72, "rgba(0,0,0,.72)");
    fade.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = fade;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }
  ctx.restore();
}
