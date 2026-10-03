/** Small reusable furniture kit. Geometry is registered to one canonical 2m section. */
import type Phaser from "phaser";
import { propTexture, type PropKind, type PropCondition } from "./propPresentation";
export const INTERIOR_PROP_KINDS = [
  "desk",
  "reception",
  "meeting-table",
  "seat",
  "bar",
  "server",
  "shelf",
  "dj",
  "partition",
] as const;
export function isInteriorProp(kind: PropKind) {
  return (INTERIOR_PROP_KINDS as readonly string[]).includes(kind);
}

export function createInteriorPropTextures(scene: Phaser.Scene, kind: PropKind) {
  for (const condition of ["intact", "damaged", "wrecked"] as PropCondition[]) {
    const height = 240;
    const texture = scene.textures.createCanvas(propTexture(kind, condition), 256, height)!;
    const ctx = texture.context;
    const point = (x: number, y: number, z = 0) => ({
      x: (x + y) * 64,
      y: height - 64 + (x - y) * 32 - z,
    });
    const poly = (points: ReturnType<typeof point>[], color: string, stroke = "#172027") => {
      ctx.beginPath();
      points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    };
    const slab = (
      x: number,
      y: number,
      w: number,
      d: number,
      bottom: number,
      top: number,
      colors: string[],
    ) => {
      const a = point(x, y, bottom),
        b = point(x + w, y, bottom),
        c = point(x + w, y + d, bottom);
      const A = point(x, y, top),
        B = point(x + w, y, top),
        C = point(x + w, y + d, top),
        D = point(x, y + d, top);
      poly([a, b, B, A], colors[0]!);
      poly([b, c, C, B], colors[1]!);
      poly([A, B, C, D], colors[2]!);
    };
    poly(
      [point(0.1, 0.1), point(1.9, 0.1), point(1.9, 1.9), point(0.1, 1.9)],
      "rgba(0,0,0,.23)",
      "transparent",
    );
    if (condition === "wrecked") {
      for (let i = 0; i < 7; i++)
        slab(0.15 + (i % 3) * 0.53, 0.15 + Math.floor(i / 3) * 0.55, 0.4, 0.35, 0, 4 + (i % 3), [
          "#4d4440",
          "#323a41",
          "#74665b",
        ]);
      texture.refresh();
      continue;
    }
    const metal = ["#4f626a", "#283c48", "#73878a"],
      wood = ["#766656", "#493f39", "#ac9270"],
      velvet = ["#624052", "#38293e", "#a56883"];
    if (kind === "server" || kind === "shelf" || kind === "partition") {
      const tall = kind === "partition" ? 65 : 92;
      slab(0.15, 0.25, 1.7, 1.5, 0, tall, metal);
      for (let z = 15; z < tall - 5; z += 17) {
        poly(
          [
            point(0.3, 0.24, z),
            point(1.7, 0.24, z),
            point(1.7, 0.24, z + 9),
            point(0.3, 0.24, z + 9),
          ],
          "#14262e",
        );
        const p = point(1.45, 0.23, z + 5);
        ctx.fillStyle = "#6de0c4";
        ctx.fillRect(p.x, p.y, 4, 3);
      }
    } else if (kind === "seat") {
      slab(0.1, 0.2, 1.8, 1.5, 0, 19, metal);
      slab(0.12, 0.2, 1.76, 1.5, 19, 32, velvet);
      slab(0.12, 1.55, 1.76, 0.24, 30, 62, velvet);
      for (const x of [0.15, 1.65]) slab(x, 0.25, 0.2, 1.4, 24, 43, velvet);
    } else {
      const counter = kind === "bar" || kind === "reception";
      if (counter) slab(0.05, 0.15, 1.9, 1.65, 0, 48, kind === "bar" ? velvet : metal);
      else
        for (const x of [0.2, 1.65])
          for (const y of [0.2, 1.65]) slab(x, y, 0.12, 0.12, 0, 32, metal);
      const top = counter ? 54 : 38;
      slab(0.05, 0.15, 1.9, 1.65, top - 6, top, wood);
      if (kind === "desk" || kind === "reception") {
        slab(0.65, 1.15, 0.75, 0.18, top, top + 24, metal);
        poly(
          [
            point(0.68, 1.14, top + 3),
            point(1.36, 1.14, top + 3),
            point(1.36, 1.14, top + 21),
            point(0.68, 1.14, top + 21),
          ],
          "#62b4bd",
        );
        slab(0.7, 0.65, 0.65, 0.3, top, top + 2, metal);
      }
      if (kind === "bar")
        for (let i = 0; i < 3; i++)
          slab(0.35 + i * 0.43, 1.3, 0.13, 0.15, top, top + 12, ["#43837c", "#275554", "#78aaa1"]);
      if (kind === "meeting-table") {
        slab(0.4, 0.7, 0.4, 0.5, top, top + 2, ["#687c88", "#465869", "#b3c3c7"]);
        const p = point(1.3, 0.7, top + 2);
        ctx.fillStyle = "#ddd2b0";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (kind === "dj") {
        slab(0.2, 0.35, 1.6, 1.2, top, top + 7, metal);
        for (const x of [0.65, 1.4]) {
          const p = point(x, 0.9, top + 8);
          ctx.fillStyle = "#101a2a";
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, 17, 9, -0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#b176bf";
          ctx.stroke();
        }
      }
    }
    if (condition === "damaged") {
      ctx.strokeStyle = "#211f28";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(65, 150);
      ctx.lineTo(112, 163);
      ctx.lineTo(109, 190);
      ctx.stroke();
      ctx.fillStyle = "#b5a27b";
      ctx.fillRect(165, 165, 5, 3);
    }
    texture.refresh();
  }
}
