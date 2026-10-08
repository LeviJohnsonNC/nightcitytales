/** Flush street construction and traces of use. Cached albedo, never obstacles or light. */
import type { Arena, Point, Rect } from "@/engine";
import { hash } from "./frontage";

const inside = (p: Point, r: Rect) =>
  p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
const corners = (r: Rect) => [
  { x: r.x, y: r.y },
  { x: r.x + r.width, y: r.y },
  { x: r.x + r.width, y: r.y + r.height },
  { x: r.x, y: r.y + r.height },
];
export interface StreetLife {
  channels: { a: Point; b: Point; inward: Point }[];
  covers: { at: Point; radius: number }[];
  scraps: { at: Point; angle: number; paper: boolean }[];
  pads: Rect[];
}

/** Derive only flush details from saved roads/sidewalks and existing service props. */
export function streetLife(arena: Arena): StreetLife {
  const out: StreetLife = { channels: [], covers: [], scraps: [], pads: [] };
  const env = arena.environment;
  if (!env || env.interior) return out;
  const roads = env.zones.filter((z) => z.kind === "road");
  const walks = env.zones.filter((z) => z.kind === "sidewalk");
  const crossings = env.zones.filter((z) => z.kind === "crosswalk" || z.kind === "intersection");
  const solid = env.structures.filter((s) => s.style !== "mesh-fence");
  const clear = (p: Point) => !solid.some((s) => inside(p, s.rect));
  const walk = (p: Point) => clear(p) && walks.some((z) => inside(p, z.rect));
  const awayFromDoor = (p: Point) =>
    !(env.entrances ?? []).some((e) => Math.hypot(p.x - e.position.x, p.y - e.position.y) < 1.25);
  const seen = new Set<string>();
  for (const z of roads) {
    const r = z.rect;
    // Only real road/sidewalk seams: no invented curb through the intersection.
    for (const [a, b, inward] of [
      [
        { x: r.x, y: r.y },
        { x: r.x + r.width, y: r.y },
        { x: 0, y: 1 },
      ],
      [
        { x: r.x, y: r.y + r.height },
        { x: r.x + r.width, y: r.y + r.height },
        { x: 0, y: -1 },
      ],
      [
        { x: r.x, y: r.y },
        { x: r.x, y: r.y + r.height },
        { x: 1, y: 0 },
      ],
      [
        { x: r.x + r.width, y: r.y },
        { x: r.x + r.width, y: r.y + r.height },
        { x: -1, y: 0 },
      ],
    ] as [Point, Point, Point][]) {
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const dx = (b.x - a.x) / length,
        dy = (b.y - a.y) / length;
      for (let t = 0; t + 1 <= length; t++) {
        const p = { x: a.x + dx * (t + 0.5), y: a.y + dy * (t + 0.5) };
        if (!walk({ x: p.x - inward.x * 0.2, y: p.y - inward.y * 0.2 })) continue;
        if (crossings.some((c) => inside(p, c.rect))) continue;
        const key = `${p.x}:${p.y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.channels.push({
          a: { x: a.x + dx * t, y: a.y + dy * t },
          b: { x: a.x + dx * (t + 1), y: a.y + dy * (t + 1) },
          inward,
        });
      }
    }
    // Access lids on the approaches, never in the centre's crossing paint.
    const vertical = z.axis === "y";
    const length = vertical ? r.height : r.width;
    const width = vertical ? r.width : r.height;
    if (length < 7 || width < 3) continue;
    for (const along of [0.3, 0.7]) {
      const at = {
        x: r.x + (vertical ? width * 0.36 : length * along),
        y: r.y + (vertical ? length * along : width * 0.36),
      };
      const radius = 0.48;
      const surround = { x: at.x - 0.8, y: at.y - 0.8, width: 1.6, height: 1.6 };
      if (!corners(surround).every((p) => inside(p, r) && clear(p))) continue;
      if (
        crossings.some(
          (c) =>
            surround.x < c.rect.x + c.rect.width &&
            surround.x + surround.width > c.rect.x &&
            surround.y < c.rect.y + c.rect.height &&
            surround.y + surround.height > c.rect.y,
        )
      )
        continue;
      if (out.covers.some((c) => Math.hypot(c.at.x - at.x, c.at.y - at.y) < 2)) continue;
      out.covers.push({ at, radius });
    }
  }
  for (const prop of env.props) {
    if (!["food-cart", "shop-display", "dumpster", "generator", "mailboxes"].includes(prop.art))
      continue;
    const cover = arena.cover?.find((c) => c.id === prop.coverId);
    if (!cover) continue;
    const r = cover.rect;
    // Repaired service paving stays after the object is destroyed; no fake boxes/cover.
    const pad = { x: r.x - 0.24, y: r.y - 0.24, width: r.width + 0.48, height: r.height + 0.48 };
    if (corners(pad).every(walk) && !out.pads.some((q) => inside({ x: r.x, y: r.y }, q)))
      out.pads.push(pad);
    for (let i = 0; i < 12; i++) {
      const angle = hash(r.x, r.y, i, 401) * Math.PI * 2;
      const at = {
        x: r.x + r.width / 2 + Math.cos(angle) * (r.width / 2 + 0.25 + hash(i, r.x, 402) * 0.7),
        y: r.y + r.height / 2 + Math.sin(angle) * (r.height / 2 + 0.25 + hash(i, r.y, 403) * 0.7),
      };
      const footprint = { x: at.x - 0.18, y: at.y - 0.18, width: 0.36, height: 0.36 };
      if (!corners(footprint).every((p) => walk(p) && awayFromDoor(p))) continue;
      if (arena.cover?.some((c) => inside(at, c.rect))) continue;
      out.scraps.push({ at, angle, paper: hash(r.x, r.y, i, 404) > 0.45 });
    }
  }
  return out;
}

/** Work in world metres so even circles and hatch spacing keep their isometric scale. */
export function paintStreetLife(
  ctx: CanvasRenderingContext2D,
  arena: Arena,
  project: (p: Point) => Point,
) {
  const details = streetLife(arena);
  const o = project({ x: 0, y: 0 }),
    u = project({ x: 1, y: 0 }),
    v = project({ x: 0, y: 1 });
  ctx.save();
  ctx.transform(u.x - o.x, u.y - o.y, v.x - o.x, v.y - o.y, o.x, o.y);
  const line = (a: Point, b: Point, color: string, width: number) => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  };
  const disc = (at: Point, radius: number, color: string) => {
    ctx.beginPath();
    ctx.arc(at.x, at.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };
  for (const { a, b, inward: n } of details.channels) {
    const shift = (p: Point, d: number) => ({ x: p.x + n.x * d, y: p.y + n.y * d });
    line(shift(a, 0.19), shift(b, 0.19), "rgba(8,14,14,.56)", 0.38);
    line(shift(a, 0.19), shift(b, 0.19), "rgba(104,111,102,.25)", 0.22);
    line(a, b, "#899184", 0.065);
    line(shift(a, 0.4), shift(b, 0.4), "rgba(6,12,14,.55)", 0.045);
    line(shift(a, 0.03), shift(a, 0.37), "rgba(9,16,16,.62)", 0.035);
    // Small inset drain slots at an irregular but reproducible rhythm.
    if (hash(a.x, a.y, 405) < 0.13) {
      const dx = b.x - a.x,
        dy = b.y - a.y;
      for (let t = 0.23; t < 0.8; t += 0.09) {
        const p = { x: a.x + dx * t, y: a.y + dy * t };
        line(shift(p, 0.09), shift(p, 0.32), "#111c1d", 0.045);
      }
    }
    // Leaf fragments follow the seam; kept below curb height and outside the crossing.
    for (let i = 0; i < 3; i++) {
      const t = hash(a.x, a.y, i, 406);
      if (t > 0.48) continue;
      const p = { x: a.x + (b.x - a.x) * t + n.x * 0.18, y: a.y + (b.y - a.y) * t + n.y * 0.18 };
      line(p, { x: p.x + 0.075, y: p.y + 0.045 }, "#80754d", 0.035);
    }
  }
  for (const { at, radius } of details.covers) {
    // Cut-in surround, two iron rims, recessed lid and crosshatched traction surface.
    ctx.fillStyle = "rgba(91,93,81,.27)";
    ctx.fillRect(at.x - 0.69, at.y - 0.69, 1.38, 1.38);
    ctx.strokeStyle = "rgba(7,13,14,.6)";
    ctx.lineWidth = 0.045;
    ctx.strokeRect(at.x - 0.69, at.y - 0.69, 1.38, 1.38);
    disc(at, radius + 0.09, "#131e20");
    disc(at, radius + 0.025, "#6e7165");
    disc(at, radius - 0.025, "#1c292b");
    disc(at, radius - 0.065, "#3c4948");
    ctx.save();
    ctx.beginPath();
    ctx.arc(at.x, at.y, radius - 0.095, 0, Math.PI * 2);
    ctx.clip();
    for (let t = -0.6; t < 0.6; t += 0.11) {
      line({ x: at.x + t, y: at.y - 0.5 }, { x: at.x + t, y: at.y + 0.5 }, "#152225", 0.038);
      line({ x: at.x - 0.5, y: at.y + t }, { x: at.x + 0.5, y: at.y + t }, "#667062", 0.02);
    }
    ctx.restore();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      disc(
        {
          x: at.x + Math.cos(angle) * (radius - 0.04),
          y: at.y + Math.sin(angle) * (radius - 0.04),
        },
        0.025,
        "#0c181a",
      );
    }
  }
  for (const r of details.pads) {
    ctx.fillStyle = "rgba(141,130,104,.24)";
    ctx.fillRect(r.x, r.y, r.width, r.height);
    ctx.strokeStyle = "rgba(23,31,29,.55)";
    ctx.lineWidth = 0.055;
    ctx.strokeRect(r.x, r.y, r.width, r.height);
    for (let t = 0.35; t < r.width; t += 0.35)
      line({ x: r.x + t, y: r.y }, { x: r.x + t, y: r.y + r.height }, "rgba(57,64,55,.48)", 0.025);
  }
  for (const { at, angle, paper } of details.scraps) {
    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.rotate(angle);
    // Discarded paper and flattened packaging, not persistent three-dimensional props.
    ctx.fillStyle = "rgba(9,16,16,.38)";
    ctx.fillRect(-0.1, -0.05, 0.23, 0.14);
    ctx.fillStyle = paper ? "#a79e7d" : "#746342";
    ctx.fillRect(-0.11, -0.07, 0.2, 0.12);
    line({ x: -0.08, y: -0.015 }, { x: 0.045, y: -0.015 }, paper ? "#5c6660" : "#a08c64", 0.016);
    line({ x: -0.05, y: 0.025 }, { x: 0.055, y: 0.025 }, "#5c6254", 0.013);
    ctx.restore();
  }
  ctx.restore();
}
