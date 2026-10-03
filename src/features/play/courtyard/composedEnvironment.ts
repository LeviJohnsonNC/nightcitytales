/** World-building art from the same resolved parcels that constrain play. */
import type Phaser from "phaser";
import type { Arena, Point, Rect, SceneStructure, SceneEnvironment } from "@/engine";

type Project = (p: Point) => Point;
function painter(ctx: CanvasRenderingContext2D, project: Project) {
  const poly = (points: Point[], color: string, stroke?: string) => {
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  };
  const corners = (r: Rect, z = 0) =>
    [
      { x: r.x, y: r.y },
      { x: r.x + r.width, y: r.y },
      { x: r.x + r.width, y: r.y + r.height },
      { x: r.x, y: r.y + r.height },
    ].map((p) => {
      const q = project(p);
      return { x: q.x, y: q.y - z };
    });
  const rect = (r: Rect, color: string, stroke?: string) => poly(corners(r), color, stroke);
  const line = (a: Point, b: Point, color: string, width = 1) => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  };
  const glow = (p: Point, radius: number, color: string) => {
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
    g.addColorStop(0, color);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
  };
  return { poly, corners, rect, line, glow };
}

export function paintComposedGround(ctx: CanvasRenderingContext2D, arena: Arena, project: Project) {
  const env = arena.environment!;
  const { rect, line, glow } = painter(ctx, project);
  ctx.fillStyle = "#080f17";
  ctx.fillRect(0, 0, 1100, 700);
  rect({ x: -12, y: -12, width: 56, height: 56 }, "#293034");
  for (const z of env.zones) {
    const road = ["road", "alley", "intersection"].includes(z.kind);
    rect(z.rect, road ? "#20292e" : z.kind === "loading" ? "#353b3c" : "#41494a");
    if (!road && z.kind !== "crosswalk") {
      for (let x = z.rect.x; x < z.rect.x + z.rect.width; x += 1)
        for (let y = z.rect.y; y < z.rect.y + z.rect.height; y += 1)
          rect(
            { x: x + 0.025, y: y + 0.025, width: 0.95, height: 0.95 },
            (x + y) % 3 === 0 ? "#3c4547" : "#454d4e",
            "#333d40",
          );
      const c = painter(ctx, project).corners(z.rect);
      for (let i = 0; i < 4; i++) line(c[i]!, c[(i + 1) % 4]!, "#79817b", 1.5);
    }
    if (z.kind === "crosswalk") {
      const horizontal = z.axis === "x";
      const length = horizontal ? z.rect.width : z.rect.height;
      for (let t = 0.3; t < length; t += 1)
        rect(
          {
            x: z.rect.x + (horizontal ? t : 0.2),
            y: z.rect.y + (horizontal ? 0.2 : t),
            width: horizontal ? 0.45 : z.rect.width - 0.4,
            height: horizontal ? z.rect.height - 0.4 : 0.45,
          },
          "#aaa99a",
        );
    }
  }
  // Lane paint belongs to the saved roads, interrupted at crossings and junctions.
  for (const z of env.zones.filter((z) => z.kind === "road")) {
    const vertical = z.axis === "y",
      length = vertical ? z.rect.height : z.rect.width;
    for (let t = 0; t < length; t += 3) {
      const p = {
        x: z.rect.x + (vertical ? z.rect.width / 2 : t),
        y: z.rect.y + (vertical ? t : z.rect.height / 2),
      };
      if (
        env.zones.some(
          (o) =>
            ["intersection", "crosswalk"].includes(o.kind) &&
            p.x >= o.rect.x &&
            p.x <= o.rect.x + o.rect.width &&
            p.y >= o.rect.y - 1 &&
            p.y <= o.rect.y + o.rect.height + 1,
        )
      )
        continue;
      rect({ ...p, width: vertical ? 0.08 : 1.4, height: vertical ? 1.4 : 0.08 }, "#b2a270");
    }
  }
  // Approaches are reserved geometry, not decorative doors placed behind crates.
  for (const e of env.entrances ?? []) {
    const p = e.position;
    rect({ x: p.x - 0.8, y: p.y - 0.8, width: 1.6, height: 1.6 }, "#57625e", "#b5a779");
    const structure = env.structures.find((s) => s.id === e.structureId)!;
    const wall = {
      x: Math.max(structure.rect.x, Math.min(p.x, structure.rect.x + structure.rect.width)),
      y: Math.max(structure.rect.y, Math.min(p.y, structure.rect.y + structure.rect.height)),
    };
    line(project(p), project(wall), "#d0ba7f", 2);
  }
  let seed = env.seed + 417;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 7500; i++) {
    const p = project({ x: random() * 48 - 8, y: random() * 48 - 8 });
    ctx.fillStyle = i % 3 ? "rgba(187,197,185,.045)" : "rgba(0,0,0,.12)";
    ctx.fillRect(p.x, p.y, random() * 3 + 0.3, 0.7);
  }
  for (const d of env.dressing) {
    const p = project(d.position);
    if (d.kind === "lamp" || d.kind === "sign")
      glow(p, 55, d.kind === "lamp" ? "rgba(243,185,104,.14)" : "rgba(77,196,195,.13)");
    if (d.kind === "drain") {
      rect({ x: d.position.x - 0.2, y: d.position.y - 0.2, width: 0.45, height: 0.7 }, "#141f25");
      for (let i = 0; i < 5; i++)
        line(
          project({ x: d.position.x - 0.2, y: d.position.y - 0.15 + i * 0.12 }),
          project({ x: d.position.x + 0.25, y: d.position.y - 0.15 + i * 0.12 }),
          "#526066",
          0.6,
        );
    }
    if (d.kind === "litter")
      for (let i = 0; i < 8; i++) {
        const q = project({ x: d.position.x + random() * 0.7, y: d.position.y + random() * 0.7 });
        ctx.fillStyle = i % 2 ? "#62665c" : "#888279";
        ctx.fillRect(q.x, q.y, 2 + random() * 2, 1.4);
      }
  }
}

function paintBuilding(
  ctx: CanvasRenderingContext2D,
  structure: SceneStructure,
  project: Project,
  entrances: SceneEnvironment["entrances"],
) {
  const { poly, corners, line, glow } = painter(ctx, project);
  const r = structure.rect;
  const h = structure.height * 15;
  const base = corners(r),
    top = corners(r, h);
  const palette =
    structure.style === "shop"
      ? ["#49474a", "#333941", "#646360"]
      : structure.style === "workshop"
        ? ["#4b4940", "#353b3b", "#686356"]
        : ["#3e4a50", "#2c3942", "#56656b"];
  // Two camera-facing walls; windows, shutters, conduits, lintels share their planes.
  poly([base[0]!, base[1]!, top[1]!, top[0]!], palette[0]!, "#111c25");
  poly([base[1]!, base[2]!, top[2]!, top[1]!], palette[1]!, "#111c25");
  const face = (a: Point, b: Point, length: number, shade: string, edge: "north" | "east") => {
    const at = (t: number, z: number) => ({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t - z,
    });
    for (let level = 4; level < h - 10; level += 18) {
      line(at(0, level), at(1, level), "#515355", 1);
      for (let i = 0; i < length; i += 2) {
        const x = (i + 0.2) / length,
          w = 1.4 / length;
        const lit = (i + Math.floor(level)) % 4 === 0;
        poly(
          [at(x, level + 2), at(x + w, level + 2), at(x + w, level + 13), at(x, level + 13)],
          lit ? "#988264" : "#14232c",
          "#616665",
        );
        line(at(x + w * 0.5, level + 2), at(x + w * 0.5, level + 13), shade, 0.9);
      }
    }
    // Shop/service doors at ground level, visually shut and mechanically solid.
    const doors =
      entrances === undefined
        ? Array.from({ length: Math.max(0, Math.floor((length - 2) / 4)) }, (_, i) => 2 + i * 4)
        : entrances
            .filter(
              (e) =>
                e.structureId === structure.id &&
                (edge === "north" ? e.position.y === r.y - 1 : e.position.x === r.x + r.width + 1),
            )
            .map((e) => (edge === "north" ? e.position.x - r.x : e.position.y - r.y));
    for (const centre of doors) {
      const x = (centre - 0.8) / length,
        w = 1.6 / length;
      poly([at(x, 1), at(x + w, 1), at(x + w, 22), at(x, 22)], "#172329", "#626761");
      for (let z = 3; z < 20; z += 3) line(at(x, z), at(x + w, z), "#39464a", 1);
      const colour = structure.style === "shop" ? "#68b8ae" : "#bc925e";
      poly(
        [at(x - 0.02, 24), at(x + w + 0.02, 24), at(x + w + 0.02, 29), at(x - 0.02, 29)],
        colour,
      );
      glow(
        at(x + w / 2, 25),
        20,
        structure.style === "shop" ? "rgba(58,199,188,.12)" : "rgba(230,157,66,.09)",
      );
    }
    for (const t of [0.04, 0.94]) {
      line(at(t, 0), at(t, h), "#151f28", 3);
      line(at(t + 0.007, 0), at(t + 0.007, h), "#66706c", 0.8);
    }
  };
  face(base[0]!, base[1]!, r.width, "#515658", "north");
  face(base[1]!, base[2]!, r.height, "#353d42", "east");
  poly(top, palette[2]!, "#6c716b");
  // Roof seams and a raised rim give a mass rather than a flat perimeter rectangle.
  for (let i = 0; i < 4; i++) line(top[i]!, top[(i + 1) % 4]!, "#82837a", 2);
  for (let t = 0.15; t < 1; t += 0.18)
    line(
      { x: top[0]!.x + (top[1]!.x - top[0]!.x) * t, y: top[0]!.y + (top[1]!.y - top[0]!.y) * t },
      { x: top[3]!.x + (top[2]!.x - top[3]!.x) * t, y: top[3]!.y + (top[2]!.y - top[3]!.y) * t },
      "#323f43",
      1,
    );
  // Rooftop service equipment is dressing on an inaccessible building, not cover.
  for (let i = 0; i < 2; i++) {
    const equipment = { x: r.x + 2 + i * 3, y: r.y + 3, width: 2, height: 2 };
    const bottom = corners(equipment, h),
      lid = corners(equipment, h + 8);
    poly([bottom[0]!, bottom[1]!, lid[1]!, lid[0]!], "#303e45", "#171f26");
    poly([bottom[1]!, bottom[2]!, lid[2]!, lid[1]!], "#26333b", "#171f26");
    poly(lid, "#65706b", "#7e8279");
    const center = project({ x: equipment.x + 1, y: equipment.y + 1 });
    ctx.beginPath();
    ctx.ellipse(center.x, center.y - h - 8, 6, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#28373c";
    ctx.fill();
    line(
      { x: center.x - 5, y: center.y - h - 8 },
      { x: center.x + 5, y: center.y - h - 8 },
      "#909584",
      0.6,
    );
    line(
      { x: center.x, y: center.y - h - 11 },
      { x: center.x, y: center.y - h - 5 },
      "#909584",
      0.6,
    );
  }
}

/** Each large mass is a separate sprite so actors can reveal it by occlusion fading. */
export function createComposedEnvironment(
  scene: Phaser.Scene,
  arena: Arena,
  project: Project,
): Phaser.GameObjects.Image[] {
  const ground = scene.textures.createCanvas("composed-ground", 1100, 700)!;
  paintComposedGround(ground.context, arena, project);
  ground.refresh();
  scene.add.image(550, 350, "composed-ground").setDepth(-1000);
  const objects: Phaser.GameObjects.Image[] = [];
  const add = (key: string, paint: (ctx: CanvasRenderingContext2D) => void, depth: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1100;
    canvas.height = 700;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    paint(ctx);
    const pixels = ctx.getImageData(0, 0, 1100, 700).data;
    let left = 1100,
      right = 0,
      top = 700,
      bottom = 0;
    for (let y = 0; y < 700; y++)
      for (let x = 0; x < 1100; x++)
        if (pixels[(y * 1100 + x) * 4 + 3]! > 5) {
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
    if (right <= left || bottom <= top) return;
    const texture = scene.textures.createCanvas(key, right - left + 1, bottom - top + 1)!;
    texture.context.drawImage(
      canvas,
      left,
      top,
      right - left + 1,
      bottom - top + 1,
      0,
      0,
      right - left + 1,
      bottom - top + 1,
    );
    texture.refresh();
    const image = scene.add
      .image((left + right) / 2, bottom, key)
      .setOrigin(0.5, 1)
      .setDepth(depth);
    objects.push(image);
  };
  for (const s of arena.environment!.structures) {
    const depth = project({ x: s.rect.x + s.rect.width, y: s.rect.y }).y;
    add(
      `structure-${s.id}`,
      (ctx) => paintBuilding(ctx, s, project, arena.environment!.entrances),
      depth,
    );
  }
  for (const d of arena.environment!.dressing) {
    if (d.kind === "litter" || d.kind === "drain") continue;
    const p = project(d.position);
    add(
      `dressing-${d.id}`,
      (ctx) => {
        const { line, glow, poly } = painter(ctx, project);
        ctx.fillStyle = "rgba(0,0,0,.24)";
        ctx.beginPath();
        ctx.ellipse(p.x + 3, p.y, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        if (d.kind === "lamp") {
          line(p, { x: p.x, y: p.y - 48 }, "#18232b", 3);
          line({ x: p.x + 1, y: p.y }, { x: p.x + 1, y: p.y - 48 }, "#7e8274", 0.8);
          line({ x: p.x, y: p.y - 48 }, { x: p.x + 12, y: p.y - 43 }, "#7e8274", 2);
          glow({ x: p.x + 12, y: p.y - 43 }, 13, "rgba(255,199,115,.35)");
          ctx.fillStyle = "#e1c294";
          ctx.fillRect(p.x + 8, p.y - 44, 7, 2);
        } else if (d.kind === "sign") {
          line(p, { x: p.x, y: p.y - 19 }, "#6f7976", 1.5);
          ctx.fillStyle = "#263d44";
          ctx.fillRect(p.x - 5, p.y - 28, 12, 14);
          ctx.fillStyle = "#c49671";
          ctx.fillRect(p.x - 3, p.y - 25, 8, 2);
          ctx.fillStyle = "#69b8b1";
          ctx.fillRect(p.x - 3, p.y - 20, 7, 1);
        } else if (d.kind === "stools") {
          for (const x of [-5, 5]) {
            line({ x: p.x + x, y: p.y }, { x: p.x + x, y: p.y - 5 }, "#707b78", 1);
            ctx.fillStyle = "#947a5c";
            ctx.beginPath();
            ctx.ellipse(p.x + x, p.y - 6, 3, 1.6, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (d.kind === "bollards") {
          for (let i = 0; i < 3; i++) {
            line(
              { x: p.x + i * 5, y: p.y + i * 2 },
              { x: p.x + i * 5, y: p.y + i * 2 - 7 },
              "#a99a65",
              2,
            );
          }
        } else {
          poly(
            [
              { x: p.x - 5, y: p.y - 2 },
              { x: p.x, y: p.y - 5 },
              { x: p.x + 7, y: p.y - 1 },
              { x: p.x + 2, y: p.y + 2 },
            ],
            "#7e725b",
          );
          ctx.fillStyle = "#4a554e";
          ctx.fillRect(p.x - 4, p.y - 7, 6, 6);
          ctx.fillStyle = "#9c8a6b";
          ctx.fillRect(p.x - 3, p.y - 7, 5, 1);
        }
      },
      p.y,
    );
  }
  return objects;
}
