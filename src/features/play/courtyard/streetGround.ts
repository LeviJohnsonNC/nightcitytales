import type Phaser from "phaser";
import type { Point } from "@/engine";

type Project = (point: Point) => Point;

/** Decorative surfaces only: no obstacles, collision, cover or world-state writes. */
export function paintStreetGround(ctx: CanvasRenderingContext2D, project: Project) {
  const polygon = (points: Point[], color: string) => {
    ctx.beginPath();
    points.map(project).forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  const rect = (x: number, y: number, w: number, h: number, color: string) =>
    polygon(
      [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ],
      color,
    );
  const line = (points: Point[], color: string, width = 1) => {
    ctx.beginPath();
    points.map(project).forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  };
  const glow = (point: Point, radius: number, color: string) => {
    const p = project(point);
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "transparent");
    ctx.fillStyle = gradient;
    ctx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
  };
  ctx.fillStyle = "#070e16";
  ctx.fillRect(0, 0, 1100, 700);
  // Streets continue out of the playable inset; no painted building blocks a legal tile.
  rect(-8, -8, 40, 40, "#283137");
  for (let x = -8; x < 32; x += 2)
    for (let y = -8; y < 32; y += 2) {
      rect(
        x + 0.025,
        y + 0.025,
        1.95,
        1.95,
        ["#30393d", "#333c3e", "#2d363b", "#353d3f"][Math.abs(x * 7 + y * 13) % 4]!,
      );
    }
  rect(8, -8, 10, 40, "#1a232a");
  rect(-8, 12, 40, 6, "#1c252b");
  // Flush, worn curb paint. It never promises a collision boundary.
  for (const x of [8, 18]) {
    line(
      [
        { x, y: -8 },
        { x, y: 12 },
      ],
      "#87908a",
      2,
    );
    line(
      [
        { x, y: 18 },
        { x, y: 32 },
      ],
      "#87908a",
      2,
    );
  }
  for (const y of [12, 18]) {
    line(
      [
        { x: -8, y },
        { x: 8, y },
      ],
      "#87908a",
      2,
    );
    line(
      [
        { x: 18, y },
        { x: 32, y },
      ],
      "#87908a",
      2,
    );
  }
  for (let y = -6; y < 32; y += 3) {
    if (y > 9 && y < 21) continue;
    rect(12.9, y, 0.1, 1.6, "#a3935b");
    rect(13.15, y, 0.1, 1.6, "#a3935b");
  }
  for (let x = 8.4; x < 17.8; x += 1.2)
    for (const y of [10.2, 18.4]) rect(x, y, 0.55, 1.5, "#a0a599");
  for (let y = 12.4; y < 17.8; y += 1.2)
    for (const x of [6.2, 18.3]) rect(x, y, 1.5, 0.55, "#8b948d");
  // Seeded surface wear is stable on refresh. Visual noise is not gameplay randomness.
  let seed = 5183;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 19000; i++) {
    const p = project({ x: random() * 40 - 8, y: random() * 40 - 8 });
    ctx.fillStyle = i % 2 ? "#b0ad9420" : "#02091040";
    ctx.fillRect(p.x, p.y, random() * 2 + 0.3, random() + 0.3);
  }
  for (let i = 0; i < 75; i++) {
    const x = random() * 30 - 3,
      y = random() * 30 - 3;
    line(
      [
        { x, y },
        { x: x + 0.25, y: y + 0.5 },
        { x: x + 0.1, y: y + 1.2 },
        { x: x + 0.4, y: y + 1.7 },
      ],
      "#050b1280",
      0.9,
    );
  }
  for (const [x, y] of [
    [7.4, 7],
    [18.1, 21],
    [2, 11.5],
  ]) {
    rect(x!, y!, 0.45, 1, "#0d161d");
    for (let offset = 0.1; offset < 1; offset += 0.15)
      line(
        [
          { x: x!, y: y! + offset },
          { x: x! + 0.45, y: y! + offset },
        ],
        "#566369",
        1,
      );
  }
  // Light pools from nearby shops and the cart, deliberately without invented rain.
  glow({ x: 4, y: 8 }, 125, "#f4a33c30");
  glow({ x: 2, y: 1 }, 200, "#38cbdc30");
  glow({ x: 22, y: 8 }, 160, "#f4a33c20");
  glow({ x: 22, y: 22 }, 180, "#397bb527");
  const vignette = ctx.createRadialGradient(550, 340, 170, 550, 340, 590);
  vignette.addColorStop(0, "transparent");
  vignette.addColorStop(1, "#030913ee");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, 1100, 700);
}

export function createStreetGround(scene: Phaser.Scene, project: Project) {
  const texture = scene.textures.createCanvas("street-ground", 2200, 1400)!;
  texture.context.scale(2, 2);
  paintStreetGround(texture.context, project);
  texture.refresh();
  scene.add.image(550, 350, "street-ground").setDisplaySize(1100, 700).setDepth(-1000);
}
