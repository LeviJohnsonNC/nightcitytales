/** Vendor finish on the existing steel stock case. No cover or registration changes. */
import type Phaser from "phaser";
import type { SceneEnvironment } from "@/engine";
import type { PropCondition } from "./propPresentation";

export function isVendorStock(
  env: SceneEnvironment | undefined,
  binding: SceneEnvironment["props"][number] | undefined,
) {
  return (
    binding?.art === "cargo" &&
    !!env?.clusters.some((c) => c.id === binding.clusterId && c.kind === "vendor_stall")
  );
}

/** Baked once per condition; existing scratches, steel rails and damage stay in place. */
export function vendorStockTexture(
  scene: Phaser.Scene,
  source: string,
  condition: PropCondition,
  fabric?: CanvasImageSource,
) {
  // Burned/open wreckage has no cloth or vendor finish left.
  if (condition === "wrecked") return source;
  const key = `${source}-vendor`;
  if (scene.textures.exists(key)) return key;
  const image = scene.textures.get(source).getSourceImage() as HTMLCanvasElement;
  const texture = scene.textures.createCanvas(key, image.width, image.height)!;
  const ctx = texture.context;
  ctx.drawImage(image, 0, 0);
  // Muted olive enamel ties the blue military case into the stall. The tint retains
  // the source's material relief, fittings and holes, and never adds opaque pixels.
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = "rgba(113,99,61,.28)";
  ctx.fillRect(0, 0, image.width, image.height);
  ctx.globalCompositeOperation = "source-over";
  ctx.save();
  ctx.scale(image.width, image.height);
  const poly = (points: readonly (readonly [number, number])[], fill: string) => {
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  if (condition === "intact") {
    // Fitted cloth stays inside the measured case silhouette, leaving the steel
    // perimeter and latches readable. Damaged art keeps its torn-open top exposed.
    const top = [
      [0.14, 0.34],
      [0.5, 0.12],
      [0.84, 0.34],
      [0.5, 0.54],
    ] as const;
    poly(
      [
        [0.14, 0.34],
        [0.5, 0.54],
        [0.5, 0.65],
        [0.14, 0.46],
      ],
      "#494838",
    );
    poly(top, "#766b4b");
    if (fabric) {
      ctx.save();
      ctx.clip();
      // The existing fabric spans the lid; no new asset request or network load.
      const size = fabric as CanvasImageSource & { width: number; height: number };
      ctx.transform(
        0.36 / size.width,
        -0.22 / size.width,
        0.36 / size.height,
        0.2 / size.height,
        0.14,
        0.34,
      );
      ctx.drawImage(fabric, 0, 0);
      ctx.restore();
      poly(top, "rgba(45,36,20,.25)");
    }
    // The fold has a visible lit edge and a shallow pocket of shade below it.
    ctx.strokeStyle = "#b6a781";
    ctx.lineWidth = 0.008;
    ctx.beginPath();
    ctx.moveTo(0.14, 0.34);
    ctx.lineTo(0.5, 0.54);
    ctx.lineTo(0.84, 0.34);
    ctx.stroke();
    ctx.strokeStyle = "#292d27";
    ctx.lineWidth = 0.012;
    ctx.beginPath();
    ctx.moveTo(0.14, 0.46);
    ctx.lineTo(0.5, 0.65);
    ctx.stroke();
  }
  if (condition === "intact") {
    // A painted bowl mark on the near panel makes this food stock, without changing
    // the case into wooden cover or adding objects beyond its saved footprint.
    ctx.save();
    ctx.transform(0.23, 0.13, 0, 0.17, 0.2, 0.53);
    ctx.fillStyle = "#af9c72";
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = "#633d2e";
    ctx.beginPath();
    ctx.moveTo(0.17, 0.33);
    ctx.bezierCurveTo(0.23, 0.9, 0.77, 0.9, 0.83, 0.33);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(0.14, 0.26, 0.72, 0.07);
    ctx.fillRect(0.39, 0.82, 0.22, 0.06);
    ctx.restore();
  }
  ctx.restore();
  texture.refresh();
  return key;
}
