/** Occupied repair premises: saved shop/portal attachments select presentation only.
 * The workshop is a shallow display recess, never an extra traversable interior. */
import type { Point, SceneEnvironment, SceneStructure } from "@/engine";
import type { ArchitectureArt } from "./architecturePack";
import { paintFaceAsset } from "./afterRainArt";
import { facePainter } from "./buildingFaces";
import { facadeOpenings } from "./architectureArt";
import { edgeFrame, type Edge } from "./frontage";
import { paintWorkshopInterior } from "./workshopInterior";
import type { GroundLight } from "./nightLighting";

export function occupiedUse(s: SceneStructure): "repair" | "studios" | undefined {
  if (s.style !== "shop" || s.height < 6.8) return;
  if (s.attachments?.some((a) => a.id === "retail-header")) return "repair";
  if (s.attachments?.some((a) => a.id === "repair-studios-portal")) return "studios";
  return undefined;
}

export function occupiedLights(env: SceneEnvironment): GroundLight[] {
  return env.structures.flatMap((s) => {
    const use = occupiedUse(s);
    if (!use) return [];
    return (["north", "east"] as const).flatMap((edge) => {
      const f = edgeFrame(s.rect, edge);
      const doors = facadeOpenings(s, env.entrances, edge).doors;
      const centres =
        use === "repair" ? [(edge === "north" ? s.rect.width : s.rect.height) / 2] : doors;
      return centres.map((c) => ({
        kind: "spill" as const,
        origin: f.world(0, 0),
        along: edge === "north" ? { x: 1, y: 0 } : { x: 0, y: 1 },
        out: edge === "north" ? { x: 0, y: -1 } : { x: 1, y: 0 },
        s0: c - (use === "repair" ? 1.9 : 0.7),
        s1: c + (use === "repair" ? 1.9 : 0.7),
        reach: use === "repair" ? 3.8 : 3.4,
        spread: 0.45,
        color: use === "repair" ? ([1, 0.72, 0.39] as const) : ([0.46, 0.79, 1] as const),
        intensity: use === "repair" ? 0.66 : 0.68,
      }));
    });
  });
}

export function paintOccupiedFrontage(
  ctx: CanvasRenderingContext2D,
  s: SceneStructure,
  edge: Edge,
  entrances: SceneEnvironment["entrances"],
  project: (p: Point) => Point,
  ppm: number,
  pass: "albedo" | "light" | "glow",
  art?: ArchitectureArt,
) {
  const use = occupiedUse(s);
  if (!use) return;
  const face = facePainter(s, edge, project, ppm);
  const { at, quad, length } = face;
  const fill = (points: Point[], color: string | CanvasGradient) => {
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  const panel = (a: number, b: number, lo: number, hi: number, color: string, out = 0.06) =>
    fill(quad(a, b, lo, hi, out), color);
  const line = (a: Point, b: Point, color: string, w = 0.035) => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = w * ppm;
    ctx.stroke();
  };
  const text = (label: string, a: number, b: number, lo: number, hi: number, color: string) => {
    const p = at(a, 0.11, hi),
      q = at(a + 1, 0.11, hi);
    ctx.save();
    ctx.transform(q.x - p.x, q.y - p.y, 0, ppm, p.x, p.y);
    ctx.font = `600 ${(hi - lo) * 0.65}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(label, (b - a) / 2, (hi - lo) / 2, b - a - 0.12);
    ctx.restore();
  };
  const wash = (a: number, b: number, lo: number, hi: number, color: string) => {
    const p = at(a, 0, hi),
      q = at(a, 0, lo);
    const g = ctx.createLinearGradient(p.x, p.y, q.x, q.y);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    fill(quad(a, b, lo, hi), g);
  };
  const doors = facadeOpenings(s, entrances, edge).doors;
  if (use === "studios") {
    for (const c of doors) {
      if (pass === "albedo") {
        panel(c - 1, c + 1, 0, 2.7, "#1b292e");
        paintFaceAsset(ctx, art?.residentialDoor, at, c - 0.92, c + 0.92, 0, 2.5);
        panel(c - 1.05, c + 1.05, 2.62, 2.85, "#465659", 0.15);
        panel(c - 0.65, c + 0.65, 2.66, 2.73, "#b5c4b7", 0.17);
        panel(c - 0.9, c + 0.9, 2.98, 3.47, "#263c42");
        text("STUDIOS  /  02", c - 0.85, c + 0.85, 3.04, 3.38, "#c4c7ae");
        for (const z of [3.65, 3.72]) line(at(0, 0.09, z), at(length, 0.09, z), "#172c31", 0.045);
        for (let x = 0.4; x < length; x += 1.1) line(at(x, 0.12, 3.6), at(x, 0.12, 3.8), "#6f7c72");
      } else if (pass === "light") wash(c - 1.15, c + 1.15, 0.1, 2.9, "rgba(105,184,227,.65)");
      else {
        panel(c - 0.65, c + 0.65, 2.66, 2.73, "#c7eaff", 0.17);
        paintFaceAsset(ctx, art?.residentialDoorEmission, at, c - 0.92, c + 0.92, 0, 2.5);
      }
    }
    return;
  }
  const bays = doors.length
    ? [
        { a: 0.35, b: 1.8, lo: 0.68, hi: 2.55 },
        { a: 4.2, b: 5.65, lo: 0.68, hi: 2.55 },
      ]
    : [
        { a: 0.35, b: 3.65, lo: 0.68, hi: 2.55 },
        { a: 3.9, b: length - 0.35, lo: 0.68, hi: 2.55 },
      ];
  if (pass === "light") {
    wash(0.15, length - 0.15, 0.1, 3.65, "rgba(239,176,100,.3)");
    for (const b of bays)
      panel(b.a + 0.1, b.b - 0.1, b.lo + 0.1, b.hi - 0.1, "rgba(255,194,116,.18)", -0.12);
    return;
  }
  if (pass === "glow") {
    text("DENKI  /  ELECTRIC", 0.25, length - 0.25, 3.07, 3.51, "#f4c687");
    panel(0.35, length - 0.35, 2.81, 2.86, "#ffe2a5", 0.15);
    for (const b of bays) panel(b.a + 0.15, b.b - 0.15, 2.36, 2.4, "#ffd89a", -0.12);
    return;
  }
  // A continuous dark enamel trading floor under the existing apartment string course.
  panel(0, length, 0.08, 3.8, edge === "north" ? "#465453" : "#303f41", 0.015);
  for (let x = 0.15; x < length; x += 0.55) {
    line(at(x, 0.035, 0.2), at(x, 0.035, 2.75), "rgba(18,28,29,.3)", 0.018);
  }
  panel(0, length, 0.08, 0.27, "#242f30");
  panel(0.1, length - 0.1, 2.96, 3.65, "#152d32", 0.08);
  panel(0.16, length - 0.16, 3.59, 3.65, "#82918a", 0.11);
  text("DENKI  /  ELECTRIC", 0.25, length - 0.25, 3.07, 3.51, "#d7c194");
  panel(0.25, length - 0.25, 2.7, 2.93, "#27393b", 0.14);
  text("REPAIR   •   AUDIO   •   PARTS", 0.3, length - 0.3, 2.72, 2.9, "#aaad91");
  // Shallow workshop display bays: pegboard, bench, repaired electronics and task lights.
  for (const b of bays) {
    panel(b.a - 0.08, b.b + 0.08, b.lo - 0.08, b.hi + 0.08, "#142327");
    paintWorkshopInterior(ctx, face, b.a, b.b, b.a < 1 ? "bench" : "storage");
    // Angled reveals and mullions anchor the interior behind the actual facade.
    fill(
      [at(b.a, 0.04, b.lo), at(b.a, 0.04, b.hi), at(b.a, -0.13, b.hi), at(b.a, -0.13, b.lo)],
      "#262b28",
    );
    fill(
      [at(b.a, 0.04, b.hi), at(b.b, 0.04, b.hi), at(b.b, -0.13, b.hi), at(b.a, -0.13, b.hi)],
      "#192623",
    );
    for (const x of [b.a, b.b - 0.035]) panel(x, x + 0.035, b.lo, b.hi, "#89928a", 0.04);
    panel(b.a - 0.08, b.b + 0.08, b.lo - 0.09, b.lo, "#9c997f", 0.12);
    panel(b.a + 0.15, b.b - 0.15, 2.36, 2.4, "#d2c197", -0.12);
  }
  for (const c of doors) {
    panel(c - 0.85, c + 0.85, 0.08, 2.58, "#142326");
    // Keep the saved entrance clear; a deep, lit threshold under a partly raised shutter.
    panel(c - 0.72, c + 0.72, 0.06, 1.85, "#5b5140", -0.16);
    panel(c - 0.6, c + 0.6, 0.3, 1.2, "#343a31", -0.15);
    panel(c - 0.65, c + 0.65, 1.18, 1.3, "#8e8261", -0.14);
    for (let z = 1.9; z < 2.54; z += 0.085) {
      panel(c - 0.75, c + 0.75, z, z + 0.075, "#6d7770", 0.035);
      line(at(c - 0.75, 0.05, z), at(c + 0.75, 0.05, z), "#242f30", 0.018);
    }
    for (const x of [c - 0.85, c + 0.78]) panel(x, x + 0.075, 0.05, 2.65, "#a29c81", 0.1);
    fill(
      [at(c - 0.8, -0.17, 0), at(c + 0.8, -0.17, 0), at(c + 0.8, 0.17, 0), at(c - 0.8, 0.17, 0)],
      "#a28d66",
    );
  }
  paintOccupiedCanopy(ctx, s, edge, project, ppm);

  for (const x of [0.12, length - 0.18]) {
    panel(x, x + 0.065, 0.2, 2.68, "#161f22", 0.1);
    line(at(x, 0.13, 0.2), at(x, 0.13, 2.68), "#8b9687", 0.025);
  }
}

/** Shared silhouette for albedo and occlusion of additive window lighting. */
export function paintOccupiedCanopy(
  ctx: CanvasRenderingContext2D,
  s: SceneStructure,
  edge: Edge,
  project: (p: Point) => Point,
  ppm: number,
) {
  if (occupiedUse(s) !== "repair") return;
  const { at, quad, length } = facePainter(s, edge, project, ppm);
  const fill = (ps: Point[], color: string) => {
    ctx.beginPath();
    ps.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  const panel = (a: number, b: number, lo: number, hi: number, color: string, out: number) =>
    fill(quad(a, b, lo, hi, out), color);
  const line = (a: Point, b: Point, color: string, w: number) => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = w * ppm;
    ctx.stroke();
  };
  // Folded metal canopy: a real top plane and fascia break the flat wall silhouette.
  // It remains above every entrance and below the existing sign.
  fill(
    [
      at(0.08, 0, 2.72),
      at(length - 0.08, 0, 2.72),
      at(length - 0.08, 0.4, 2.57),
      at(0.08, 0.4, 2.57),
    ],
    "#607777",
  );
  panel(0.08, length - 0.08, 2.46, 2.57, "#263f43", 0.4);
  for (let x = 0.18; x < length - 0.1; x += 0.48)
    line(at(x, 0.02, 2.73), at(x, 0.39, 2.58), "#89958a", 0.018);
  for (const x of [0.3, length - 0.3]) line(at(x, 0.02, 2.1), at(x, 0.38, 2.48), "#23373a", 0.05);
}

/** A shallow first-floor balcony, attached above head height, within the facade span. */
export function paintOccupiedBalcony(
  ctx: CanvasRenderingContext2D,
  s: SceneStructure,
  edge: Edge,
  project: (p: Point) => Point,
  ppm: number,
) {
  if (occupiedUse(s) !== "repair" || edge !== "east") return;
  const face = facePainter(s, edge, project, ppm);
  // Lift the landing clear of the sign in this oblique camera projection.
  const at = (x: number, out: number, z: number) => face.at(x, out, z + 0.35);
  const quad = (a: number, b: number, lo: number, hi: number, out: number) =>
    face.quad(a, b, lo + 0.35, hi + 0.35, out);
  const fill = (ps: Point[], c: string) => {
    ctx.beginPath();
    ps.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = c;
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
  fill([at(1, 0, 4.25), at(5, 0, 4.25), at(5, 0.85, 4.25), at(1, 0.85, 4.25)], "#777c6c");
  fill(quad(1, 5, 4.05, 4.25, 0.85), "#354644");
  for (const x of [1.1, 4.9]) line(at(x, 0, 3.92), at(x, 0.8, 4.15), "#273734", 0.07);
  for (let x = 1; x <= 5; x += 0.4) line(at(x, 0.85, 4.23), at(x, 0.85, 5.2), "#75857b", 0.035);
  for (const z of [4.4, 5.2]) line(at(1, 0.85, z), at(5, 0.85, z), "#a0a58f", 0.045);
  for (const x of [1, 5]) line(at(x, 0, 5.2), at(x, 0.85, 5.2), "#929c8b", 0.045);
  // Privacy screens, drain and canopy make a recognisable occupied outdoor room.
  fill(quad(1.02, 2.05, 4.35, 4.91, 0.855), "#586b61");
  for (let x = 1.08; x < 2.05; x += 0.13)
    line(at(x, 0.865, 4.39), at(x, 0.865, 4.89), "#91a08b", 0.025);
  for (const x of [1, 5]) line(at(x, 0.85, 4.25), at(x, 0.85, 6.43), "#516960", 0.065);
  fill(
    [at(0.86, 0, 6.62), at(5.14, 0, 6.62), at(5.14, 0.98, 6.43), at(0.86, 0.98, 6.43)],
    "#6a7e72",
  );
  fill(quad(0.86, 5.14, 6.32, 6.43, 0.98), "#2d4747");
  for (let x = 1; x < 5.1; x += 0.42) line(at(x, 0, 6.63), at(x, 0.98, 6.44), "#95a08b", 0.018);
  // A folded cloth and two modest plant pots supply habitation without a repeated prop row.
  fill(quad(3.8, 4.45, 4.45, 5.24, 0.865), "#756959");
  for (const x of [1.35, 1.9]) {
    fill(quad(x, x + 0.25, 4.25, 4.47, 0.3), "#80654b");
    for (const k of [-0.08, 0.02, 0.13])
      line(at(x + 0.12, 0.3, 4.44), at(x + 0.12 + k, 0.3, 4.72 + Math.abs(k)), "#647758", 0.055);
  }
}
