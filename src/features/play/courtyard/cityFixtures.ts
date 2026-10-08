import { paintFixtureArt } from "./afterRainArt";
import type { ArchitectureArt } from "./architecturePack";
/** Street furniture on existing saved dressing anchors. Dimensions are metres. */
import type { Point, SceneEnvironment } from "@/engine";
import type { GroundLight, Rgb } from "./nightLighting";
export const CITY_FIXTURES = {
  lampOffset: -0.78,
  lampHeight: 5.1,
  mast: 5.4,
  arm: 3.8,
  signalBottom: 4.12,
  panel: { width: 1.05, bottom: 0.95, top: 2.95, depth: 0.18 },
  cyan: [0.15, 0.77, 1] as Rgb,
} as const;

/** Point an overhead arm into the nearest saved carriageway; never invent a base. */
export function streetDirection(env: SceneEnvironment, p: Point): Point {
  const roads = env.zones.filter((z) => z.kind === "road" || z.kind === "intersection");
  const nearest = roads
    .map((z) => ({
      x: Math.max(z.rect.x, Math.min(p.x, z.rect.x + z.rect.width)),
      y: Math.max(z.rect.y, Math.min(p.y, z.rect.y + z.rect.height)),
    }))
    .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
  if (!nearest) return { x: 1, y: 0 };
  const dx = nearest.x - p.x,
    dy = nearest.y - p.y;
  return Math.abs(dx) > Math.abs(dy)
    ? { x: Math.sign(dx) || 1, y: 0 }
    : { x: 0, y: Math.sign(dy) || -1 };
}

/** Ground pool and wall/shadow source share the lamp head's location. */
export function fixtureLamp(env: SceneEnvironment, position: Point) {
  const d = streetDirection(env, position);
  return {
    at: {
      x: position.x + d.x * CITY_FIXTURES.lampOffset,
      y: position.y + d.y * CITY_FIXTURES.lampOffset,
    },
    z: CITY_FIXTURES.lampHeight,
  };
}
export function fixtureLights(env: SceneEnvironment): GroundLight[] {
  return env.dressing
    .filter((d) => d.kind === "sign")
    .map((d) => ({
      kind: "pool",
      centre: d.position,
      radius: 3.7,
      color: CITY_FIXTURES.cyan,
      intensity: 0.62,
    }));
}

/** A transit display and a signal mast. Base and emission use identical geometry. */
export function paintCityFixture(
  ctx: CanvasRenderingContext2D,
  env: SceneEnvironment,
  d: SceneEnvironment["dressing"][number],
  project: (p: Point) => Point,
  ppm: number,
  pass: "albedo" | "light" | "glow",
  art?: ArchitectureArt,
) {
  if (pass === "light") return;
  const dir = streetDirection(env, d.position);
  const ninety = dir.y > 0 || dir.x < 0;
  const key =
    d.kind === "lamp" ? (ninety ? "signal90" : "signal0") : ninety ? "transit90" : "transit0";
  if (paintFixtureArt(ctx, art, key, project(d.position), ppm, dir.x + dir.y < 0, pass === "glow"))
    return;
  const at = (s: number, z: number, side = 0) => {
    const p = project({
      x: d.position.x + dir.x * s - dir.y * side,
      y: d.position.y + dir.y * s + dir.x * side,
    });
    return { x: p.x, y: p.y - z * ppm };
  };
  const line = (a: Point, b: Point, c: string, w: number) => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = c;
    ctx.lineWidth = w * ppm;
    ctx.stroke();
  };
  const poly = (ps: Point[], c: string) => {
    ctx.beginPath();
    ps.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = c;
    ctx.fill();
  };
  const plate = (a: number, b: number, lo: number, hi: number, c: string, side = 0) =>
    poly([at(a, lo, side), at(b, lo, side), at(b, hi, side), at(a, hi, side)], c);
  if (d.kind === "lamp") {
    const H = CITY_FIXTURES.mast,
      A = CITY_FIXTURES.arm;
    if (pass === "albedo") {
      line(at(0, 0), at(0, H), "#151f22", 0.19);
      line(at(-0.04, 0.14), at(-0.04, H), "#68746d", 0.045);
      line(at(0, 0.05), at(0, 0.35), "#273635", 0.34);
      for (const z of [0.4, 1.05, 3.1, H - 0.1])
        line(at(0, z - 0.04), at(0, z + 0.04), "#9a9272", 0.24);
      line(at(0, H), at(A, H), "#27312e", 0.15);
      line(at(0, H + 0.035), at(A, H + 0.035), "#a99a70", 0.035);
      line(at(0, H + 0.5), at(A * 0.72, H), "#6c7163", 0.035);
      // Two hanging signal heads, above pedestrian and vehicle clearance.
      for (const s of [A * 0.45, A]) {
        line(at(s, H), at(s, H - 0.35), "#282d26", 0.055);
        plate(s - 0.2, s + 0.2, CITY_FIXTURES.signalBottom, H - 0.24, "#a38a49");
        plate(s - 0.15, s + 0.15, CITY_FIXTURES.signalBottom + 0.05, H - 0.3, "#10191b", 0.035);
        for (let i = 0; i < 3; i++) {
          const z = H - 0.47 - i * 0.27;
          plate(s - 0.14, s + 0.14, z + 0.02, z + 0.1, "#414e43", 0.085);
          const p = at(s, z - 0.03, 0.1);
          ctx.fillStyle = i === 0 ? "#753528" : i === 1 ? "#58422a" : "#204a3d";
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, 0.085 * ppm, 0.1 * ppm, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Downlight: a physical housing on the same mast.
      line(at(0, H - 0.6), at(-0.7, H - 0.45), "#768077", 0.09);
      plate(-0.95, -0.5, H - 0.57, H - 0.43, "#99a391");
    } else {
      for (const s of [A * 0.45, A]) {
        const p = at(s, H - 0.5, 0.1);
        ctx.fillStyle = "#ff6648";
        ctx.shadowColor = "#f94b28";
        ctx.shadowBlur = ppm * 0.2;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 0.071 * ppm, 0.085 * ppm, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      plate(-0.9, -0.54, H - 0.58, H - 0.55, "#ffdf9a");
    }
    return;
  }
  if (d.kind !== "sign") return;
  // Plane follows the street; neutral steel edges keep this a fixture, not a floating graphic.
  const P = CITY_FIXTURES.panel,
    half = P.width / 2;
  if (pass === "albedo") {
    line(at(0, 0), at(0, P.bottom), "#566466", 0.14);
    line(at(0, 0.03), at(0, 0.14), "#283b40", 0.28);
    plate(-half, half, P.bottom, P.top, "#162b34");
    poly(
      [at(half, P.bottom), at(half, P.top), at(half, P.top, P.depth), at(half, P.bottom, P.depth)],
      "#0c171d",
    );
    poly(
      [at(-half, P.top), at(half, P.top), at(half, P.top, P.depth), at(-half, P.top, P.depth)],
      "#849496",
    );
    plate(-half + 0.07, half - 0.07, P.bottom + 0.12, P.top - 0.12, "#105670", 0.01);
    for (const z of [P.bottom + 0.06, P.top - 0.06])
      line(at(-half + 0.05, z), at(half - 0.05, z), "#86959b", 0.025);
  }
  const origin = at(-half + 0.1, P.top - 0.17, 0.025),
    right = at(half - 0.1, P.top - 0.17, 0.025),
    bottom = at(-half + 0.1, P.bottom + 0.17, 0.025);
  ctx.save();
  ctx.transform(
    (right.x - origin.x) / 240,
    (right.y - origin.y) / 240,
    (bottom.x - origin.x) / 480,
    (bottom.y - origin.y) / 480,
    origin.x,
    origin.y,
  );
  ctx.beginPath();
  ctx.rect(0, 0, 240, 480);
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 240, 480);
  g.addColorStop(0, "#0b4267");
  g.addColorStop(0.55, "#139ec1");
  g.addColorStop(1, "#052b47");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 240, 480);
  // Legible authored typography and a bold diagram survive the play camera.
  ctx.strokeStyle = "#8df5ee";
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(135, 220, 83, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#d3ffff";
  ctx.lineWidth = 23;
  ctx.beginPath();
  ctx.moveTo(20, 345);
  ctx.lineTo(130, 145);
  ctx.lineTo(213, 145);
  ctx.stroke();
  ctx.fillStyle = "#e6ffff";
  ctx.font = "bold 31px sans-serif";
  ctx.fillText("NIGHT CITY", 16, 44);
  ctx.font = "bold 48px sans-serif";
  ctx.fillText("AFTER", 14, 407);
  ctx.fillText("HOURS", 14, 454);
  ctx.font = "18px sans-serif";
  ctx.fillText("TRANSIT / 24H", 17, 77);
  for (let y = 96; y < 340; y += 7) {
    ctx.fillStyle = "rgba(5,20,40,.10)";
    ctx.fillRect(0, y, 240, 1);
  }
  if (pass === "albedo") {
    ctx.fillStyle = "rgba(8,20,30,.48)";
    ctx.fillRect(0, 0, 240, 480);
  }
  ctx.restore();
}
