import { paintFaceAsset } from "./afterRainArt";
import type { ArchitectureArt } from "./architecturePack";
/** Built details and entrance lights, aligned to saved facade planes and doors. */
import type { Point, SceneEnvironment, SceneStructure } from "@/engine";
import { facadeOpenings } from "./architectureArt";
import { facePainter } from "./buildingFaces";
import { edgeFrame, exposedSpans, type Edge } from "./frontage";
import type { GroundLight } from "./nightLighting";

export function entranceLights(env: SceneEnvironment): GroundLight[] {
  return env.structures.flatMap((s) => {
    if (s.style !== "workshop" && s.style !== "residential") return [];
    return (["north", "east"] as const).flatMap((edge) => {
      const f = edgeFrame(s.rect, edge);
      return facadeOpenings(s, env.entrances, edge).doors.map((c) => ({
        kind: "spill" as const,
        origin: f.world(0, 0),
        along: edge === "north" ? { x: 1, y: 0 } : { x: 0, y: 1 },
        out: edge === "north" ? { x: 0, y: -1 } : { x: 1, y: 0 },
        s0: c - 0.8,
        s1: c + 0.8,
        reach: s.style === "workshop" ? 4 : 2.6,
        spread: 0.7,
        color: s.style === "workshop" ? ([0.28, 0.77, 1] as const) : ([1, 0.62, 0.28] as const),
        intensity: s.style === "workshop" ? 0.8 : 0.68,
      }));
    });
  });
}

export function paintFrontageIdentity(
  ctx: CanvasRenderingContext2D,
  s: SceneStructure,
  edge: Edge,
  env: { entrances?: SceneEnvironment["entrances"]; structures: readonly SceneStructure[] },
  project: (p: Point) => Point,
  ppm: number,
  pass: "albedo" | "light" | "glow",
  art?: ArchitectureArt,
) {
  if (s.style !== "workshop" && s.style !== "residential") return;
  const { at, quad, length } = facePainter(s, edge, project, ppm);
  const fill = (ps: Point[], color: string | CanvasGradient) => {
    ctx.beginPath();
    ps.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  const line = (a: Point, b: Point, c: string, w: number) => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = c;
    ctx.lineWidth = w * ppm;
    ctx.stroke();
  };
  const workshop = s.style === "workshop";
  const doors = facadeOpenings(s, env.entrances, edge).doors;
  ctx.save();
  ctx.beginPath();
  for (const [a, b] of exposedSpans(s, edge, env.structures)) {
    quad(a, b, 0, s.height).forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  }
  ctx.clip();
  if (pass === "albedo") {
    if (workshop) {
      // A continuous workshop service rail, with repeated fixings and corner conduits.
      fill(quad(0, length, s.height - 0.4, s.height - 0.27, 0.045), "#395d64");
      line(at(0, 0.06, s.height - 0.29), at(length, 0.06, s.height - 0.29), "#91a6a0", 0.032);
      for (const x of [0.2, length - 0.2]) {
        line(at(x, 0.06, 0.4), at(x, 0.06, s.height - 0.4), "#152a32", 0.085);
        line(at(x - 0.025, 0.09, 0.4), at(x - 0.025, 0.09, s.height - 0.4), "#82948b", 0.025);
        for (let z = 0.65; z < s.height - 0.4; z += 0.65)
          line(at(x - 0.05, 0.09, z), at(x + 0.06, 0.09, z), "#959985", 0.045);
      }
    }
    for (const c of doors) {
      const doorTop = Math.min(2.2, s.height - 0.5);
      paintFaceAsset(
        ctx,
        workshop ? art?.repairShutter : art?.residentialDoor,
        at,
        c - 0.92,
        c + 0.92,
        0,
        doorTop + 0.3,
      );
      const z = Math.min(2.48, s.height - 0.45);
      // Tube casing (repair) / a bronze hood (home), above the saved entrance.
      fill(quad(c - 0.89, c + 0.89, z, z + 0.14, 0.12), workshop ? "#173443" : "#392f21");
      fill(
        [
          at(c - 0.89, 0, z + 0.14),
          at(c + 0.89, 0, z + 0.14),
          at(c + 0.89, 0.19, z + 0.14),
          at(c - 0.89, 0.19, z + 0.14),
        ],
        workshop ? "#9daeb0" : "#a58a53",
      );
      fill(quad(c - 0.72, c + 0.72, z + 0.015, z + 0.055, 0.13), workshop ? "#95c8cc" : "#b9a26b");
      // Wall-mounted service box / intercom alongside the doorway, not street cover.
      const side = c + 1.02 < length - 0.55 ? c + 1.02 : c - 1.42;
      if (side > 0.2 && side + 0.4 < length - 0.2) {
        fill(quad(side, side + 0.38, 0.86, 1.43, 0.06), "#192a2d");
        fill(quad(side + 0.035, side + 0.34, 0.9, 1.39, 0.095), workshop ? "#526e71" : "#8b7b5d");
        for (let z = 1.04; z < 1.32; z += 0.06)
          line(at(side + 0.08, 0.1, z), at(side + 0.3, 0.1, z), "#17292b", 0.015);
        fill(quad(side + 0.13, side + 0.2, 0.94, 0.99, 0.1), "#bdbd94");
      }
    }
  } else
    for (const c of doors) {
      if (!workshop && pass === "glow")
        paintFaceAsset(
          ctx,
          art?.residentialDoorEmission,
          at,
          c - 0.92,
          c + 0.92,
          0,
          Math.min(2.2, s.height - 0.5) + 0.3,
        );
      const z = Math.min(2.48, s.height - 0.45);
      if (pass === "glow")
        fill(
          quad(c - 0.72, c + 0.72, z + 0.015, z + 0.055, 0.13),
          workshop ? "#a5edff" : "#ffd292",
        );
      else {
        const p = at(c, 0, z),
          q = at(c, 0, 0.1),
          g = ctx.createLinearGradient(p.x, p.y, q.x, q.y);
        g.addColorStop(0, workshop ? "rgba(76,177,235,.7)" : "rgba(255,175,83,.6)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        fill(quad(c - 1.03, c + 1.03, 0.05, z + 0.2), g);
      }
    }
  ctx.restore();
}
